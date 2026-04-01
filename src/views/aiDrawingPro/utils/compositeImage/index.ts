/**
 * Canvas 图片合成工具
 * 负责将背景图和素材元素合成为一张图片
 */
import { blobManager } from "../blobManager";

export interface CompositeElement {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 加载图片为 Image 对象
 * @param src 图片源（base64 或 blob URL）
 * @returns Promise<Image>
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${src}`));
    img.src = src;
  });
};

/**
 * 使用 Canvas 合成图片
 * @param backgroundImage 背景图（base64 或 blob URL）
 * @param elements 素材元素数组
 * @param outputSize 输出尺寸（如 800）
 * @returns PNG 的 base64 数据
 */
export const compositeImage = async (
  backgroundImage: string,
  elements: CompositeElement[],
  outputSize: number = 800
): Promise<string> => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("无法获取 canvas 上下文");
    }

    canvas.width = outputSize;
    canvas.height = outputSize;

    // 填充白色背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outputSize, outputSize);

    // 1. 绘制背景图
    const bgImg = await loadImage(backgroundImage);

    // 计算背景图的绘制参数（保持比例，cover 模式）
    const bgRatio = bgImg.width / bgImg.height;
    const canvasRatio = outputSize / outputSize;

    let bgDrawX = 0;
    let bgDrawY = 0;
    let bgDrawWidth = outputSize;
    let bgDrawHeight = outputSize;

    if (bgRatio > canvasRatio) {
      // 图片更宽，按高度缩放
      bgDrawWidth = outputSize * bgRatio;
      bgDrawX = (outputSize - bgDrawWidth) / 2;
    } else {
      // 图片更高，按宽度缩放
      bgDrawHeight = outputSize / bgRatio;
      bgDrawY = (outputSize - bgDrawHeight) / 2;
    }

    ctx.drawImage(bgImg, bgDrawX, bgDrawY, bgDrawWidth, bgDrawHeight);

    // 2. 依次绘制所有素材元素
    for (const element of elements) {
      try {
        const elementImg = await loadImage(element.src);
        ctx.drawImage(
          elementImg,
          element.x,
          element.y,
          element.width,
          element.height
        );
      } catch (error) {
        console.warn(`素材图片绘制失败：`, error);
        // 继续绘制其他元素
      }
    }

    // 3. 返回 base64 数据
    return canvas.toDataURL("image/png", 1.0);
  } catch (error) {
    console.error("Canvas 合成错误:", error);
    throw error;
  }
};

/**
 * 批量合成图片
 * @param tasks 合成任务数组
 * @param concurrentLimit 并发限制（同时处理几张）
 * @returns 合成结果数组
 */
export const batchCompositeImages = async (
  tasks: Array<{
    background: string;
    elements: CompositeElement[];
    outputSize: number;
  }>,
  concurrentLimit: number = 3
): Promise<Array<{ success: boolean; data?: string; error?: string }>> => {
  const results: Array<{ success: boolean; data?: string; error?: string }> =
    [];

  const executeTask = async (taskIndex: number) => {
    const task = tasks[taskIndex];
    try {
      const result = await compositeImage(
        task.background,
        task.elements,
        task.outputSize
      );
      results[taskIndex] = {
        success: true,
        data: result
      };
    } catch (error) {
      results[taskIndex] = {
        success: false,
        error: (error as Error).message
      };
    }
  };

  // 分批执行
  const batches = Math.ceil(tasks.length / concurrentLimit);
  for (let i = 0; i < batches; i++) {
    const start = i * concurrentLimit;
    const end = Math.min(start + concurrentLimit, tasks.length);
    const batchTasks = [];

    for (let j = start; j < end; j++) {
      batchTasks.push(executeTask(j));
    }

    await Promise.all(batchTasks);
  }

  return results;
};

/**
 * 下载合成的图片
 * @param base64Data base64 数据
 * @param filename 文件名
 */
export const downloadCompositeImage = (
  base64Data: string,
  filename: string
) => {
  const link = document.createElement("a");
  link.href = base64Data;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 从 resultDialog 的图片元素生成合成参数
 * @param imageElements 图片元素数组
 * @param containerSize 容器尺寸（700）
 * @param outputSize 输出尺寸
 * @returns CompositeElement 数组
 */
export const generateCompositeElements = (
  imageElements: Array<{
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  containerSize: number = 700,
  outputSize: number = 800
): CompositeElement[] => {
  const scale = outputSize / containerSize;

  return imageElements.map(el => ({
    src: el.src,
    x: el.x * scale,
    y: el.y * scale,
    width: el.width * scale,
    height: el.height * scale
  }));
};
