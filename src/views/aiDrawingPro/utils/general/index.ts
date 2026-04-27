/**
 * 从对象名称中提取文件名（不包含扩展名）
 * @param objectName
 * @returns 文件名（不包含扩展名）
 */
export const getNameFromObjectName = (objectName: string) => {
  const fileName = objectName.split("/")[objectName.split("/").length - 1];
  return fileName.split(".")[0];
};

/**
 * 生成 随机字符串
 * @returns 生成的 随机字符串
 */
export const generateID = () =>
  new Date().getTime().toString(36) + Math.random().toString(36).substring(2);

/**
 * 将文件转换为 base64 字符串
 * @param file 文件对象或 Element Plus 上传组件的 file 对象
 * @returns Promise<string> 返回 base64 字符串的 Promise
 */
export const fileToBase64 = (file: File | { raw: File }): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 判断是否为 Element Plus 上传组件的 file 对象格式
      const actualFile: File = (file as any).raw ? (file as any).raw : file;

      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = error => {
        reject(error);
      };
      reader.readAsDataURL(actualFile);
    } catch (error) {
      reject(error);
    }
  });
};

//#region 下载图片相关
/**
 * 根据 URL 下载图片，支持控制尺寸
 * @param url 图片的 URL 地址
 * @param filename 下载后的文件名（可选）
 * @param options 可选配置项
 * @param options.width 目标宽度（可选，与 height 同时设置时才会缩放）
 * @param options.height 目标高度（可选，与 width 同时设置时才会缩放）
 * @returns Promise<void>
 */
export const downloadImageFromUrl = async (
  url: string,
  filename?: string,
  options?: {
    width?: number;
    height?: number;
  }
): Promise<void> => {
  try {
    // 如果没有提供文件名，则从 URL 中提取
    if (!filename) {
      const urlParts = url.split("/");
      filename = urlParts[urlParts.length - 1].split("?")[0];
      if (!/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename)) {
        filename = `${generateID()}.png`;
      }
    }

    await downloadImage(url, filename, options?.width, options?.height);
  } catch (error) {
    console.error("下载图片时出错:", error);
    throw error;
  }
};

/**
 * 下载图片（支持尺寸控制）
 * @param url 图片 URL
 * @param filename 文件名
 * @param width 目标宽度（不传则使用原图宽度）
 * @param height 目标高度（不传则使用原图高度）
 */
const downloadImage = async (
  url: string,
  filename: string,
  width?: number,
  height?: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeoutId = setTimeout(() => {
      reject(new Error("图片加载超时"));
    }, 1000 * 30);

    img.onload = () => {
      clearTimeout(timeoutId);

      const canvas = document.createElement("canvas");
      const targetWidth = width ?? img.naturalWidth;
      const targetHeight = height ?? img.naturalHeight;

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("无法获取 canvas 上下文"));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("Canvas 转换 Blob 失败"));
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;

        let downloadName = filename;
        if (width && height) {
          const nameParts = filename.split(".");
          const extension = nameParts.length > 1 ? nameParts.pop() : "png";
          const baseName = nameParts.join(".");
          downloadName = `${baseName}_${width}x${height}.${extension}`;
        }

        link.download = downloadName;
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        resolve();
      }, "image/png");
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("图片加载失败，可能是网络问题、跨域限制或图片不存在"));
    };

    img.src = url;
  });
};
//#endregion

// ... existing code ...
//#endregion

/**
 * 调整图片尺寸，确保最小尺寸符合要求
 * @param file 原始图片文件
 * @param minSize 最小尺寸（宽度和高度），默认为 240
 * @returns Promise<File> 返回调整后的文件（如果不需要调整则返回原文件）
 */
export const resizeImageIfNeeded = (
  file: File,
  minSize: number = 240
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width >= minSize && img.height >= minSize) {
        resolve(file);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let newWidth = img.width;
      let newHeight = img.height;

      if (newWidth < minSize) {
        const ratio = minSize / newWidth;
        newWidth = minSize;
        newHeight = Math.round(img.height * ratio);
      }

      if (newHeight < minSize) {
        const ratio = minSize / newHeight;
        newHeight = minSize;
        newWidth = Math.round(newWidth * ratio);
      }

      canvas.width = newWidth;
      canvas.height = newHeight;

      ctx?.drawImage(img, 0, 0, newWidth, newHeight);

      canvas.toBlob(blob => {
        if (blob) {
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          });
          resolve(resizedFile);
        } else {
          reject(new Error("图片调整大小失败"));
        }
      }, file.type);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };

    img.src = url;
  });
};
