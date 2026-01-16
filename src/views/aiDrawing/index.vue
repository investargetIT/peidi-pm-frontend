<script setup lang="ts">
import { provide, ref } from "vue";
import ExcelTable from "./excelTable/index.vue";
import EditDialog from "./editDialog/index.vue";
import Assembling from "./assembling/index.vue";
import MaterialLibrary from "./materialLibrary/index.vue";
import { ExcelTableItem } from "./excelTable/type";
import { imageCache } from "./dev/utils/imageCache/imageCache";
import { ElMessage } from "element-plus";
import { downloadFile } from "@/api/aiDraw";
import Compressor from "compressorjs";
import UPNG from "upng-js";

//#region 编辑弹窗&组图弹窗逻辑
const editDialogRef = ref<typeof EditDialog>();
const assemblingRef = ref<typeof Assembling>();

// 生成的模板图 /ai/xxx
const templateImg = ref("");
const templateRow = ref<ExcelTableItem>({} as ExcelTableItem);

const updateTemplateImg = (
  img: string,
  openDialogIndex: number = 0,
  row: ExcelTableItem
) => {
  // console.log("生成的模板图:", img);
  templateImg.value = img;
  templateRow.value = row;
  if (openDialogIndex === 0) {
    editDialogRef.value?.open(row);
  } else if (openDialogIndex === 1) {
    assemblingRef.value?.open();
  }
};
provide("updateTemplateImg", updateTemplateImg);
//#endregion

//#region 图片缓存逻辑
/**
 * 使用compressor压缩图片
 * @param base64Data 原始base64图片数据
 * @param quality 压缩质量 (0-1)
 * @returns Promise<string> 压缩后的base64数据
 */
const compressImage = (
  base64Data: string,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 将base64转换为Blob
    const blob = dataURLtoBlob(base64Data);

    new Compressor(blob, {
      quality,
      maxWidth: 70, // 最大宽度限制
      maxHeight: 70, // 最大高度限制
      success(result) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => reject(new Error("图片压缩后读取失败"));
        reader.readAsDataURL(result);
      },
      error(err) {
        console.error("图片压缩失败:", err);
        // 压缩失败时返回原始数据
        resolve(base64Data);
      }
    });
  });
};

/**
 * 将base64数据转换为Blob
 * @param dataURL base64数据
 * @returns Blob对象
 */
const dataURLtoBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
};

// 压缩PNG图片
const compressPNG = async (file: File): Promise<File> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = UPNG.decode(arrayBuffer);
    const rgba8 = UPNG.toRGBA8(decoded);

    // 关键的压缩方法
    // 这里保持宽高不变，保持80%的质量（接近于 tinypng 的压缩效果）
    const compressed = UPNG.encode(
      rgba8,
      decoded.width,
      decoded.height,
      256 * 0.3
    );
    return new File([compressed], file.name, { type: "image/png" });
  } catch (error) {
    console.error("PNG图片压缩失败:", error);
    // 压缩失败时返回原始文件
    return file;
  }
};

// 定义图片数据返回类型
interface ImageDataResult {
  originalBlob: string; // 原图base64数据
  compressedBlob: string; // 压缩图base64数据
}

/**
 * 统一的图片缓存管理函数
 * @param imageUrl 图片URL或路径
 * @param callback 图片加载完成后的回调函数
 * @returns Promise<ImageDataResult> 返回包含原图和压缩图的对象
 */
const processImageWithCache = async (
  imageUrl: string,
  callback?: (result: ImageDataResult) => void
): Promise<ImageDataResult> => {
  if (!imageUrl) {
    throw new Error("图片URL不能为空");
  }

  // 检查缓存中是否存在该图片
  const cachedImageData = await imageCache.getImageData(imageUrl);
  if (cachedImageData) {
    // console.log(`从缓存加载:`, imageUrl);
    const result: ImageDataResult = {
      originalBlob: cachedImageData.originalBlob,
      compressedBlob:
        cachedImageData.compressedBlob || cachedImageData.originalBlob
    };
    if (callback) callback(result);
    return result;
  }

  // 缓存中不存在，从服务器下载并缓存
  try {
    const res: any = await downloadFile({ objectName: imageUrl });
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        const originalBlob = reader.result as string;
        let compressedBlob = originalBlob;

        // 检查是否为PNG图片，如果是则使用PNG专用压缩
        if (imageUrl.toLowerCase().endsWith(".png")) {
          try {
            // 将base64转换为File对象进行PNG压缩
            const blob = dataURLtoBlob(originalBlob);
            const pngFile = new File([blob], "image.png", {
              type: "image/png"
            });
            const compressedPNGFile = await compressPNG(pngFile);

            // 将压缩后的PNG文件转换回base64
            const pngReader = new FileReader();
            pngReader.onloadend = async () => {
              compressedBlob = pngReader.result as string;

              // PNG专用压缩后直接存储缓存，不再进行通用压缩
              await imageCache.storeImage(
                imageUrl,
                originalBlob,
                compressedBlob
              );
              // console.log(`已缓存:`, imageUrl);

              const result: ImageDataResult = {
                originalBlob,
                compressedBlob
              };

              if (callback) callback(result);
              resolve(result);
            };
            pngReader.onerror = () => {
              console.warn("PNG压缩后转换失败，使用通用压缩");
              continueWithGeneralCompression();
            };
            pngReader.readAsDataURL(compressedPNGFile);
          } catch (error) {
            console.warn("PNG图片压缩失败，使用通用压缩:", error);
            continueWithGeneralCompression();
          }
        } else {
          // 非PNG图片直接使用通用压缩
          continueWithGeneralCompression();
        }

        async function continueWithGeneralCompression() {
          // 通用图片压缩
          try {
            compressedBlob = await compressImage(originalBlob, 0.5);
          } catch (error) {
            console.warn("通用图片压缩失败，使用原始图片:", error);
            compressedBlob = originalBlob;
          }

          // 存储到缓存（包含原图和压缩图）
          await imageCache.storeImage(imageUrl, originalBlob, compressedBlob);
          // console.log(`已缓存:`, imageUrl);

          const result: ImageDataResult = {
            originalBlob,
            compressedBlob
          };

          if (callback) callback(result);
          resolve(result);
        }
      };

      reader.onerror = () => {
        ElMessage.error(`图片${imageUrl}加载失败`);
        reject(new Error(`图片加载失败: ${imageUrl}`));
      };

      reader.readAsDataURL(res);
    });
  } catch (error) {
    ElMessage.error(`图片${imageUrl}加载失败，请检查URL是否正确`);
    throw error;
  }
};

/**
 * 清除指定图片的缓存
 * @param imageUrl 图片URL
 * @returns Promise<boolean> 是否清除成功
 */
const clearImageCache = async (imageUrl: string): Promise<boolean> => {
  return await imageCache.deleteImage(imageUrl);
};

/**
 * 清除所有图片缓存
 * @returns Promise<boolean> 是否清除成功
 */
const clearAllImageCache = async (): Promise<boolean> => {
  return await imageCache.clearAll();
};

/**
 * 检查图片是否缓存
 */
const checkImageCache = async (imageUrl: string): Promise<boolean> => {
  return await imageCache.hasImage(imageUrl);
};

/**
 * 获取图片的压缩图
 * @param imageUrl 图片URL
 * @returns Promise<string | null> 压缩图base64数据
 */
const getCompressedImage = async (imageUrl: string): Promise<string | null> => {
  return await imageCache.getImage(imageUrl, "compressedBlob");
};

/**
 * 获取图片的原图
 * @param imageUrl 图片URL
 * @returns Promise<string | null> 原图base64数据
 */
const getOriginalImage = async (imageUrl: string): Promise<string | null> => {
  return await imageCache.getImage(imageUrl, "originalBlob");
};

// 向子组件提供缓存管理函数
provide("imageCacheManager", {
  processImageWithCache,
  clearImageCache,
  clearAllImageCache,
  checkImageCache,
  getCompressedImage,
  getOriginalImage
});
//#endregion
</script>

<template>
  <div>
    <!-- 主体: 操作表格 -->
    <ExcelTable />

    <!-- 编辑图片弹窗 -->
    <EditDialog :templateImg="templateImg" ref="editDialogRef" />

    <!-- FIX: 删除自动组图弹窗 合并逻辑至编辑图片 -->
    <!-- 自动组图弹窗 -->
    <Assembling
      :templateImg="templateImg"
      :templateRow="templateRow"
      ref="assemblingRef"
    />

    <!-- 素材库弹窗 -->
    <MaterialLibrary ref="materialLibraryRef" />
  </div>
</template>
