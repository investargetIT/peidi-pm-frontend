// 判断是否是开发环境 返回true代表是开发环境
export function isDevEnv() {
  return process.env.NODE_ENV === "development";
}
