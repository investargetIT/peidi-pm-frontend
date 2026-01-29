import Compressor from "compressorjs";
import UPNG from "upng-js";
import { blobManager } from "../blobManager";

/**
 * 图片数据返回类型
 */
export interface ImageDataResult {
  originalBase64: string; // 原图base64数据
  compressedBase64: string; // 压缩图base64数据
}

/**
 * 使用compressor压缩图片
 * @param base64Data 原始base64图片数据
 * @param quality 压缩质量 (0-1)
 * @returns Promise<string> 压缩后的base64数据
 */
export const compressImage = (
  base64Data: string,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 将base64转换为Blob
    const blob = blobManager.base64ToBlob(base64Data);

    new Compressor(blob, {
      quality,
      maxWidth: 70, // 最大宽度限制
      maxHeight: 70, // 最大高度限制
      success(result) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => reject(new Error("图片压缩后读取失败"));
        reader.readAsDataURL(result);
      },
      error(err) {
        console.error("图片压缩失败:", err);
        // 压缩失败时返回原始数据
        resolve(base64Data);
      }
    });
  });
};

/**
 * 压缩PNG图片
 * @param file PNG文件对象
 * @returns Promise<File> 压缩后的PNG文件
 */
export const compressPNG = async (file: File): Promise<File> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = UPNG.decode(arrayBuffer);
    const rgba8 = UPNG.toRGBA8(decoded);

    // 这里保持宽高不变，保持80%的质量（接近于 tinypng 的压缩效果）
    const compressed = UPNG.encode(
      rgba8,
      decoded.width,
      decoded.height,
      256 * 0.3
    );
    return new File([compressed], file.name, { type: "image/png" });
  } catch (error) {
    console.error("PNG图片压缩失败:", error);
    // 压缩失败时返回原始文件
    return file;
  }
};

/**
 * 智能图片压缩函数 - 根据图片类型选择压缩方式
 * @param originalBase64 原始base64图片数据
 * @param imageUrl 图片URL（用于判断文件类型）
 * @param quality 通用压缩质量 (0-1)，默认0.5
 * @returns Promise<string> 压缩后的base64数据
 */
export const smartCompressImage = async (
  originalBase64: string,
  imageUrl: string,
  quality: number = 0.5
): Promise<string> => {
  // 检查是否为PNG图片，如果是则使用PNG专用压缩
  if (imageUrl.toLowerCase().endsWith(".png")) {
    try {
      // 将base64转换为File对象进行PNG压缩
      const blob = blobManager.base64ToBlob(originalBase64);
      const pngFile = new File([blob], "image.png", {
        type: "image/png"
      });
      const compressedPNGFile = await compressPNG(pngFile);

      // 将压缩后的PNG文件转换回base64
      return new Promise((resolve, reject) => {
        const pngReader = new FileReader();
        pngReader.onloadend = () => {
          resolve(pngReader.result as string);
        };
        pngReader.onerror = () => {
          console.warn("PNG压缩后转换失败，使用通用压缩");
          reject(new Error("PNG压缩后转换失败"));
        };
        pngReader.readAsDataURL(compressedPNGFile);
      });
    } catch (error) {
      console.warn("PNG图片压缩失败，使用通用压缩:", error);
      // PNG压缩失败时使用通用压缩
      return await compressImage(originalBase64, quality);
    }
  } else {
    // 非PNG图片直接使用通用压缩
    return await compressImage(originalBase64, quality);
  }
};

/**
 * 统一的图片压缩处理函数
 * @param originalBase64 原始base64图片数据
 * @param imageUrl 图片URL（用于判断文件类型）
 * @param quality 通用压缩质量 (0-1)，默认0.5
 * @returns Promise<ImageDataResult> 返回包含原图和压缩图的对象
 */
export const processImageCompression = async (
  originalBase64: string,
  imageUrl: string,
  quality: number = 0.5
): Promise<ImageDataResult> => {
  let compressedBase64 = originalBase64;

  try {
    compressedBase64 = await smartCompressImage(
      originalBase64,
      imageUrl,
      quality
    );
  } catch (error) {
    console.warn("图片压缩失败，使用原始图片:", error);
    compressedBase64 = originalBase64;
  }

  return {
    originalBase64,
    compressedBase64
  };
};
