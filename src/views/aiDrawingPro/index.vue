<script setup lang="ts">
import { provide, ref, watch } from "vue";
import { downloadFile } from "@/api/aiDraw";
import { ElMessage } from "element-plus";
import Material from "./components/material/index.vue";
import Drawing from "./components/drawing/index.vue";
import Creative from "./components/creative/index.vue";
import { imageCache } from "./utils/imageCache/index";
import { processImageCompression } from "./utils/compressImage/index";
import { blobManager } from "./utils/blobManager";
import { requestQueueManager } from "./utils/requestQueue";

// 自定义缓存图片类型
export interface ImageCacheData {
  originalBlob: Blob;
  compressedBlob: Blob;
}

//#region 图片缓存逻辑（使用带去重功能的通用请求队列）
/**
 * 图片请求处理函数
 * @param imageUrl 图片URL
 * @returns Promise<ImageCacheData>
 */
const imageRequestHandler = async (
  imageUrl: string
): Promise<ImageCacheData> => {
  if (!imageUrl) {
    throw new Error("图片URL不能为空");
  }

  // 检查缓存中是否存在该图片
  const cachedImageData = await imageCache.getImageData(imageUrl);
  if (cachedImageData) {
    // console.log(`从缓存加载:`, imageUrl);
    return {
      originalBlob: cachedImageData.originalBlob,
      compressedBlob:
        cachedImageData.compressedBlob || cachedImageData.originalBlob
    };
  }

  // 缓存中不存在，从服务器下载并缓存
  try {
    const res: any = await downloadFile({ objectName: imageUrl });
    const originalBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`图片${imageUrl}加载失败`));
      reader.readAsDataURL(res);
    });

    // 使用统一的图片压缩处理函数
    const compressionResult = await processImageCompression(
      originalBase64,
      imageUrl,
      0.5
    );

    // 存储到缓存
    await imageCache.storeImage(
      imageUrl,
      compressionResult.originalBase64,
      compressionResult.compressedBase64
    );

    // 从缓存获取最终数据
    const finalCachedImageData = await imageCache.getImageData(imageUrl);
    if (finalCachedImageData) {
      // console.log(`图片 ${imageUrl} 下载并缓存成功`);
      return {
        originalBlob: finalCachedImageData.originalBlob,
        compressedBlob:
          finalCachedImageData.compressedBlob ||
          finalCachedImageData.originalBlob
      };
    } else {
      throw new Error(`图片${imageUrl}缓存失败`);
    }
  } catch (error) {
    ElMessage.error(`图片${imageUrl}加载失败: ${error}`);
    throw error;
  }
};

/**
 * 统一的图片缓存管理函数（使用带去重功能的通用请求队列）
 * @param imageUrl 图片URL或路径
 * @param callback 图片加载完成后的回调函数
 * @returns Promise<ImageCacheData> 返回包含原图和压缩图的对象
 */
const processImageWithCache = async (
  imageUrl: string,
  callback?: (result: ImageCacheData) => void
): Promise<ImageCacheData> => {
  if (!imageUrl) {
    throw new Error("图片URL不能为空");
  }

  // 使用带去重功能的通用请求队列管理器处理请求
  const result = await requestQueueManager.addRequest(
    `image`, // 使用统一的ID，便于去重
    imageUrl, // 参数（图片URL）
    imageRequestHandler // 处理函数
  );

  // 执行回调函数
  if (callback) {
    callback(result);
  }

  return result;
};

/**
 * 检查图片请求是否正在进行中
 * @param imageUrl 图片URL
 * @returns 是否正在进行中
 */
const isImageLoading = (imageUrl: string): boolean => {
  return requestQueueManager.isRequestPending("image", imageUrl);
};

/**
 * 取消特定的图片加载请求
 * @param imageUrl 图片URL
 * @returns 是否取消成功
 */
const cancelImageLoading = (imageUrl: string): boolean => {
  return requestQueueManager.cancelRequest("image", imageUrl);
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
  return await imageCache.getImageURL(imageUrl, "compressedBlob");
};

/**
 * 获取图片的原图
 * @param imageUrl 图片URL
 * @returns Promise<string | null> 原图base64数据
 */
const getOriginalImage = async (imageUrl: string): Promise<string | null> => {
  return await imageCache.getImageURL(imageUrl, "originalBlob");
};

// 向子组件提供缓存管理函数
provide("imageCacheManager", {
  processImageWithCache,
  clearImageCache,
  clearAllImageCache,
  checkImageCache,
  getCompressedImage,
  getOriginalImage,
  // 提供队列管理功能
  getQueueStatus: () => requestQueueManager.getQueueStatus(),
  clearQueue: () => requestQueueManager.clearQueue(),
  cancelRequest: (id: string, params?: any) =>
    requestQueueManager.cancelRequest(id, params),
  setMaxConcurrent: (max: number) => requestQueueManager.setMaxConcurrent(max),
  // 新增的去重相关功能
  isImageLoading,
  cancelImageLoading,
  getRunningRequests: () => requestQueueManager.getRunningRequests()
});
//#endregion

const drawingTabRef = ref(null);
const materialTabRef = ref(null);
const activeTab = ref("Drawing");

watch(activeTab, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    if (newVal === "Drawing") {
      drawingTabRef.value?.fetchMaterialPage();
    }
    if (newVal === "Material") {
      materialTabRef.value?.fetchMaterialPage();
    }
  }
});

const creativeTabRef = ref(null);
const initCreativeStudio = (url: string) => {
  activeTab.value = "Creative";
  creativeTabRef.value?.initCreativeStudio(url);
};
provide("initCreativeStudio", initCreativeStudio);
</script>

<template>
  <el-tabs
    type="border-card"
    v-model="activeTab"
    class="peidi-el-tabs-modern-tabs"
  >
    <el-tab-pane label="绘图" name="Drawing"
      ><Drawing ref="drawingTabRef" />
    </el-tab-pane>
    <el-tab-pane label="素材库" name="Material"
      ><Material ref="materialTabRef" />
    </el-tab-pane>
    <el-tab-pane label="创意工作室" name="Creative"
      ><Creative ref="creativeTabRef"
    /></el-tab-pane>
  </el-tabs>
</template>
