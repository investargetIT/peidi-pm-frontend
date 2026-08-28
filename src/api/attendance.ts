import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  return `https://user.peidigroup.cn${url}`;
  // return `http://12.18.1.36:8080${url}`;
};

/** 部门节点 */
export interface DeptNode {
  /** 部门ID */
  deptId?: string | number;
  /** 部门名称 */
  deptName?: string;
  /** 父级部门ID */
  parentId?: string | number;
  /** 部门路径 */
  path?: string;
  /** 子部门列表 */
  children?: DeptNode[];
  [property: string]: any;
}

/** 获取部门组织架构树 */
export const getDeptTree = () => {
  return http.request<DeptNode[]>("get", baseUrlApi("/attendance/dept/tree"));
};

/** 每日工时汇总分页查询 - 请求参数 */
export interface DailySummaryRequest {
  /** 结束工作日（含），格式yyyy-MM-dd，可选 */
  endDate?: string;
  /** 页码，从1开始，默认1 */
  pageNum?: number;
  /** 每页条数，默认10 */
  pageSize?: number;
  /** 起始工作日（含），格式yyyy-MM-dd，可选 */
  startDate?: string;
  /** 用户名，模糊搜索，可选 */
  username?: string;
  /** 部门ID，可选 */
  deptId?: number | string;
  [property: string]: any;
}

/** 每日工时汇总DTO */
export interface AttendanceDailySummaryDTO {
  /** 钉钉userId */
  dingUserId?: string;
  /** 工时（小时，保留2位） - 原始打卡时长，不含扣除项 */
  durationHours?: number;
  /** 工时（秒） */
  durationSeconds?: number;
  /** 下班打卡时间 */
  offDutyTime?: string;
  /** 上班打卡时间 */
  onDutyTime?: string;
  /** 请假开始时间 */
  leaveStartTime?: string | null;
  /** 请假结束时间 */
  leaveEndTime?: string | null;
  /** 用户姓名 */
  username?: string;
  /** 工作日 */
  workDay?: string;
  /** 是否加班 */
  overtime?: boolean;
  /** 加班开始时间 */
  overtimeStartTime?: string | null;
  /** 加班结束时间 */
  overtimeEndTime?: string | null;
  /** 部门ID */
  deptId?: string;
  /** 部门名称 */
  deptName?: string;
  /** 上班打卡结果 */
  onDutyTimeResult?: string;
  /** 下班打卡结果 */
  offDutyTimeResult?: string;
  [property: string]: any;
}

/** 打卡结果枚举 */
export const TimeResultEnum = {
  /** 正常 */
  Normal: "Normal",
  /** 早退 */
  Early: "Early",
  /** 迟到 */
  Late: "Late",
  /** 严重迟到 */
  SeriousLate: "SeriousLate",
  /** 旷工迟到 */
  Absenteeism: "Absenteeism",
  /** 未打卡 */
  NotSigned: "NotSigned"
} as const;

export type TimeResultType = typeof TimeResultEnum[keyof typeof TimeResultEnum];

/** 每日工时汇总分页查询 - 返回结果 */
export interface DailySummaryResponse {
  /** 数据列表 */
  list?: AttendanceDailySummaryDTO[];
  /** 当前页码（从1开始） */
  pageNum?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 总条数 */
  total?: number;
  [property: string]: any;
}

/** 每日工时汇总分页查询 */
export const getDailySummary = (params: DailySummaryRequest) => {
  return http.request<DailySummaryResponse>(
    "get",
    baseUrlApi("/attendance/dailySummary"),
    { params }
  );
};
