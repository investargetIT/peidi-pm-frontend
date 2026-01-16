import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  return `https://api.peidigroup.cn${url}`;
  // return `http://12.18.1.12:8091${url}`;
};

export interface AiDrawPageRequest {
  pageNo: number;
  pageSize: number;
  searchStr?: string;
  sortStr?: string;
}

// 获取ai画图分页结果
export const getAiDrawPage = (params: AiDrawPageRequest) => {
  return http.request("get", baseUrlApi("/ai/draw/page"), {
    params,
    timeout: 1000 * 30
  });
};

export interface NewAiDrawRequest {
  fields?: string; // Table行数据
  id?: number;
  imgs?: string;
  maxRetries?: number; // 最大重试次数
  remark?: string;
  size?: number; // 需要生成的图片数量
  urlParam?: string;
  uuid?: string;
}

// 新增画图
export const newAiDraw = (data: NewAiDrawRequest) => {
  return http.request("post", baseUrlApi("/ai/draw/new"), {
    data,
    timeout: 0
  });
};

// 原图上传
export const uploadDraw = (data: FormData) => {
  return http.request("post", baseUrlApi("/ai/draw/upload"), {
    data,
    headers: {
      "Content-Type": "multipart/form-data"
    },
    timeout: 1000 * 30
  });
};

// 下载文件
export const downloadFile = (params: { objectName: string }) => {
  return http.request("get", baseUrlApi("/ai/common/download"), {
    params,
    responseType: "blob",
    timeout: 1000 * 60 * 5
  });
};

// 获取文件url
export const getDownloadUrl = (params: { objectName: string }) => {
  return http.request("get", baseUrlApi("/ai/common/download-url"), {
    params,
    timeout: 1000 * 30
  });
};

// 新增素材
export const newMaterial = (data: { objectName: string; type: string }) => {
  return http.request("post", baseUrlApi("/ai/draw/materials/new"), {
    data,
    timeout: 1000 * 60
  });
};

// 分页素材库结果
export const getMaterialPage = (params: AiDrawPageRequest) => {
  return http.request("get", baseUrlApi("/ai/draw/materials/page"), {
    params,
    timeout: 1000 * 30
  });
};
