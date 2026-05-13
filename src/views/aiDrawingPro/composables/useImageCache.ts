import { provide } from "vue";
// import { ElMessage } from "element-plus";
import { downloadFile } from "@/api/aiDraw";
import { imageCache } from "../utils/imageCache/index";
import { processImageCompression } from "../utils/compressImage/index";
import { requestQueueManager } from "../utils/requestQueue";

export interface ImageCacheData {
  originalBlob: Blob;
  compressedBlob: Blob;
  isFresh?: boolean; // 是否是最新数据
}

// 配置选项
const CACHE_CONFIG = {
  MAX_AGE: 6 * 60 * 60 * 1000, // 缓存有效期：6小时（超过此后台检查更新）
  FORCE_REFRESH_AGE: 24 * 60 * 60 * 1000 // 强制刷新时间：24小时（超过则必须更新）
};

/**
 * 下载图片并存储到缓存
 */
async function downloadAndCacheImage(
  imageUrl: string
): Promise<ImageCacheData> {
  const res: any = await downloadFile({ objectName: imageUrl });

  // 尝试从响应头获取 ETag/Last-Modified（如果是 Axios 响应）
  const etag = res.headers?.etag || res.headers?.ETag;
  const lastModified =
    res.headers?.["last-modified"] || res.headers?.["Last-Modified"];

  const originalBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`图片${imageUrl}加载失败`));
    reader.readAsDataURL(res);
  });

  const compressionResult = await processImageCompression(
    originalBase64,
    imageUrl,
    0.5
  );

  await imageCache.storeImage(
    imageUrl,
    compressionResult.originalBase64,
    compressionResult.compressedBase64,
    { etag, lastModified }
  );

  const finalCachedImageData = await imageCache.getImageData(imageUrl);
  if (!finalCachedImageData) {
    throw new Error(`图片${imageUrl}缓存失败`);
  }

  return {
    originalBlob: finalCachedImageData.originalBlob,
    compressedBlob:
      finalCachedImageData.compressedBlob || finalCachedImageData.originalBlob,
    isFresh: true
  };
}

/**
 * 核心请求处理器：智能缓存策略
 */
// const imageRequestHandler = async (
//   imageUrl: string,
//   options?: { forceRefresh?: boolean }
// ): Promise<ImageCacheData> => {
//   if (!imageUrl) {
//     throw new Error("图片URL不能为空");
//   }

//   const cachedImageData = await imageCache.getImageData(imageUrl);

//   // 强制刷新或无缓存：直接下载
//   if (options?.forceRefresh || !cachedImageData) {
//     return downloadAndCacheImage(imageUrl);
//   }

//   // 有缓存且在强制刷新时间内：直接返回缓存
//   const cacheAge = Date.now() - cachedImageData.timestamp;
//   if (cacheAge < CACHE_CONFIG.MAX_AGE) {
//     return {
//       originalBlob: cachedImageData.originalBlob,
//       compressedBlob:
//         cachedImageData.compressedBlob || cachedImageData.originalBlob,
//       isFresh: false
//     };
//   }

//   // 缓存较老但未过期：先返回缓存，后台检查更新
//   // 这里先返回缓存，后续通过回调机制更新
//   return {
//     originalBlob: cachedImageData.originalBlob,
//     compressedBlob:
//       cachedImageData.compressedBlob || cachedImageData.originalBlob,
//     isFresh: false
//   };
// };

export function useImageCache() {
  // 跟踪正在后台刷新的图片，避免重复刷新
  const backgroundRefreshTasks = new Map<string, Promise<void>>();

  /**
   * 核心方法：智能加载图片
   * 策略：先显示缓存 -> 后台检查更新 -> 发现新版本时回调更新
   */
  const processImageWithCache = async (
    imageUrl: string,
    options?: {
      onUpdate?: (result: ImageCacheData) => void; // 发现新版本时的回调
      forceRefresh?: boolean; // 强制刷新
    }
  ): Promise<ImageCacheData> => {
    if (!imageUrl) {
      throw new Error("图片URL不能为空");
    }

    const { onUpdate, forceRefresh } = options || {};

    // 首先尝试获取缓存
    const cachedData = await imageCache.getImageData(imageUrl);
    const hasCache = !!cachedData;

    // 如果没有缓存，或者强制刷新，直接下载
    if (!hasCache || forceRefresh) {
      const result = await requestQueueManager.addRequest(
        "image",
        imageUrl,
        () => downloadAndCacheImage(imageUrl)
      );
      return result;
    }

    // 有缓存，先返回缓存数据
    const cacheResult: ImageCacheData = {
      originalBlob: cachedData.originalBlob,
      compressedBlob: cachedData.compressedBlob || cachedData.originalBlob,
      isFresh: false
    };

    // 检查缓存是否需要后台刷新
    const cacheAge = Date.now() - cachedData.timestamp;

    // 如果缓存超过 MAX_AGE，后台检查更新
    if (cacheAge > CACHE_CONFIG.MAX_AGE && onUpdate) {
      // 避免重复刷新同一图片
      if (!backgroundRefreshTasks.has(imageUrl)) {
        const refreshTask = (async () => {
          try {
            console.log(`[ImageCache] 后台刷新图片: ${imageUrl}`);
            const freshData = await downloadAndCacheImage(imageUrl);
            onUpdate(freshData);
          } catch (error) {
            console.warn(`[ImageCache] 后台刷新失败: ${imageUrl}`, error);
            // 后台刷新失败不影响，继续用旧缓存
          } finally {
            backgroundRefreshTasks.delete(imageUrl);
          }
        })();

        backgroundRefreshTasks.set(imageUrl, refreshTask);
      }
    }

    return cacheResult;
  };

  /**
   * 强制刷新图片（忽略缓存）
   */
  const refreshImage = async (imageUrl: string): Promise<ImageCacheData> => {
    await imageCache.deleteImage(imageUrl);
    return requestQueueManager.addRequest("image", imageUrl, () =>
      downloadAndCacheImage(imageUrl)
    );
  };

  /**
   * 批量检查并刷新过期缓存
   * 适用于应用启动时
   */
  const refreshExpiredCaches = async (
    imageUrls: string[],
    onUpdate?: (url: string, data: ImageCacheData) => void
  ): Promise<void> => {
    for (const url of imageUrls) {
      const isExpired = await imageCache.isCacheExpired(
        url,
        CACHE_CONFIG.MAX_AGE
      );
      if (isExpired) {
        try {
          const data = await refreshImage(url);
          onUpdate?.(url, data);
        } catch (e) {
          // 单个刷新失败不影响其他
        }
      }
    }
  };

  const isImageLoading = (imageUrl: string): boolean => {
    return requestQueueManager.isRequestPending("image", imageUrl);
  };

  const cancelImageLoading = (imageUrl: string): boolean => {
    return requestQueueManager.cancelRequest("image", imageUrl);
  };

  const clearImageCache = async (imageUrl: string): Promise<boolean> => {
    backgroundRefreshTasks.delete(imageUrl);
    return await imageCache.deleteImage(imageUrl);
  };

  const clearAllImageCache = async (): Promise<boolean> => {
    backgroundRefreshTasks.clear();
    return await imageCache.clearAll();
  };

  const checkImageCache = async (imageUrl: string): Promise<boolean> => {
    return await imageCache.hasImage(imageUrl);
  };

  const getCacheMetadata = async (imageUrl: string) => {
    return imageCache.getCacheMetadata(imageUrl);
  };

  const getCompressedImage = async (
    imageUrl: string
  ): Promise<string | null> => {
    return await imageCache.getImageURL(imageUrl, "compressedBlob");
  };

  const getOriginalImage = async (imageUrl: string): Promise<string | null> => {
    return await imageCache.getImageURL(imageUrl, "originalBlob");
  };

  const cacheManager = {
    processImageWithCache,
    refreshImage,
    refreshExpiredCaches,
    clearImageCache,
    clearAllImageCache,
    checkImageCache,
    getCacheMetadata,
    getCompressedImage,
    getOriginalImage,
    getQueueStatus: () => requestQueueManager.getQueueStatus(),
    clearQueue: () => requestQueueManager.clearQueue(),
    cancelRequest: (id: string, params?: any) =>
      requestQueueManager.cancelRequest(id, params),
    setMaxConcurrent: (max: number) =>
      requestQueueManager.setMaxConcurrent(max),
    isImageLoading,
    cancelImageLoading,
    getRunningRequests: () => requestQueueManager.getRunningRequests(),
    // 导出配置供外部调整
    config: CACHE_CONFIG
  };

  provide("imageCacheManager", cacheManager);

  return cacheManager;
}
