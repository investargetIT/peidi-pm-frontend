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

/**
 * 根据URL下载图片
 * @param url 图片的URL地址
 * @param filename 下载后的文件名（可选）
 * @returns Promise<void>
 */
export const downloadImageFromUrl = async (
  url: string,
  filename?: string
): Promise<void> => {
  try {
    // 如果没有提供文件名，则从URL中提取
    if (!filename) {
      const urlParts = url.split("/");
      filename = urlParts[urlParts.length - 1].split("?")[0]; // 去除查询参数
      if (!/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename)) {
        // 如果URL中没有文件扩展名，则默认使用.png
        filename = `${generateID()}.png`;
      }
    }

    // 发起网络请求获取图片blob数据
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // 创建临时链接并触发下载
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // 清理资源
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("下载图片时出错:", error);
    throw error;
  }
};
