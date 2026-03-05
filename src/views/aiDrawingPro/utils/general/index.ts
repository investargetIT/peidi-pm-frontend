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
 * 将文件转换为base64字符串
 * @param file 文件对象或Element Plus上传组件的file对象
 * @returns Promise<string> 返回base64字符串的Promise
 */
export const fileToBase64 = (file: File | { raw: File }): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 判断是否为Element Plus上传组件的file对象格式
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
 * 根据URL下载图片，支持控制尺寸
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

    const shouldResize = options?.width && options?.height;

    if (shouldResize) {
      await downloadResizedImage(
        url,
        filename,
        options.width!,
        options.height!
      );
    } else {
      await downloadOriginalImage(url, filename);
    }
  } catch (error) {
    console.error("下载图片时出错:", error);
    throw error;
  }
};

/**
 * 下载原始图片
 */
const downloadOriginalImage = async (
  url: string,
  filename: string
): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败：${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
};

/**
 * 下载缩放后的图片
 */
const downloadResizedImage = async (
  url: string,
  filename: string,
  width: number,
  height: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("无法获取 canvas 上下文"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("Canvas 转换 Blob 失败"));
          return;
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;

        const nameParts = filename.split(".");
        const extension = nameParts.length > 1 ? nameParts.pop() : "png";
        const baseName = nameParts.join(".");
        link.download = `${baseName}_${width}x${height}.${extension}`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        resolve();
      }, "image/png");
    };

    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };
  });
};
//#endregion
