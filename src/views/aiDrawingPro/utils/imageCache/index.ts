/**
 * 图片缓存工具类 - 基于IndexedDB的图片存储管理
 * 支持图片base64数据的存储、检索和删除
 */

interface ImageData {
  id: string;
  originalBlob: string; // 源文件base64数据
  compressedBlob: string; // 压缩后的base64数据
  timestamp: number; // 存储时间戳
}

class ImageCache {
  private dbName: string = "ImageCacheDB";
  private storeName: string = "images";
  private version: number = 1;
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

        // 创建对象存储空间
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "id" });
          // 创建索引以便按id快速查找
          store.createIndex("id", "id", { unique: true });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * 存储图片数据
   * @param id 图片ID (如: "/ai/1.png")
   * @param originalBlob 源文件base64格式的图片数据
   * @param compressedBlob 压缩后的base64数据（可选）
   * @returns Promise<boolean> 存储是否成功
   */
  public async storeImage(
    id: string,
    originalBlob: string,
    compressedBlob: string
  ): Promise<boolean> {
    try {
      const db = await this.initDB();

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
   * 根据ID查找图片数据
   * @param id 图片ID
   * @param type 图片类型：'originalBlob' | 'compressedBlob'，默认为'compressedBlob'
   * @returns Promise<string | null> 返回base64数据，未找到返回null
   */
  public async getImage(
    id: string,
    type: "originalBlob" | "compressedBlob" = "compressedBlob"
  ): Promise<string | null> {
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

          let data: string | undefined;
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
      const image = await this.getImage(id);
      return image !== null;
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
          // 估算总大小（字节）
          const size = images.reduce((acc, img) => {
            // base64数据大小估算：每字符约0.75字节
            return (
              acc +
              Math.floor(
                (img.originalBlob.length + img.compressedBlob.length) * 0.75
              )
            );
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
}

// 创建单例实例
export const imageCache = new ImageCache();
