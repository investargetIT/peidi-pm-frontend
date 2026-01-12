import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  return `http://12.18.1.12:8091${url}`;
};

// 获取ai画图分页结果
export const getAiDrawPage = params => {
  return http.request("get", baseUrlApi("/ai/draw/page"), {
    params
  });
};

interface NewAiDrawRequest {
  fields: string; // Table行数据
  id: number;
  imgs: string;
  maxRetries: number; // 最大重试次数
  remark: string;
  size: number; // 需要生成的图片数量
  urlParam: string;
  uuid: string;
}

// 新增画图
export const newAiDraw = (data: NewAiDrawRequest) => {
  return http.request("post", baseUrlApi("/ai/draw/new"), {
    data
  });
};
