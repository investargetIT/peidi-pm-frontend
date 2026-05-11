/**
 * Canvas 图片合成工具
 * 负责将背景图和素材元素合成为一张图片
 */
// import { blobManager } from "../blobManager";

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
 * @param elements 素材元素数组（像素坐标，基于 containerWidth/containerHeight）
 * @param outputWidth 输出宽度
 * @param outputHeight 输出高度
 * @returns PNG 的 base64 数据
 */
export const compositeImage = async (
  backgroundImage: string,
  elements: CompositeElement[],
  outputWidth: number = 800,
  outputHeight: number = 800
): Promise<string> => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("无法获取 canvas 上下文");
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    const bgImg = await loadImage(backgroundImage);

    const bgRatio = bgImg.width / bgImg.height;
    const canvasRatio = outputWidth / outputHeight;

    let bgDrawX = 0;
    let bgDrawY = 0;
    let bgDrawWidth = outputWidth;
    let bgDrawHeight = outputHeight;

    if (bgRatio > canvasRatio) {
      // 背景图比画布更“宽”，为了覆盖画布，高度必须填满，宽度会溢出
      bgDrawHeight = outputHeight;
      bgDrawWidth = outputHeight * bgRatio;
      bgDrawX = (outputWidth - bgDrawWidth) / 2; // 水平居中，左右溢出被裁剪
      bgDrawY = 0;
    } else {
      // 背景图比画布更“高”，为了覆盖画布，宽度必须填满，高度会溢出
      bgDrawWidth = outputWidth;
      bgDrawHeight = outputWidth / bgRatio;
      bgDrawX = 0;
      bgDrawY = (outputHeight - bgDrawHeight) / 2; // 垂直居中，上下溢出被裁剪
    }

    ctx.drawImage(bgImg, bgDrawX, bgDrawY, bgDrawWidth, bgDrawHeight);

    const contentScaleX = bgDrawWidth / outputWidth;
    const contentScaleY = bgDrawHeight / outputHeight;

    for (const element of elements) {
      try {
        const elementImg = await loadImage(element.src);

        const scaledX = bgDrawX + element.x * contentScaleX;
        const scaledY = bgDrawY + element.y * contentScaleY;
        const scaledWidth = element.width * contentScaleX;
        const scaledHeight = element.height * contentScaleY;

        ctx.drawImage(elementImg, scaledX, scaledY, scaledWidth, scaledHeight);
      } catch (error) {
        console.warn(`素材图片绘制失败：`, error);
      }
    }

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
    outputWidth: number;
    outputHeight: number;
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
        task.outputWidth,
        task.outputHeight
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
