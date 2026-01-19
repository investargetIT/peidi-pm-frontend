<script setup lang="ts">
import { provide, ref } from "vue";
import { downloadFile } from "@/api/aiDraw";
import { ElMessage } from "element-plus";
import Material from "./components/material/index.vue";
import Drawing from "./components/drawing/index.vue";
import { imageCache } from "./utils/imageCache/index";
import {
  processImageCompression,
  type ImageDataResult
} from "./utils/compressImage/index";

//#region 图片缓存逻辑
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

        // 使用统一的图片压缩处理函数
        const result = await processImageCompression(
          originalBlob,
          imageUrl,
          0.5
        );

        // 存储到缓存（包含原图和压缩图）
        await imageCache.storeImage(
          imageUrl,
          result.originalBlob,
          result.compressedBlob
        );
        // console.log(`已缓存:`, imageUrl);

        if (callback) callback(result);
        resolve(result);
      };

      reader.onerror = error => {
        ElMessage.error(`图片${imageUrl}加载失败: ${error}`);
        reject(new Error(`图片${imageUrl}加载失败: ${error}`));
      };

      reader.readAsDataURL(res);
    });
  } catch (error) {
    ElMessage.error(`图片${imageUrl}加载失败: ${error}`);
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

const activeTab = ref("Material");
</script>

<template>
  <el-tabs
    type="border-card"
    v-model="activeTab"
    class="peidi-el-tabs-modern-tabs"
  >
    <el-tab-pane label="素材库" name="Material"><Material /></el-tab-pane>
    <el-tab-pane label="绘图" name="Drawing"><Drawing /></el-tab-pane>
  </el-tabs>
</template>
