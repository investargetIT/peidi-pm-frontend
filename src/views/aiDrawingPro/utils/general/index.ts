/**
 * 从对象名称中提取文件名（不包含扩展名）
 * @param objectName
 * @returns 文件名（不包含扩展名）
 */
export const getNameFromObjectName = (objectName: string) => {
  const fileName = objectName.split("/")[objectName.split("/").length - 1];
  return fileName.split(".")[0];
};
