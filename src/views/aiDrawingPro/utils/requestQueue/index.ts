/**
 * 通用请求队列管理器（单例模式）
 * 控制并发请求数量，防止过多请求导致页面卡顿
 */

/**
 * 请求处理器接口
 */
export interface RequestHandler<T = any> {
  (params: any): Promise<T>;
}

/**
 * 请求队列项接口
 */
export interface QueueItem<T = any> {
  id: string; // 请求唯一标识
  params: any; // 请求参数
  handler: RequestHandler<T>; // 请求处理函数
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  priority?: number; // 优先级（可选）
}

/**
 * 队列状态接口
 */
export interface QueueStatus {
  currentRunning: number;
  queueLength: number;
  maxConcurrent: number;
  pendingRequests: number; // 等待中的请求数（包括队列中的和正在运行的）
}

/**
 * 正在执行的请求信息
 */
interface RunningRequest<T = any> {
  id: string;
  promise: Promise<T>;
  startTime: number;
}

/**
 * 通用请求队列管理器（单例模式）
 */
export class RequestQueueManager {
  private static instance: RequestQueueManager;
  private maxConcurrent: number = 3; // 最大并发数
  private currentRunning: number = 0; // 当前正在运行的请求数
  private queue: QueueItem[] = []; // 等待队列
  private runningRequests: Map<string, RunningRequest> = new Map(); // 正在执行的请求
  private pendingPromises: Map<string, Promise<any>> = new Map(); // 等待中的Promise（用于去重）

  private constructor() {
    // 私有构造函数，确保单例
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): RequestQueueManager {
    if (!RequestQueueManager.instance) {
      RequestQueueManager.instance = new RequestQueueManager();
    }
    return RequestQueueManager.instance;
  }

  /**
   * 设置最大并发数
   * @param max 最大并发数
   */
  public setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, max);
  }

  /**
   * 添加请求到队列（带去重功能）
   * @param id 请求唯一标识
   * @param params 请求参数
   * @param handler 请求处理函数
   * @param priority 优先级（可选）
   * @returns Promise<T>
   */
  async addRequest<T>(
    id: string,
    params: any,
    handler: RequestHandler<T>,
    priority?: number
  ): Promise<T> {
    // 检查是否已经有相同的请求正在执行或等待中
    const existingPromise = this.getExistingPromise<T>(id, params);
    if (existingPromise) {
      // console.log(`请求 ${id} 已存在，复用现有请求`);
      return existingPromise;
    }

    return new Promise((resolve, reject) => {
      const queueItem: QueueItem<T> = {
        id,
        params,
        handler,
        resolve,
        reject,
        priority
      };

      // 存储Promise以便去重
      const promise = new Promise<T>((innerResolve, innerReject) => {
        queueItem.resolve = innerResolve;
        queueItem.reject = innerReject;
      });

      this.pendingPromises.set(this.getRequestKey(id, params), promise);

      // 如果设置了优先级，插入到合适位置
      if (priority !== undefined) {
        this.insertWithPriority(queueItem);
      } else {
        this.queue.push(queueItem);
      }

      // console.log(`请求 ${id} 已加入队列，当前队列长度: ${this.queue.length}`);

      // 尝试执行请求
      this.tryExecuteNext();

      // 返回存储的Promise
      promise.then(resolve).catch(reject);
    });
  }

  /**
   * 检查是否存在相同的请求
   * @param id 请求ID
   * @param params 请求参数
   * @returns 存在的Promise或null
   */
  private getExistingPromise<T>(id: string, params: any): Promise<T> | null {
    const requestKey = this.getRequestKey(id, params);

    // 检查是否已经有相同的请求正在执行
    const runningRequest = this.runningRequests.get(requestKey);
    if (runningRequest) {
      // console.log(`请求 ${id} 正在执行中，复用现有请求`);
      return runningRequest.promise as Promise<T>;
    }

    // 检查是否已经有相同的请求在等待队列中
    const pendingPromise = this.pendingPromises.get(requestKey);
    if (pendingPromise) {
      // console.log(`请求 ${id} 已在等待队列中，复用现有请求`);
      return pendingPromise as Promise<T>;
    }

    return null;
  }

  /**
   * 生成请求的唯一键
   * @param id 请求ID
   * @param params 请求参数
   * @returns 唯一键
   */
  private getRequestKey(id: string, params: any): string {
    // 简单的键生成策略，可以根据需要调整
    if (typeof params === "string") {
      return `${id}_${params}`;
    } else if (typeof params === "object" && params !== null) {
      // 对于对象参数，使用JSON序列化（注意：这可能会影响性能，可以根据实际情况优化）
      try {
        return `${id}_${JSON.stringify(params)}`;
      } catch {
        // 如果序列化失败，使用默认方式
        return `${id}_${String(params)}`;
      }
    } else {
      return `${id}_${String(params)}`;
    }
  }

  /**
   * 按优先级插入队列项
   * @param item 队列项
   */
  private insertWithPriority(item: QueueItem): void {
    if (item.priority === undefined) {
      this.queue.push(item);
      return;
    }

    // 找到第一个优先级小于当前项的插入位置
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const currentPriority = this.queue[i].priority ?? 0;
      if (currentPriority < (item.priority ?? 0)) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, item);
  }

  /**
   * 尝试执行下一个请求
   */
  private tryExecuteNext(): void {
    // 如果当前运行数小于最大并发数且队列不为空，执行下一个请求
    if (this.currentRunning < this.maxConcurrent && this.queue.length > 0) {
      const nextItem = this.queue.shift();
      if (nextItem) {
        this.executeRequest(nextItem);
      }
    }
  }

  /**
   * 执行请求
   * @param queueItem 队列项
   */
  private async executeRequest<T>(queueItem: QueueItem<T>) {
    const requestKey = this.getRequestKey(queueItem.id, queueItem.params);

    // 检查是否已经有相同的请求正在执行（双重检查）
    if (this.runningRequests.has(requestKey)) {
      // console.log(`请求 ${queueItem.id} 已在执行中，跳过重复执行`);
      this.tryExecuteNext();
      return;
    }

    this.currentRunning++;

    // 创建执行Promise - 修复变量提升问题
    let executionPromise: Promise<T>;
    executionPromise = (async () => {
      try {
        // 记录开始时间
        const startTime = Date.now();

        // 添加到正在执行的请求映射
        this.runningRequests.set(requestKey, {
          id: queueItem.id,
          promise: executionPromise,
          startTime
        });

        // console.log(`开始执行请求 ${queueItem.id}，当前运行数: ${this.currentRunning}`);

        // 调用外部传入的处理函数
        const result = await queueItem.handler(queueItem.params);

        // console.log(`请求 ${queueItem.id} 执行成功，耗时: ${Date.now() - startTime}ms`);
        queueItem.resolve(result);
        return result;
      } catch (error) {
        console.error(`请求 ${queueItem.id} 执行失败:`, error);
        queueItem.reject(error);
        throw error;
      } finally {
        this.completeRequest(requestKey);
      }
    })();

    // 等待请求完成
    await executionPromise;
  }

  /**
   * 完成请求，处理下一个队列项
   * @param requestKey 请求键
   */
  private completeRequest(requestKey: string): void {
    this.currentRunning--;

    // 清理资源
    this.runningRequests.delete(requestKey);
    this.pendingPromises.delete(requestKey);

    // console.log(`请求完成，当前运行数: ${this.currentRunning}`);

    // 尝试执行下一个请求
    this.tryExecuteNext();
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): QueueStatus {
    return {
      currentRunning: this.currentRunning,
      queueLength: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      pendingRequests: this.runningRequests.size + this.queue.length
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue.forEach(item => {
      const requestKey = this.getRequestKey(item.id, item.params);
      this.pendingPromises.delete(requestKey);
      item.reject(new Error("队列已清空"));
    });
    this.queue = [];
    // console.log('请求队列已清空');
  }

  /**
   * 根据ID取消特定请求
   * @param id 请求ID
   * @param params 请求参数（可选，用于精确匹配）
   */
  cancelRequest(id: string, params?: any): boolean {
    let cancelled = false;

    // 取消队列中的请求
    const queueIndex = this.queue.findIndex(item => {
      if (params !== undefined) {
        return (
          item.id === id &&
          this.getRequestKey(id, params) ===
            this.getRequestKey(item.id, item.params)
        );
      }
      return item.id === id;
    });

    if (queueIndex !== -1) {
      const item = this.queue.splice(queueIndex, 1)[0];
      const requestKey = this.getRequestKey(item.id, item.params);
      this.pendingPromises.delete(requestKey);
      item.reject(new Error("请求已被取消"));
      // console.log(`请求 ${id} 已从队列中取消`);
      cancelled = true;
    }

    return cancelled;
  }

  /**
   * 强制取消正在执行的请求（注意：这不会中止实际的HTTP请求）
   * @param id 请求ID
   * @param params 请求参数（可选，用于精确匹配）
   */
  cancelRunningRequest(id: string, params?: any): boolean {
    let cancelled = false;

    for (const [key, request] of this.runningRequests.entries()) {
      if (params !== undefined) {
        if (request.id === id && key === this.getRequestKey(id, params)) {
          this.runningRequests.delete(key);
          this.pendingPromises.delete(key);
          // console.log(`正在执行的请求 ${id} 已被标记取消`);
          cancelled = true;
          break;
        }
      } else if (request.id === id) {
        this.runningRequests.delete(key);
        this.pendingPromises.delete(key);
        // console.log(`正在执行的请求 ${id} 已被标记取消`);
        cancelled = true;
        break;
      }
    }

    return cancelled;
  }

  /**
   * 获取所有正在执行的请求信息
   */
  getRunningRequests(): Array<{
    id: string;
    startTime: number;
    duration: number;
  }> {
    const now = Date.now();
    return Array.from(this.runningRequests.values()).map(request => ({
      id: request.id,
      startTime: request.startTime,
      duration: now - request.startTime
    }));
  }

  /**
   * 检查请求是否正在执行或等待中
   * @param id 请求ID
   * @param params 请求参数
   */
  isRequestPending(id: string, params?: any): boolean {
    if (params !== undefined) {
      const requestKey = this.getRequestKey(id, params);
      return (
        this.runningRequests.has(requestKey) ||
        this.pendingPromises.has(requestKey)
      );
    }

    // 如果没有提供具体参数，检查所有匹配ID的请求
    for (const key of this.runningRequests.keys()) {
      if (key.startsWith(`${id}_`)) {
        return true;
      }
    }

    for (const key of this.pendingPromises.keys()) {
      if (key.startsWith(`${id}_`)) {
        return true;
      }
    }

    return false;
  }
}

// 导出单例实例
export const requestQueueManager = RequestQueueManager.getInstance();
