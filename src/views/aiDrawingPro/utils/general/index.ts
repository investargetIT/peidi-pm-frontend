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
