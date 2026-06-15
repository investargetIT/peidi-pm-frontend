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

// 获取钉钉部门下所有用户
export const getDingAllDepartmentUsersApi = (params: { deptId: number }) => {
  return http.request(
    "get",
    "https://user.peidigroup.cn/ding/allDepartmentUsers",
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

// 删除节点（递归删除子节点）
export const deletePmKpiGroupNodeApi = (params: { id: number }) => {
  return http.request("post", baseUrlApi("/pm/kpi-group-node/delete"), {
    params
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

// 删除节点指标配置
export const deletePmKpiGroupNodeNodeConfigApi = (params: { id: number }) => {
  return http.request(
    "post",
    baseUrlApi("/pm/kpi-group-node/node/config/delete"),
    {
      params
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

// 根据用户ID执行SQL更新指标数据
export const execSqlByUserId = (params: { userId: number | string }) => {
  return http.request("post", baseUrlApi("/pm/kpi-month-metric-target/execSqlByUserId"), {
    params
  });
};

// 更新月度指标目标（不存在则创建）
export const updatePmKpiMonthMetricTargetApi = (data: {
  id?: number | string;
  /**
   * 实际达成值
   */
  achieved?: number;
  /**
   * 指标用户ID
   */
  metricUserId: number | string;
  /**
   * 月份
   */
  month: string;
  nodeId?: number | string;
  nodeName?: string;
  /**
   * 目标值
   */
  target?: number;
  targetName?: string;
  treePath?: string;
  treePathName?: string;
  /**
   * 实际用户ID
   */
  userId: number | string;
  [property: string]: any;
}) => {
  return http.request(
    "post",
    baseUrlApi("/pm/kpi-month-metric-target/update"),
    {
      data
    }
  );
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
  /**
   * 用户id
   */
  userId: number | string;
  /**
   * 工号
   */
  jobNum?: string;
  /**
   * 用户名
   */
  username?: string;
  /**
   * 节点id
   */
  nodeId?: number | string;
  /**
   * 节点名称
   */
  nodeName?: string;
  /**
   * 指标列表
   */
  metricList: Array<{
    id?: number | string;
    metricConfigId?: number | string;
    metricType?: number;
    targetName?: string;
    metricId?: string;
    kpiDepict?: string;
    rate?: string;
    nodeId?: number | string;
    nodeName?: string;
    status?: number;
  }>;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-metric-user/add"), {
    data
  });
};

// 删除KPI指标用户
export const deletePmKpiMetricUserApi = (params: { userId: number | string }) => {
  return http.request("post", baseUrlApi("/pm/kpi-metric-user/delete"), {
    params
  });
};

// 获取所有指标配置（按nodeId分组）
export const getPmKpiGroupNodeConfigGroupApi = () => {
  return http.request("get", baseUrlApi("/pm/kpi-group-node/config/group"));
};

// 获取执行SQL列表
export const getPmExecSqlListApi = (params: { type: string; name?: string }) => {
  return http.request("get", baseUrlApi("/pm/exec-sql/list"), { params });
};

// 修改KPI指标用户
export const updatePmKpiMetricUserApi = (data: {
  /**
   * 用户id
   */
  userId: number | string;
  /**
   * 工号
   */
  jobNum?: string;
  /**
   * 用户名
   */
  username?: string;
  /**
   * 节点id
   */
  nodeId?: number | string;
  /**
   * 节点名称
   */
  nodeName?: string;
  /**
   * 指标列表
   */
  metricList: Array<{
    id?: number | string;
    metricConfigId?: number | string;
    metricType?: number;
    targetName?: string;
    metricId?: string;
    kpiDepict?: string;
    rate?: string;
    nodeId?: number | string;
    nodeName?: string;
    status?: number;
  }>;
}) => {
  return http.request("post", baseUrlApi("/pm/kpi-metric-user/update"), {
    data
  });
};
