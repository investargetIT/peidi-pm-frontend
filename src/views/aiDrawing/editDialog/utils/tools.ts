/**
 * 将URL图片转换为base64格式
 * @param url 图片URL地址
 * @param format 图片格式，默认为'image/png'
 * @returns Promise<string> base64格式的图片字符串
 */
export async function convertUrlToBase64(
  url: string,
  format: string = "image/png"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 处理跨域问题

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法获取canvas上下文"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      try {
        const base64 = canvas.toDataURL(format);
        resolve(base64);
      } catch (error) {
        reject(new Error(`图片转换失败: ${(error as Error).message}`));
      }
    };

    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };

    img.src = url;
  });
}

/**
 * 检查图片URL是否需要转换为base64
 * @param url 图片URL地址
 * @returns boolean 是否需要转换
 */
export function needConvertToBase64(url: string): boolean {
  return !(
    url.startsWith("data:") ||
    url.startsWith("./") ||
    url.startsWith("/") ||
    url.startsWith("blob:")
  );
}
