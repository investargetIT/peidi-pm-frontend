import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  // return "http://12.18.1.36:8087" + url;
  return "https://api.peidigroup.cn" + url;
};

// 调用用户服务
export const getUserListApi = (params: { name: string }) => {
  return http.request(
    "get",
    "http://12.18.1.36:8080/user/user/list",
    // "https://user.peidigroup.cn/user/user/list",
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

// 新增节点
export const addPmKpiGroupNodeApi = (data: {
  createdAt?: string;
  id?: number;
  nodeName?: string;
  nodeType?: string;
  parentId?: number;
  sortNo?: number;
  status?: number;
  targetType?: string;
  treeLevel?: number;
  treePath?: string;
  treePathName?: string;
  updatedAt?: string;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-group-node/add"), {
    data
  });
};

// 更新节点
export const updatePmKpiGroupNodeApi = (data: {
  createdAt?: string;
  id?: number;
  nodeName?: string;
  nodeType?: string;
  parentId?: number;
  sortNo?: number;
  status?: number;
  targetType?: string;
  treeLevel?: number;
  treePath?: string;
  treePathName?: string;
  updatedAt?: string;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-group-node/update"), {
    data
  });
};

// 新增节点指标配置
export const addPmKpiGroupNodeNodeConfigApi = (data: {
  calculationFormula?: string;
  createdAt?: string;
  id?: number;
  kpiDepict?: string;
  nodeId?: number;
  rate?: string;
  score?: number;
  targetName?: string;
  weight?: number;
}) => {
  return http.request(
    "post",
    baseUrlApi("/pm/kpi-group-node/node/config/add"),
    {
      data
    }
  );
};

// 更新节点指标配置
export const updatePmKpiGroupNodeNodeConfigApi = (data: {
  calculationFormula?: string;
  createdAt?: string;
  id?: number;
  kpiDepict?: string;
  nodeId?: number;
  rate?: string;
  score?: number;
  targetName?: string;
  weight?: number;
}) => {
  return http.request(
    "post",
    baseUrlApi("/pm/kpi-group-node/node/config/update"),
    {
      data
    }
  );
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

// 新增KPI指标用户
export const addPmKpiMetricUserApi = (data: {
  createdAt?: string;
  id?: number;
  metricConfigId?: number;
  metricId?: string;
  metricType?: number;
  status?: number;
  updatedAt?: string;
  userId?: number;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-metric-user/add"), {
    data
  });
};

// 修改KPI指标用户
export const updatePmKpiMetricUserApi = (data: {
  /**
   * pm_kpi_metric_user表主键id
   */
  id: number;
  /**
   * 工号
   */
  jobNum?: string;
  /**
   * 指标描述
   */
  kpiDepict?: string;
  /**
   * 指标配置id
   */
  metricConfigId?: number;
  /**
   * 指标id
   */
  metricId?: string;
  /**
   * 比率
   */
  rate?: string;
  /**
   * 用户id（用于调用外部接口更新jobNum）
   */
  userId: number;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-metric-user/update"), {
    data
  });
};
