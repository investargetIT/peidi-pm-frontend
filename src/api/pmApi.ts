import { http } from "@/utils/http";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

const baseOmsUrlApi = (url: string) => {
  return `https://api.peidigroup.cn/oms${url}`;
};

const baseUrlApi = (url: string, hasPm = true) => {
  return `https://api.peidigroup.cn/${hasPm ? "pm" : ""}${url}`;
};

const commonUrlApi = (url: string) => `${"https://user.peidigroup.cn"}${url}`;

// 获取业务单元

export const omsGetShops = params => {
  return http.request("get", baseOmsUrlApi("/orders/shopTarget"), {
    params
  });
};

// 新建任务

export const newTask = data => {
  return http.request("post", baseUrlApi("/task-manage/new"), {
    data
  });
};

// 获取枚举
export const getEnum = params => {
  return http.request("get", baseUrlApi("/common/enum"), {
    params
  });
};

// 分页任务数据
export const getTaskPage = params => {
  return http.request("get", baseUrlApi("/task-manage/page"), {
    params
  });
};

// 获取进入是否已经有设置过优先级高的任务

export const getPriorty = params => {
  return http.request("get", baseUrlApi("/task-manage/priority"), {
    params
  });
};

// 获取任务状态枚举
export const getStatusEnum = () => {
  return new Promise((resolve, reject) => {
    http
      .request("get", baseUrlApi("/common/enum"), {
        params: {
          type: "status"
        }
      })
      .then(res => {
        const { data } = res;
        resolve(data);
      });
  });
};

// 获取任务优先级
export const getPriorityEnum = () => {
  return new Promise((resolve, reject) => {
    http
      .request("get", baseUrlApi("/common/enum"), {
        params: {
          type: "priority"
        }
      })
      .then(res => {
        const { data } = res;
        resolve(data);
      });
  });
};

// 获取工作类型
export const getWorkTypeEnum = () => {
  return new Promise((resolve, reject) => {
    http
      .request("get", baseUrlApi("/common/enum"), {
        params: {
          type: "workType"
        }
      })
      .then(res => {
        const { data } = res;
        resolve(data);
      });
  });
};

// 获取任务类型
export const getTaskTypeEnum = () => {
  return new Promise((resolve, reject) => {
    http
      .request("get", baseUrlApi("/common/enum"), {
        params: {
          type: "taskType"
        }
      })
      .then(res => {
        const { data } = res;
        resolve(data);
      });
  });
};

// 获取白名单枚举 adminUser
export const getAdminUserEnum = () => {
  return new Promise((resolve, reject) => {
    http
      .request("get", baseUrlApi("/common/enum"), {
        params: {
          type: "adminUser"
        }
      })
      .then(res => {
        const { data } = res;
        // resolve([{
        //   id : 78,
        //   type : 'adminUser',
        //   value : '474805081221550528'
        // }])
        resolve(data);
      });
  });
};

// 修改任务
// /pm/task-manage/update
export const updateTask = data => {
  let ddUserInfo: any = localStorage.getItem("ddUserInfo");
  if (ddUserInfo) {
    ddUserInfo = JSON.parse(ddUserInfo);
  }
  if (data) {
    data.updateUser = { userName: ddUserInfo.name, userId: ddUserInfo.userid };
  }
  return http.request("post", baseUrlApi("/task-manage/update"), {
    data
  });
};

export const getOneTask = params => {
  return http.request("get", baseUrlApi("/task-manage/model"), {
    params
  });
};

export const getTaskRecord = params => {
  return http.request("get", baseUrlApi("/task-record/list"), {
    params
  });
};

export const newTaskRecord = data => {
  return http.request("post", baseUrlApi("/task-record/new"), {
    data
  });
};

export const deleteTaskRecord = data => {
  return http.request("post", baseUrlApi("/task-record/delete"), {
    data
  });
};

export const updateTaskRecord = data => {
  return http.request("post", baseUrlApi("/task-record/update"), {
    data
  });
};

// 获取任务类型 API
export const getTaskTypeApi = params => {
  return http.request("get", baseUrlApi("/task-manage/enum"), {
    params
  });
};

// 获取是否有待分配的任务
export const getTaskUnassigned = params => {
  return http.request("get", baseUrlApi("/task-manage/hasExamine"), {
    params
  });
};

// 获取考核列表
export const getExaminationList = params => {
  return http.request("get", baseUrlApi("/kpi-examination/page"), {
    params
  });
};

// 更新考核
export const updateExamination = data => {
  return http.request("post", baseUrlApi("/kpi-examination/update"), {
    data
  });
};

//获取可修改用户
export const getModifyUser = params => {
  return http.request("get", baseUrlApi("/kpi-examination/manage"), {
    params
  });
};

// 获取考核记录结果
export const getExaminationRecordResult = params => {
  return http.request("get", baseUrlApi("/kpi-examination/result/list"), {
    params,
    timeout: 1000 * 60
  });
};

// 下载文件
export const downloadFile = (params: { objectName: string }) => {
  return http.request("get", baseUrlApi("/common/download"), {
    params,
    timeout: 1000 * 60,
    responseType: "blob"
  });
};

// 天猫分店铺spu毛利文件上传(财务上传)路径
export const getUploadExaminationPath = () => {
  return http.request("get", baseUrlApi("/kpi-examination/upload/examination"));
};

const testBaseUrlApi = (url: string) => {
  return `http://12.18.1.36:8087/pm${url}`;
};

// 获取设计师考核记录结果
export const getDesignerExaminationRecordResult = (params: {
  end: string;
  start: string;
}) => {
  return http.request("get", baseUrlApi("/kpi-examination/design/list"), {
    params
  });
};

/**
 * PmDesignRequest
 */
export interface PmDesignRequest {
  /**
   * 实际工时
   */
  actualHours?: number;
  /**
   * 负责设计师userID
   */
  assignedTo?: string;
  /**
   * 负责设计师名称
   */
  assignedToName?: string;
  /**
   * 设计类别
   */
  category?: string;
  /**
   * 创建日期
   */
  createAt?: string;
  /**
   * 提交人userID
   */
  createUserId?: string;
  /**
   * 提交人名称
   */
  createUserName?: string;
  /**
   * 截止时间
   */
  deadline?: string;
  /**
   * 需求描述
   */
  description?: string;
  /**
   * 结束日期
   */
  endAt?: string;
  /**
   * 预估工时
   */
  estimatedHours?: number;
  /**
   * 主键
   */
  id?: number;
  /**
   * 影响范围 (I1-I4)
   */
  impactRange?: string;
  /**
   * 是否为支援任务
   */
  isSupport?: boolean;
  /**
   * 自动计算的优先级
   */
  priority?: number;
  /**
   * 备注
   */
  remark?: string;
  /**
   * 开始日期
   */
  startAt?: string;
  /**
   * 需求状态
   */
  status?: string;
  /**
   * 二级任务类型
   */
  taskType?: string;
  /**
   * 需求标题
   */
  title?: string;
  /**
   * 使用场景 (S1-S4)
   */
  usageScenario?: string;
  /**
   * Ai响应验证结果
   */
  verificationResult?: string;
  [property: string]: any;
}

/**
 * PmDesignByUserVo
 */
export interface PmDesignByUserVo {
  requests?: PmDesignRequest[];
  userId?: string;
  userName?: string;
  [property: string]: any;
}

export interface GetActiveDesignersParams {
  endDate?: string;
  startDate?: string;
  [property: string]: any;
}

// 获取活跃设计师及其设计需求列表
export const getActiveDesignersWithRequests = (
  params: GetActiveDesignersParams
) => {
  return http.request(
    "get",
    baseUrlApi("/design/designers/active-with-requests"),
    {
      params
    }
  );
};
