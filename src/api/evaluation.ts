import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  // return "http://12.18.1.36:8087" + url;
  return "https://api.peidigroup.cn" + url;
};

// 调用用户服务
export const getUserListApi = (params: { name: string }) => {
  return http.request(
    "get",
    // "http://12.18.1.36:8080/user/user/list",
    "https://user.peidigroup.cn/user/user/list",
    {
      params
    }
  );
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

// 分页查询天猫用户收入
export const getPmKpiTmallUserIncomePage = (params: {
  brand?: string;
  endDate?: string;
  pageNo: number;
  pageSize: number;
  shopName?: string;
  spu?: string;
  startDate?: string;
  userName?: string;
}) => {
  return http.request("get", baseUrlApi("/pm/kpi-tmall-user-income/page"), {
    params
  });
};

// 分页查询月度指标目标
export const getPmKpiMonthMetricTargetPage = (params: {
  endDate?: string;
  pageNo: number;
  pageSize: number;
  startDate?: string;
  treePathName?: string;
  username?: string;
}) => {
  return http.request("get", baseUrlApi("/pm/kpi-month-metric-target/page"), {
    params
  });
};

// 分页获取KPI指标用户
export const getPmKpiMetricUserPage = (params: {
  pageNo: number;
  pageSize: number;
  username?: string;
}) => {
  return http.request("get", baseUrlApi("/pm/kpi-metric-user/page"), {
    params
  });
};
