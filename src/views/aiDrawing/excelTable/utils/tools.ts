/**
 * 生成 随机字符串
 * @returns 生成的 随机字符串
 */
export const generateID = () =>
  new Date().getTime().toString(36) + Math.random().toString(36).substring(2);
