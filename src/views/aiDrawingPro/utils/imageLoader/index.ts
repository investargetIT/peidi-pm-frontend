import { downloadFile } from "@/api/aiDraw";
import { ElMessage } from "element-plus";

// 创建一个可取消的Promise包装器
class CancellablePromise<T> implements PromiseLike<T> {
  private isCancelled = false;
  private promise: Promise<T>;
  private rejectFn: (reason?: any) => void;

  constructor(executor: (resolve: (value: T) => void, reject: (reason?: any) => void) => void) {
    this.promise = new Promise<T>((resolve, reject) => {
      this.rejectFn = reject;
      executor(resolve, reject);
    });
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.promise.finally(onfinally);
  }

  get [Symbol.toStringTag](): string {
    return "CancellablePromise";
  }

  cancel(reason = "请求已取消") {
    if (!this.isCancelled) {
      this.isCancelled = true;
      this.rejectFn(new Error(reason));
    }
  }

  get cancelled() {
    return this.isCancelled;
  }
}

/**
 * 通用的图片加载函数，支持缓存管理、加载提示和取消功能
 * @param imageUrl 图片URL
 * @param imageCacheManager 图片缓存管理器（可选）
 * @param options 配置选项
 * @returns 返回可取消的Promise，包含base64格式的图片和取消函数
 */
export const loadImage = (
  imageUrl: string,
  imageCacheManager: any = null,
  options: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
  } = {}
): { promise: Promise<string>; cancel: () => void } => {
  const {
    loadingMessage = "正在加载图片...",
    successMessage = "图片加载成功",
    errorMessage = "图片加载失败，请检查URL是否正确"
  } = options;

  if (!imageUrl) {
    throw new Error("图片URL不能为空");
  }

  // 显示加载消息
  const loadingMsg = ElMessage.info({
    message: loadingMessage,
    duration: 0
  });

  const cancellablePromise = new CancellablePromise<string>(async (resolve, reject) => {
    try {
      let base64Data: string;

      // 优先使用缓存管理器加载图片
      if (imageCacheManager?.processImageWithCache) {
        const result = await imageCacheManager.processImageWithCache(imageUrl);
        base64Data = result.originalBlob;
      } else {
        // 如果缓存管理器不可用，使用原来的方式
        const res: any = await downloadFile({ objectName: imageUrl });
        base64Data = await new Promise((resolveReader, rejectReader) => {
          const reader = new FileReader();
          reader.onloadend = () => resolveReader(reader.result as string);
          reader.onerror = rejectReader;
          reader.readAsDataURL(res);
        });
      }

      // 如果请求已被取消，直接返回
      if (cancellablePromise.cancelled) {
        return;
      }

      // 关闭加载消息并显示成功消息
      loadingMsg.close();
      ElMessage.success(successMessage);

      resolve(base64Data);
    } catch (error) {
      // 如果请求已被取消，不显示错误消息
      if (cancellablePromise.cancelled) {
        return;
      }

      console.error("图片加载失败:", error);

      // 关闭加载消息并显示错误消息
      loadingMsg.close();
      ElMessage.error(errorMessage);

      reject(error);
    }
  });

  return {
    promise: cancellablePromise as Promise<string>,
    cancel: () => {
      cancellablePromise.cancel();
      loadingMsg.close(); // 取消时关闭加载消息
    }
  };
};