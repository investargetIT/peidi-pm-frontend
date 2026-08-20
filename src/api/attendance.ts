import { http } from "@/utils/http";

const baseUrlApi = (url: string) => {
  return `https://user.peidigroup.cn${url}`;
  // return `http://12.18.1.36:8080${url}`;
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
  [property: string]: any;
}

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
