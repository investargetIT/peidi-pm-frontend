/**
 * 图片缓存工具类 - 基于IndexedDB的图片存储管理
 * 支持图片Blob数据的存储、检索和删除
 */
import { blobManager } from "../blobManager";

interface ImageData {
  id: string;
  originalBlob: Blob; // 源文件Blob数据
  compressedBlob: Blob; // 压缩后的Blob数据
  timestamp: number; // 存储时间戳
}

class ImageCache {
  private dbName: string = "ImageCacheDB";
  private storeName: string = "images";
  private version: number = 2; // 增加版本号以触发数据库升级
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库连接
   */
  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 删除旧的对象存储空间（如果存在）
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }

        // 创建新的对象存储空间
        const store = db.createObjectStore(this.storeName, { keyPath: "id" });
        // 创建索引以便按id快速查找
        store.createIndex("id", "id", { unique: true });
        store.createIndex("timestamp", "timestamp", { unique: false });
      };
    });
  }

  /**
   * 存储图片数据（支持base64字符串或Blob对象）
   * @param id 图片ID (如: "/ai/1.png")
   * @param originalData 源文件数据（base64字符串或Blob对象）
   * @param compressedData 压缩后的数据（base64字符串或Blob对象）
   * @returns Promise<boolean> 存储是否成功
   */
  public async storeImage(
    id: string,
    originalData: string | Blob,
    compressedData: string | Blob
  ): Promise<boolean> {
    try {
      const db = await this.initDB();

      // 转换数据为Blob对象
      const originalBlob =
        typeof originalData === "string"
          ? blobManager.base64ToBlob(originalData)
          : originalData;

      const compressedBlob =
        typeof compressedData === "string"
          ? blobManager.base64ToBlob(compressedData)
          : compressedData;

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);

        const imageData: ImageData = {
          id,
          originalBlob,
          compressedBlob,
          timestamp: Date.now()
        };

        const request = store.put(imageData);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("存储图片失败:", error);
      return false;
    }
  }

  /**
   * 根据ID查找图片数据并返回Blob URL
   * @param id 图片ID
   * @param type 图片类型：'originalBlob' | 'compressedBlob'，默认为'compressedBlob'
   * @returns Promise<string | null> 返回Blob URL，未找到返回null
   */
  public async getImageURL(
    id: string,
    type: "originalBlob" | "compressedBlob" = "compressedBlob"
  ): Promise<string | null> {
    try {
      const blob = await this.getImageBlob(id, type);
      if (!blob) return null;

      // 使用Blob管理器创建URL并管理引用
      return blobManager.createBlobURL(id, blob);
    } catch (error) {
      console.error("获取图片URL失败:", error);
      return null;
    }
  }

  /**
   * 根据ID查找图片Blob对象
   * @param id 图片ID
   * @param type 图片类型：'originalBlob' | 'compressedBlob'，默认为'compressedBlob'
   * @returns Promise<Blob | null> 返回Blob对象，未找到返回null
   */
  public async getImageBlob(
    id: string,
    type: "originalBlob" | "compressedBlob" = "compressedBlob"
  ): Promise<Blob | null> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);

        const request = store.get(id);

        request.onsuccess = () => {
          const result: ImageData | undefined = request.result;
          if (!result) {
            resolve(null);
            return;
          }

          let data: Blob | undefined;
          switch (type) {
            case "compressedBlob":
              data = result.compressedBlob;
              break;
            default:
              data = result.originalBlob;
          }

          resolve(data || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("获取图片失败:", error);
      return null;
    }
  }

  /**
   * 释放图片URL引用
   * @param id 图片ID
   */
  public releaseImageURL(id: string): void {
    blobManager.releaseBlobURL(id);
  }

  /**
   * 获取完整的图片数据对象
   * @param id 图片ID
   * @returns Promise<ImageData | null> 返回完整的图片数据对象
   */
  public async getImageData(id: string): Promise<ImageData | null> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);

        const request = store.get(id);

        request.onsuccess = () => {
          const result: ImageData | undefined = request.result;
          resolve(result || null);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("获取图片数据失败:", error);
      return null;
    }
  }

  /**
   * 根据ID删除图片数据
   * @param id 图片ID
   * @returns Promise<boolean> 删除是否成功
   */
  public async deleteImage(id: string): Promise<boolean> {
    try {
      // 先释放URL引用
      blobManager.releaseBlobURL(id);

      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);

        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("删除图片失败:", error);
      return false;
    }
  }

  /**
   * 清空所有图片缓存
   * @returns Promise<boolean> 清空是否成功
   */
  public async clearAll(): Promise<boolean> {
    try {
      // 释放所有URL引用
      blobManager.releaseAll();

      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readwrite");
        const store = transaction.objectStore(this.storeName);

        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("清空图片缓存失败:", error);
      return false;
    }
  }

  /**
   * 检查图片是否存在
   * @param id 图片ID
   * @returns Promise<boolean> 是否存在
   */
  public async hasImage(id: string): Promise<boolean> {
    try {
      const imageData = await this.getImageData(id);
      return imageData !== null;
    } catch (error) {
      console.error("检查图片存在性失败:", error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns Promise<{ total: number, size: number }> 缓存统计
   */
  public async getStats(): Promise<{ total: number; size: number }> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], "readonly");
        const store = transaction.objectStore(this.storeName);

        const request = store.getAll();

        request.onsuccess = () => {
          const images: ImageData[] = request.result;
          const total = images.length;
          // 计算总大小（字节）
          const size = images.reduce((acc, img) => {
            return acc + img.originalBlob.size + img.compressedBlob.size;
          }, 0);

          resolve({ total, size });
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("获取缓存统计失败:", error);
      return { total: 0, size: 0 };
    }
  }

  /**
   * 获取Blob管理器统计信息
   * @returns { total: number, size: number } Blob管理器统计
   */
  public getBlobManagerStats(): { total: number; size: number } {
    return blobManager.getStats();
  }
}

// 创建单例实例
export const imageCache = new ImageCache();
