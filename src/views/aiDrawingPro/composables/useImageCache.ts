import { provide } from "vue";
import { ElMessage } from "element-plus";
import { downloadFile } from "@/api/aiDraw";
import { imageCache } from "../utils/imageCache/index";
import { processImageCompression } from "../utils/compressImage/index";
import { requestQueueManager } from "../utils/requestQueue";

export interface ImageCacheData {
  originalBlob: Blob;
  compressedBlob: Blob;
}

const imageRequestHandler = async (
  imageUrl: string
): Promise<ImageCacheData> => {
  if (!imageUrl) {
    throw new Error("图片URL不能为空");
  }

  const cachedImageData = await imageCache.getImageData(imageUrl);
  if (cachedImageData) {
    return {
      originalBlob: cachedImageData.originalBlob,
      compressedBlob:
        cachedImageData.compressedBlob || cachedImageData.originalBlob
    };
  }

  try {
    const res: any = await downloadFile({ objectName: imageUrl });
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
      compressionResult.compressedBase64
    );

    const finalCachedImageData = await imageCache.getImageData(imageUrl);
    if (finalCachedImageData) {
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

export function useImageCache() {
  const processImageWithCache = async (
    imageUrl: string,
    callback?: (result: ImageCacheData) => void
  ): Promise<ImageCacheData> => {
    if (!imageUrl) {
      throw new Error("图片URL不能为空");
    }

    const result = await requestQueueManager.addRequest(
      "image",
      imageUrl,
      imageRequestHandler
    );

    if (callback) {
      callback(result);
    }

    return result;
  };

  const isImageLoading = (imageUrl: string): boolean => {
    return requestQueueManager.isRequestPending("image", imageUrl);
  };

  const cancelImageLoading = (imageUrl: string): boolean => {
    return requestQueueManager.cancelRequest("image", imageUrl);
  };

  const clearImageCache = async (imageUrl: string): Promise<boolean> => {
    return await imageCache.deleteImage(imageUrl);
  };

  const clearAllImageCache = async (): Promise<boolean> => {
    return await imageCache.clearAll();
  };

  const checkImageCache = async (imageUrl: string): Promise<boolean> => {
    return await imageCache.hasImage(imageUrl);
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
    clearImageCache,
    clearAllImageCache,
    checkImageCache,
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
    getRunningRequests: () => requestQueueManager.getRunningRequests()
  };

  provide("imageCacheManager", cacheManager);

  return cacheManager;
}
