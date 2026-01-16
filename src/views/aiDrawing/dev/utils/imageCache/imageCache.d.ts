/**
 * 图片缓存工具类类型定义
 */

export interface ImageData {
  id: string;
  originalBlob: string; // 源文件base64数据
  compressedBlob?: string; // 压缩后的base64数据
  timestamp: number;
}

export interface CacheStats {
  total: number;
  size: number;
}

export declare class ImageCache {
  storeImage(
    id: string,
    originalBlob: string,
    compressedBlob?: string
  ): Promise<boolean>;
  getImage(
    id: string,
    type?: "originalBlob" | "compressedBlob"
  ): Promise<string | null>;
  getImageData(id: string): Promise<ImageData | null>;
  deleteImage(id: string): Promise<boolean>;
  getAllImageIds(): Promise<string[]>;
  clearAll(): Promise<boolean>;
  hasImage(id: string): Promise<boolean>;
  getStats(): Promise<CacheStats>;
  updateCompressedBlob(id: string, compressedBlob: string): Promise<boolean>;
  updateOriginalBlob(id: string, originalBlob: string): Promise<boolean>;
}

export declare const imageCache: ImageCache;
