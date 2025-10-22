import CryptoJS from "crypto-js";
export const CRYPTOJS_KEY = "secret_key_peidi123456";

/**
 * 加密
 * @param message 待加密的字符串
 * @returns 加密后的字符串
 */
export const encryptMessage = (message: string) => {
  return CryptoJS.AES.encrypt(message, CRYPTOJS_KEY).toString();
};

/**
 * 解密
 * @param encryptedData 加密数据
 * @returns 解密后的字符串
 */
export const decryptMessage = (encryptedData: string) => {
  encryptedData = encryptedData.replace(/\s/g, "+");
  const bytes = CryptoJS.AES.decrypt(encryptedData, CRYPTOJS_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};
