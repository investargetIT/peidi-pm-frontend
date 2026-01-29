/**
 * Blob对象管理单例
 * 负责管理Blob对象、URL转换和内存管理
 */
interface BlobRecord {
  blob: Blob;
  url: string;
  refCount: number; // 引用计数
  timestamp: number; // 创建时间戳
}

class BlobManager {
  private static instance: BlobManager;
  private blobMap: Map<string, BlobRecord> = new Map();
  private maxCacheSize: number = 50; // 最大缓存数量
  private cleanupInterval: number = 5 * 60 * 1000; // 5分钟清理一次
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // this.startCleanupTimer();
  }

  public static getInstance(): BlobManager {
    if (!BlobManager.instance) {
      BlobManager.instance = new BlobManager();
    }
    return BlobManager.instance;
  }

  /**
   * 将base64字符串转换为Blob对象
   * @param base64Data base64格式的图片数据
   * @param mimeType 图片MIME类型，默认为'image/png'
   * @returns Blob对象
   */
  public base64ToBlob(
    base64Data: string,
    defaultMimeType: string = "image/png"
  ): Blob {
    // 检查是否有data:前缀，如果有则提取MIME类型和base64数据
    let base64: string;
    let mimeType: string;

    if (base64Data.startsWith("data:")) {
      const parts = base64Data.split(",");
      mimeType = parts[0].match(/:(.*?);/)?.[1] || defaultMimeType;
      base64 = parts[1] || base64Data;
    } else {
      // 如果没有data:前缀，则使用默认MIME类型
      base64 = base64Data;
      mimeType = defaultMimeType;
    }

    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  }

  /**
   * 将Blob对象转换为base64字符串
   * @param blob Blob对象
   * @returns Promise<string> base64字符串
   */
  public blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 创建Blob URL并管理引用
   * @param blobId 唯一标识符（通常是图片ID）
   * @param blob Blob对象
   * @returns string Blob URL
   */
  public createBlobURL(blobId: string, blob: Blob): string {
    let record = this.blobMap.get(blobId);

    if (record) {
      // 已存在，增加引用计数
      record.refCount++;
      record.timestamp = Date.now();
      return record.url;
    }

    // 创建新的Blob URL
    const url = URL.createObjectURL(blob);
    record = {
      blob,
      url,
      refCount: 1,
      timestamp: Date.now()
    };

    this.blobMap.set(blobId, record);

    // 检查缓存大小，如果超过限制则清理最旧的
    // if (this.blobMap.size > this.maxCacheSize) {
    //   this.cleanupOldest();
    // }

    return url;
  }

  /**
   * 获取Blob URL（如果存在）
   * @param blobId 唯一标识符
   * @returns string | null Blob URL或null
   */
  public getBlobURL(blobId: string): string | null {
    const record = this.blobMap.get(blobId);
    if (record) {
      record.refCount++;
      record.timestamp = Date.now();
      return record.url;
    }
    return null;
  }

  /**
   * 释放Blob URL引用
   * @param blobId 唯一标识符
   */
  public releaseBlobURL(blobId: string): void {
    const record = this.blobMap.get(blobId);
    if (!record) return;

    record.refCount--;

    if (record.refCount <= 0) {
      // 释放URL并删除记录
      URL.revokeObjectURL(record.url);
      this.blobMap.delete(blobId);
    }
  }

  /**
   * 强制释放所有Blob URL
   */
  public releaseAll(): void {
    for (const [blobId, record] of this.blobMap) {
      URL.revokeObjectURL(record.url);
      this.blobMap.delete(blobId);
    }
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): { total: number; size: number } {
    let totalSize = 0;
    this.blobMap.forEach(record => {
      totalSize += record.blob.size;
    });

    return {
      total: this.blobMap.size,
      size: totalSize
    };
  }

  /**
   * 设置最大缓存大小
   * @param size 最大缓存数量
   */
  public setMaxCacheSize(size: number): void {
    this.maxCacheSize = size;
    while (this.blobMap.size > this.maxCacheSize) {
      this.cleanupOldest();
    }
  }

  /**
   * 清理最旧的缓存项
   */
  private cleanupOldest(): void {
    if (this.blobMap.size === 0) return;

    let oldestId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, record] of this.blobMap) {
      if (record.refCount === 0 && record.timestamp < oldestTimestamp) {
        oldestId = id;
        oldestTimestamp = record.timestamp;
      }
    }

    // 如果没有引用计数为0的项，清理最旧的
    if (oldestId === null) {
      for (const [id, record] of this.blobMap) {
        if (record.timestamp < oldestTimestamp) {
          oldestId = id;
          oldestTimestamp = record.timestamp;
        }
      }
    }

    if (oldestId) {
      const record = this.blobMap.get(oldestId)!;
      URL.revokeObjectURL(record.url);
      this.blobMap.delete(oldestId);
    }
  }

  /**
   * 启动定时清理
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupInterval);
  }

  /**
   * 清理过期缓存（30分钟未使用）
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const expirationTime = 30 * 60 * 1000; // 30分钟

    for (const [blobId, record] of this.blobMap) {
      if (record.refCount === 0 && now - record.timestamp > expirationTime) {
        URL.revokeObjectURL(record.url);
        this.blobMap.delete(blobId);
      }
    }
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.releaseAll();
  }
}

// 创建单例实例
export const blobManager = BlobManager.getInstance();
