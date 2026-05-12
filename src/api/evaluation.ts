import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  return "https://api.peidigroup.cn" + url;
};

// 分页获取节点列表(含父节点名称和递归子节点)
export const getPmKpiGroupNodePage = (params: {
  nodeName?: string;
  nodeType?: string;
  pageNo: number;
  pageSize: number;
  parentId?: number;
  status?: number;
}) => {
  return http.request("get", baseUrlApi("/pm/kpi-group-node/page"), {
    params
  });
};
