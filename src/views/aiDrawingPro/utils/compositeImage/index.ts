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
 * 计算 base64 字符串的大小（KB）
 */
const calculateBase64Size = (base64: string): number => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.round((base64.length * 0.75 - padding) / 1024);
};

/**
 * 压缩图片到指定大小以下
 * @param canvas Canvas 元素
 * @param maxSizeKB 最大大小（KB），0 表示不压缩
 * @param preferPNG 是否优先使用 PNG 格式（即使压缩）
 * @returns 压缩后的 base64 数据
 */
const compressImageToSize = async (
  canvas: HTMLCanvasElement,
  maxSizeKB: number = 0,
  preferPNG: boolean = false
): Promise<string> => {
  // 如果不限制大小，直接返回 PNG 最高质量
  if (maxSizeKB <= 0) {
    return canvas.toDataURL("image/png", 1.0);
  }

  // 如果优先 PNG，先尝试 PNG 压缩
  if (preferPNG) {
    // PNG 格式 - 先尝试原图
    let result = canvas.toDataURL("image/png");
    let sizeKB = calculateBase64Size(result);
    if (sizeKB <= maxSizeKB) {
      console.log(`PNG 直接导出成功：大小 ${sizeKB}KB`);
      return result;
    }

    // 尝试缩小尺寸来减小 PNG 大小
    let scale = 0.9;
    while (scale >= 0.3) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = Math.floor(canvas.width * scale);
      tempCanvas.height = Math.floor(canvas.height * scale);
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) break;

      tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

      result = tempCanvas.toDataURL("image/png");
      sizeKB = calculateBase64Size(result);

      if (sizeKB <= maxSizeKB) {
        console.log(
          `PNG 压缩成功：缩放 ${(scale * 100).toFixed(0)}%，大小 ${sizeKB}KB`
        );
        return result;
      }
      scale -= 0.1;
    }
  }

  // 尝试 JPEG 格式，从高质量开始逐步降低
  let quality = 0.95;
  while (quality >= 0.1) {
    const result = canvas.toDataURL("image/jpeg", quality);
    const sizeKB = calculateBase64Size(result);
    if (sizeKB <= maxSizeKB) {
      console.log(
        `JPEG 压缩成功：质量 ${quality.toFixed(2)}，大小 ${sizeKB}KB`
      );
      return result;
    }
    quality -= 0.05;
  }

  // 如果 JPEG 最低质量仍太大，尝试逐步缩小图片尺寸
  let scale = 0.9;
  while (scale >= 0.3) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = Math.floor(canvas.width * scale);
    tempCanvas.height = Math.floor(canvas.height * scale);
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) break;

    tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

    // 重新用中等质量压缩
    quality = 0.8;
    while (quality >= 0.2) {
      const result = tempCanvas.toDataURL("image/jpeg", quality);
      const sizeKB = calculateBase64Size(result);
      if (sizeKB <= maxSizeKB) {
        console.log(
          `JPEG 压缩成功：缩放 ${(scale * 100).toFixed(0)}%，质量 ${quality.toFixed(2)}，大小 ${sizeKB}KB`
        );
        return result;
      }
      quality -= 0.1;
    }
    scale -= 0.1;
  }

  // 最后尝试最小尺寸和最低质量
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = Math.floor(canvas.width * 0.3);
  finalCanvas.height = Math.floor(canvas.height * 0.3);
  const finalCtx = finalCanvas.getContext("2d");
  if (finalCtx) {
    finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
  }

  // 根据 preferPNG 选择最终格式
  let finalResult;
  if (preferPNG) {
    finalResult = finalCanvas.toDataURL("image/png");
  } else {
    finalResult = finalCanvas.toDataURL("image/jpeg", 0.1);
  }

  console.warn(`已压缩到最小尺寸：大小 ${calculateBase64Size(finalResult)}KB`);
  return finalResult;
};

/**
 * 使用 Canvas 合成图片
 * @param backgroundImage 背景图（base64 或 blob URL）
 * @param elements 素材元素数组（像素坐标，基于 containerWidth/containerHeight）
 * @param outputWidth 输出宽度
 * @param outputHeight 输出高度
 * @param maxSizeKB 最大文件大小（KB），0 表示不限制
 * @param preferPNG 是否优先使用 PNG 格式
 * @returns 压缩后的 base64 数据
 */
export const compositeImage = async (
  backgroundImage: string,
  elements: CompositeElement[],
  outputWidth: number = 800,
  outputHeight: number = 800,
  maxSizeKB: number = 0,
  preferPNG: boolean = false
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

    // 根据 maxSizeKB 进行压缩
    return await compressImageToSize(canvas, maxSizeKB, preferPNG);
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
