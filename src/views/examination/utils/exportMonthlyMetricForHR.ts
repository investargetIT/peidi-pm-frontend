import {
  getPmKpiMonthMetricTargetResultList,
  updateEditStatusApi
} from "@/api/evaluation";
import {
  METRIC_REFERENCE_RULES,
  isKeywordMatched,
  normalizeMetricName
} from "@/views/examination/utils/metricReference";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

//#region 公共函数和常量
// 指标类型转换
export const getMetricTypeText = (
  metricType: number | string | undefined
): string => {
  if (metricType === 1) return "定量考核";
  return String(metricType ?? "");
};

// 导出时指标名称中的半角括号统一为中文全角括号，便于人事系统识别
const toChineseBrackets = (name?: string | null) =>
  String(name ?? "")
    .replace(/\(/g, "（")
    .replace(/\)/g, "）");

// 复制单元格样式：只复制源单元格真实存在的样式，
// 避免给没有样式的单元格写入空字体/空填充，导致导出的 xlsx 被 Excel 判定需要修复
const copyCellStyle = (targetCell: ExcelJS.Cell, sourceCell: ExcelJS.Cell) => {
  const font = sourceCell.font;
  if (font && Object.keys(font).length > 0) {
    targetCell.font = { ...font };
  }

  const alignment = sourceCell.alignment;
  if (alignment && Object.keys(alignment).length > 0) {
    targetCell.alignment = { ...alignment };
  }

  const border = sourceCell.border;
  if (border && Object.keys(border).length > 0) {
    targetCell.border = { ...border };
  }

  const fill = sourceCell.fill;
  if (fill && Object.keys(fill).length > 0) {
    targetCell.fill = { ...fill };
  }
};

const toNumber = (value: any) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const sumDataValue = (sum: any, item: any) =>
  toNumber(sum) + toNumber(item?.value);

// 获取指定月份的第一天
const getFirstDayOfMonth = (year: number, month: number) => {
  return dayjs(`${year}-${month}`).startOf("month").format("YYYY-MM-DD");
};

// 在对象数组里查找month为指定日期的对象
const findObjectByMonthWithFirstDay = (
  array: any[],
  month: number,
  year?: number
) => {
  return array.find(
    obj => obj.month === getFirstDayOfMonth(year || dayjs().year(), month)
  );
};

// 在对象数组里查找month为指定日期的对象 在 数组中的索引
const findObjectByMonthIndex = (array: any[], month: number, year?: number) => {
  const idx = array.findIndex(
    obj => obj.month === getFirstDayOfMonth(year || dayjs().year(), month)
  );
  if (idx < 0) return -1;
  return idx;
};
//#endregion

// 可以跳过导出检查的用户ID列表
const SKIP_CHECK_USER_IDS = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1887377779519434753", // 王家琦
  "1926449443739601629", // 杨世豪
  "1926449443739601753" //刘汪洋
];

// 指标数据关联规则（读时派生）：目标用户直接复用来源用户的指标数据（目标值、达成值、计算模式）
// 规则统一维护在 ./metricReference.ts，页面表格与人事导出共用，避免两边口径不一致
const REFERENCE_METRIC_RULES = METRIC_REFERENCE_RULES.map(rule => ({
  sourceUserName: rule.sourceUserName,
  sourceMetricKeywords: rule.sourceMetricKeywords,
  sourceExcludeKeywords: rule.sourceExcludeKeywords,
  targetUserNames: rule.targetUserNames,
  targetMetricKeywords: rule.targetMetricKeywords,
  label: rule.sourceMetricLabel,
  targetLabel: rule.targetMetricLabel
}));

// 固定累计目标规则：指定指标在 1~fixedThroughMonth 月的累计「目标值/完成值」写死为固定金额，
// 不按系统逐月数据累加；自 fixedThroughMonth+1 月起的月度数据照常累加在固定值之上。
// 例：黄向前 / 梁钰 / 方林霞 的「渠道全年累计销售收入GMV」
//   导出 10 月（考核 9 月）：上月目标 = 3229 万，上月完成 = 2683.106524 万，
//                            次月目标 = 3229 万 + 10 月目标
//   导出 11 月（考核 10 月）：上月目标 = 3229 万 + 10 月目标，上月完成 = 2683.106524 万 + 10 月完成
// 完成率 = 完成值 / 目标值
// ⚠️ 该固定值只对「考核 fixedThroughMonth 月及以后」成立；更早月份的历史数据来自旧指标口径
//    （该指标口径历史上多次调整），导出结果不可用，代码会输出告警，页面「目标值口径说明」中也有标注
const FIXED_CUMULATIVE_TARGET_RULES: Array<{
  userNames: string[];
  metricKeywords: string[]; // 指标名称需同时包含的关键词（归一化后匹配）
  fixedThroughMonth: number;
  fixedCumulativeTarget: number; // 1~fixedThroughMonth 月累计目标，单位：元
  fixedCumulativeActual?: number; // 1~fixedThroughMonth 月累计完成值，单位：元
  label: string;
}> = [
  {
    userNames: ["黄向前", "梁钰", "方林霞"],
    metricKeywords: ["渠道全年累计销售收入GMV"],
    fixedThroughMonth: 9,
    fixedCumulativeTarget: 32_290_000, // 3229 万元
    fixedCumulativeActual: 26_831_065.24, // 2683.106524 万元
    label: "渠道全年累计销售收入GMV"
  }
];

// 指标名称是否命中固定累计目标规则的关键词
const isFixedTargetRuleMatched = (
  rule: (typeof FIXED_CUMULATIVE_TARGET_RULES)[number],
  metricName?: string | null
) => {
  const normalized = normalizeMetricName(metricName);
  return rule.metricKeywords.every(keyword =>
    normalized.includes(normalizeMetricName(keyword))
  );
};

// 匹配固定累计目标规则
const matchFixedCumulativeTargetRule = (
  userName?: string | null,
  metricName?: string | null
) =>
  FIXED_CUMULATIVE_TARGET_RULES.find(
    rule =>
      rule.userNames.includes(String(userName ?? "").trim()) &&
      isFixedTargetRuleMatched(rule, metricName)
  );

// 累加 [startMonth, endMonth] 区间内的月度值（startMonth > endMonth 时返回 0）
const sumValueByMonthRange = (
  monthData: any[],
  startMonth: number,
  endMonth: number,
  year: number
) => {
  let sum = 0;
  for (let m = startMonth; m <= endMonth; m++) {
    sum += toNumber(findObjectByMonthWithFirstDay(monthData, m, year)?.value);
  }
  return sum;
};

/**
 * 应用指标数据关联规则：把来源用户的指标数据同步给目标用户
 * @param items 按用户+指标分组后的数据
 */
const applyReferenceMetricRules = (items: any[]) => {
  REFERENCE_METRIC_RULES.forEach(rule => {
    const targetLabel = rule.targetLabel || rule.label;

    const matchedSourceItems = items.filter(
      item =>
        item.userName === rule.sourceUserName &&
        isKeywordMatched(
          item.examinationType,
          rule.sourceMetricKeywords,
          rule.sourceExcludeKeywords
        )
    );

    const hasEnoughExamination = (item: any) =>
      Array.isArray(item.examination) && item.examination.length >= 2;

    // 优先使用与规则名称完全一致的记录，其次使用任意关键词匹配且数据完整的记录
    const sourceItem =
      matchedSourceItems.find(
        item =>
          hasEnoughExamination(item) &&
          normalizeMetricName(item.examinationType) ===
            normalizeMetricName(rule.label)
      ) ||
      matchedSourceItems.find(hasEnoughExamination) ||
      matchedSourceItems[0];

    if (!sourceItem || !hasEnoughExamination(sourceItem)) {
      console.warn(
        `[月度指标导出] 未找到 ${rule.sourceUserName} 的「${rule.label}」有效数据，跳过关联「${targetLabel}」`
      );
      return;
    }

    if (matchedSourceItems.length > 1) {
      console.warn(
        `[月度指标导出] ${rule.sourceUserName} 的「${rule.label}」匹配到 ${matchedSourceItems.length} 条记录（${matchedSourceItems
          .map((item: any) => item.examinationType)
          .join("、")}），已使用第一条有效数据`
      );
    }

    const appliedUserNames: string[] = [];

    rule.targetUserNames.forEach(userName => {
      const targetItems = items.filter(
        item =>
          item.userName === userName &&
          isKeywordMatched(item.examinationType, rule.targetMetricKeywords)
      );

      if (targetItems.length === 0) {
        console.warn(
          `[月度指标导出] 未找到 ${userName} 的「${targetLabel}」，跳过关联`
        );
        return;
      }

      if (targetItems.length > 1) {
        console.warn(
          `[月度指标导出] ${userName} 的「${targetLabel}」匹配到 ${targetItems.length} 条记录（${targetItems
            .map((item: any) => item.examinationType)
            .join("、")}），已全部按 ${rule.sourceUserName} 的数据覆盖`
        );
      }

      targetItems.forEach(item => {
        // 深拷贝，避免后续排序等操作互相影响
        item.examination = JSON.parse(JSON.stringify(sourceItem.examination));
        item.calculationType = sourceItem.calculationType;
      });
      appliedUserNames.push(userName);
    });

    if (appliedUserNames.length > 0) {
      console.log(
        `[月度指标导出] 已将 ${rule.sourceUserName} 的「${rule.label}」目标值/达成值关联至「${targetLabel}」：${appliedUserNames.join("、")}`
      );
    }
  });
};

// 临时排除规则：按「考核月份」排除指定用户的全部数据（格式 YYYY-MM）
// 例：刘天然 2026 年 10 月无数据，但年度结果接口仍会返回其指标，临时从人事导出中排除
const TEMPORARY_EXCLUDED_USERS_BY_ASSESSED_MONTH: Record<string, string[]> = {
  刘天然: ["2026-10"]
};

// 获取考核月份（导出月份的上一个月），如导出 2026-11 → 考核 2026-10
const getAssessedMonthKey = (year: number, exportMonth: number) =>
  dayjs(`${year}-${exportMonth}-01`).subtract(1, "month").format("YYYY-MM");

// 按临时规则过滤原始数据
const filterTemporaryExcludedRecords = <T extends { username?: string }>(
  records: T[],
  year: number,
  exportMonth: number
): T[] => {
  const assessedMonth = getAssessedMonthKey(year, exportMonth);
  const filtered = records.filter(record => {
    const username = String(record.username || "").trim();
    const excludedMonths = TEMPORARY_EXCLUDED_USERS_BY_ASSESSED_MONTH[username];
    return !excludedMonths?.includes(assessedMonth);
  });

  if (filtered.length !== records.length) {
    console.log(
      `[月度指标导出] 临时规则：已排除 ${assessedMonth} 的 ${records.length - filtered.length} 条数据`
    );
  }

  return filtered;
};

interface MonthlyMetricOtherConfig {
  calculationType?: number;
  notifyUserList?: Array<number | string>;
}

interface MonthData {
  month?: string;
  value?: number;
  [property: string]: any;
}

interface MetricItem {
  data?: MonthData[];
  dataType?: string;
  [property: string]: any;
}

interface MonthlyMetricResultRecord {
  jobNum?: string;
  metric?: MetricItem[];
  nodeId?: number;
  nodeName?: string;
  otherConfig?: string;
  targetName?: string;
  metricType?: number | string;
  metricId?: string;
  kpiDepict?: string;
  rate?: string;
  treePath?: string;
  treePathName?: string;
  userId?: number;
  username?: string;
  existSqlConfig?: number; // 0=手填，1=服务端计算
  [property: string]: any;
}

// 处理后的月度指标数据接口
export interface ProcessedMonthlyMetricData {
  userId?: string | number;
  userName?: string;
  jobNum?: string;
  metricType?: number | string;
  metricId?: string;
  kpiDepict?: string;
  rate?: string;
  examinationType?: string;
  examinationGroup?: string | null;
  calculationType?: number;
  // 计算后的值
  previousMonthTarget?: number; // 上月目标值
  previousMonthActual?: number; // 上月实际值
  currentMonthTarget?: number; // 本月目标值
  completionRate?: number; // 完成率
}

// 解析 otherConfig 为对象
const parseMonthlyMetricOtherConfig = (
  otherConfig?: string | null
): MonthlyMetricOtherConfig => {
  if (!otherConfig || otherConfig.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(otherConfig);
    return parsed || {};
  } catch (error) {
    console.error("解析月度指标 otherConfig 失败:", error);
    return {};
  }
};

// 获取月度指标的全量数据（按年）
const fetchMonthlyMetricFullData = async (year?: number) => {
  const targetYear = year || dayjs().year();
  const startDate = dayjs(`${targetYear}-01-01`).format("YYYY-MM-DD");
  const endDate = dayjs(`${targetYear}-12-31`).format("YYYY-MM-DD");

  try {
    const res: any = await getPmKpiMonthMetricTargetResultList({
      startDate,
      endDate
    });

    if (res.code !== 200 && !res.success) {
      throw new Error(res.msg || "获取月度指标数据失败");
    }

    const data = res.data || [];

    // 添加调试日志，看看梁钰的数据是否在接口返回的数据中
    const liangYuData = data.filter((item: any) => item.username === "梁钰");
    console.log("fetchMonthlyMetricFullData：梁钰的数据：", liangYuData);
    console.log("fetchMonthlyMetricFullData：总数据条数：", data.length);

    return data;
  } catch (error) {
    console.error("获取月度指标数据失败:", error);
    throw error;
  }
};

// 将月度指标数据转换为按用户+指标类型分组的累计数据格式
const transformMonthlyMetricData = (records: MonthlyMetricResultRecord[]) => {
  // 先按用户和指标分组，收集全年的月度数据
  const groupedData: any = {};

  records.forEach(record => {
    const {
      userId,
      username,
      jobNum,
      metric = [],
      targetName,
      nodeName,
      otherConfig,
      metricType,
      metricId,
      kpiDepict,
      rate,
      status
    } = record;

    // 排除 status=0 的数据
    if (status === 0) return;

    // 所有 status=1 的指标都需要处理，不管有没有 calculationType
    const parsedOtherConfig = parseMonthlyMetricOtherConfig(otherConfig);

    // 将 userId 转换为字符串，虽然不用它作为 key 了，但还是保存起来
    const userIdStr = String(userId);
    // 使用 username + jobNum 组合作为 key，避免大整数精度丢失问题
    const key = `${username}-${jobNum}-${targetName}`;

    // 对于梁钰的数据，或者 examination 数组为空的情况下，始终重新初始化
    const isLiangYu = username === "梁钰";
    if (
      !groupedData[key] ||
      isLiangYu ||
      groupedData[key].examination.length === 0
    ) {
      groupedData[key] = {
        id: null,
        month: null,
        userId: userIdStr, // 存储字符串形式的 userId
        userName: username,
        jobNum: jobNum,
        metricType: metricType,
        metricId: metricId,
        kpiDepict: kpiDepict,
        rate: rate,
        examinationTypeId: null,
        examinationType: targetName,
        targetType: null,
        department1: null,
        department2: null,
        position: null,
        examinationGroup: nodeName || null,
        target: null,
        achieved: null,
        calculationType: parsedOtherConfig.calculationType || -1, // -1 表示人工填报
        examination: []
      };

      // 填充 examination 数组
      if (metric && metric.length > 0) {
        // 直接复用新接口返回的 examination 数据结构
        metric.forEach(m => {
          let dataType = m.dataType;
          // 确保 dataType 符合老接口格式要求
          if (dataType === "target") dataType = "目标值";
          if (dataType === "actual") dataType = "实际达成值";

          groupedData[key].examination.push({
            dataType: dataType,
            data: m.data || []
          });
        });
      }
    }

    // 输出调试日志，看看梁钰的数据是否被处理
    if (username === "梁钰") {
      console.log("处理梁钰的数据：", {
        userId,
        username,
        jobNum,
        targetName,
        key,
        metricLength: metric?.length,
        examinationLength: groupedData[key].examination.length,
        record
      });
    }
  });

  // 转换为数组格式
  const result = Object.values(groupedData);

  // 应用指标数据关联规则（如：俞梦秋/季节/蒙炳如 复用黄向前的商品卡+短视频指标数据）
  applyReferenceMetricRules(result as any[]);

  return result;
};

/**
 * 检查上月手填数据是否符合要求
 * @param rawData 原始数据
 * @param year 指定年份，默认当前年
 * @param month 指定当前月份（1-12），默认当前月
 * @returns 是否符合要求，以及不符合时的错误信息
 */
const checkLastMonthManualData = (
  rawData: MonthlyMetricResultRecord[],
  year?: number,
  month?: number
) => {
  // 获取指定年份和月份（默认当前）
  const currentYear = year || dayjs().year();
  const currentMonth = month || dayjs().month() + 1; // month() 是 0-11
  const previousMonth = currentMonth - 1;
  const previousMonthDate = getFirstDayOfMonth(currentYear, previousMonth);

  // console.log(
  //   `检查 ${currentYear}年${previousMonth}月 (${previousMonthDate}) 的手填数据...`
  // );
  // console.log(`原始数据条数: ${rawData.length}`);

  const invalidRecords: Array<{
    username: string;
    targetName: string;
    targetValue: number;
    achievedValue: number | null;
  }> = [];

  rawData.forEach((record, index) => {
    // 排除 status=0 的数据
    if (record.status === 0) return;

    // 解析 otherConfig
    const otherConfig = parseMonthlyMetricOtherConfig(record.otherConfig);

    // console.log(`\n处理第 ${index + 1} 条记录:`, {
    //   userId: record.userId,
    //   username: record.username,
    //   targetName: record.targetName,
    //   existSqlConfig: record.existSqlConfig,
    //   otherConfig: record.otherConfig
    // });

    // 判断是否为手填数据：existSqlConfig === 0 表示人工填报
    const isManual = record.existSqlConfig === 0;

    if (isManual) {
      console.log(
        `✅ 发现手填类型指标: 用户=${record.username}, 指标=${record.targetName}`
      );

      // 查找上月数据
      const metric = record.metric || [];
      let targetValue: number | null = null;
      let achievedValue: number | null = null;

      metric.forEach(m => {
        const data = m.data || [];
        data.forEach(d => {
          if (d.month === previousMonthDate) {
            if (m.dataType === "target" || m.dataType === "目标值") {
              targetValue = toNumber(d.value);
              // console.log(`  - 目标值 (${d.month}): ${targetValue}`);
            }
            if (m.dataType === "actual" || m.dataType === "实际达成值") {
              achievedValue = toNumber(d.value);
              // console.log(`  - 完成值 (${d.month}): ${achievedValue}`);
            }
          }
        });
      });

      // 检查条件：目标值不等于0，且完成值为0或null
      if (targetValue !== null && targetValue !== 0) {
        if (achievedValue === null || achievedValue === 0) {
          console.log(
            `  ❌ 不符合要求: 目标值=${targetValue}, 完成值=${achievedValue}`
          );
          invalidRecords.push({
            username: record.username || "未知用户",
            targetName: record.targetName || "未知指标",
            targetValue: targetValue,
            achievedValue: achievedValue
          });
        } else {
          // console.log(`  ✅ 符合要求`);
        }
      } else {
        // console.log(`  - 跳过（目标值为空或0）`);
      }
    } else {
      // console.log(
      //   `- 非手填类型指标 (existSqlConfig=${record.existSqlConfig})，跳过`
      // );
    }
  });

  // console.log(`\n检查完成，发现 ${invalidRecords.length} 条不符合要求的记录`);

  return {
    isValid: invalidRecords.length === 0,
    invalidRecords
  };
};

/**
 * 计算月度指标数据并返回处理后的数组（不导出Excel，不做校验）
 * @param year 指定年份，默认当前年
 * @param currentMonth 指定当前月份（1-12），默认当前月
 * @param applyTemporaryExclusions 是否应用临时排除规则（人事导出时传 true）
 * @returns 处理后的月度指标数据数组
 */
export const calculateMonthlyMetricData = async (
  year?: number,
  currentMonth?: number,
  applyTemporaryExclusions = false
): Promise<ProcessedMonthlyMetricData[]> => {
  try {
    // 获取实际使用的年份和月份（参数优先，默认当前）
    const curYear = year || dayjs().year();
    const curMonth = currentMonth || dayjs().month() + 1; // 当前月份（1-12）

    // 获取月度指标数据并转换格式
    const allRawData = await fetchMonthlyMetricFullData(curYear);
    const rawData = applyTemporaryExclusions
      ? filterTemporaryExcludedRecords(allRawData, curYear, curMonth)
      : allRawData;
    const apiTableData = transformMonthlyMetricData(rawData);

    const previousMonth = curMonth - 1; // 上个月份

    const result: ProcessedMonthlyMetricData[] = [];

    apiTableData.forEach((dataItem: any) => {
      // 添加调试日志
      if (dataItem.userName === "梁钰") {
        console.log("calculateMonthlyMetricData 处理梁钰的数据：", {
          dataItem,
          examinationLength: dataItem.examination?.length,
          examination: dataItem.examination
        });
      }

      const examination = dataItem.examination;
      const calculationType = dataItem.calculationType;

      // 确保有足够的 examination 数据
      if (!examination || examination.length < 2) {
        console.warn(
          `examination 数据不足：${dataItem.userName} - ${dataItem.examinationType}`
        );
        return;
      }

      const targetData = examination[0]?.data || []; // 目标值
      const actualData = examination[1]?.data || []; // 实际值

      // 按月份排序数据
      targetData.sort((a: any, b: any) => a.month.localeCompare(b.month));
      actualData.sort((a: any, b: any) => a.month.localeCompare(b.month));

      let valueI = 0; // 上月目标值
      let valueK = 0; // 上月实际值
      let valueO = 0; // 本月目标值

      // 根据 calculationType 使用不同的计算逻辑
      if (calculationType === 1) {
        // 混合模式：目标值累计，实际值当月
        valueI = targetData
          .slice(
            0,
            findObjectByMonthIndex(targetData, previousMonth, curYear) + 1
          )
          .reduce(sumDataValue, 0);

        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth, curYear)
            ?.value || 0;

        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, curMonth, curYear) + 1)
          .reduce(sumDataValue, 0);
      } else if (calculationType === 2) {
        // 累计模式：目标值和实际值都累计
        valueI = targetData
          .slice(
            0,
            findObjectByMonthIndex(targetData, previousMonth, curYear) + 1
          )
          .reduce(sumDataValue, 0);

        valueK = actualData
          .slice(
            0,
            findObjectByMonthIndex(actualData, previousMonth, curYear) + 1
          )
          .reduce(sumDataValue, 0);

        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, curMonth, curYear) + 1)
          .reduce(sumDataValue, 0);
      } else if (calculationType === 3) {
        // 当月模式：目标值和实际值都取当月
        valueI =
          findObjectByMonthWithFirstDay(targetData, previousMonth, curYear)
            ?.value || 0;
        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth, curYear)
            ?.value || 0;
        valueO =
          findObjectByMonthWithFirstDay(targetData, curMonth, curYear)?.value ||
          0;
      } else if (calculationType === 4) {
        // 自定义模式：需要在这里单独写逻辑的指标
        // ⚠️ 侯子洋「好适嘉项目累计净毛利」「好适嘉项目净毛利20%」已改为「累计模式」（calculationType = 2），
        // 原「取上上个月当月值（单月，不累计）」的自定义逻辑已停用，保留代码备查，如需恢复取消注释即可。
        // if (
        //   dataItem.userName === "侯子洋" &&
        //   (dataItem.examinationType === "好适嘉项目累计净毛利" ||
        //     dataItem.examinationType === "好适嘉项目净毛利20%")
        // ) {
        //   // 侯子洋 好适嘉项目累计净毛利 / 好适嘉项目净毛利20%：取上上个月的当月数据（单月，不累计）
        //   // 例：导出8月（考核7月），上月取6月单月值，本月目标取7月单月值
        //   valueI =
        //     findObjectByMonthWithFirstDay(
        //       targetData,
        //       previousMonth - 1,
        //       curYear
        //     )?.value || 0;
        //
        //   valueK =
        //     findObjectByMonthWithFirstDay(
        //       actualData,
        //       previousMonth - 1,
        //       curYear
        //     )?.value || 0;
        //
        //   valueO =
        //     findObjectByMonthWithFirstDay(targetData, curMonth - 1, curYear)
        //       ?.value || 0;
        // } else {
        //   // 其他 calculationType 为 4 但没有定义逻辑的指标，不计算
        //   console.warn(
        //     `未定义 calculationType 为 4 的指标逻辑：${dataItem.userName} - ${dataItem.examinationType}`
        //   );
        //   return;
        // }
        // 其他 calculationType 为 4 但没有定义逻辑的指标，不计算
        console.warn(
          `未定义 calculationType 为 4 的指标逻辑：${dataItem.userName} - ${dataItem.examinationType}`
        );
        return;
      } else if (calculationType === -1) {
        // 人工填报：直接取上个月的目标值和实际值，以及当前月的目标值
        valueI =
          findObjectByMonthWithFirstDay(targetData, previousMonth, curYear)
            ?.value || 0;
        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth, curYear)
            ?.value || 0;
        valueO =
          findObjectByMonthWithFirstDay(targetData, curMonth, curYear)?.value ||
          0;
      }

      // 统一转成 number
      valueI = toNumber(valueI);
      valueK = toNumber(valueK);
      valueO = toNumber(valueO);

      // 固定累计规则：如 黄向前 / 梁钰 / 方林霞 的「渠道全年累计销售收入GMV」
      // 1~9 月累计目标/完成值写死为固定值，10 月起在固定值上继续累加各月数据
      const fixedTargetRule = matchFixedCumulativeTargetRule(
        dataItem.userName,
        dataItem.examinationType
      );
      if (fixedTargetRule) {
        const incrementalStartMonth = fixedTargetRule.fixedThroughMonth + 1;
        valueI =
          fixedTargetRule.fixedCumulativeTarget +
          sumValueByMonthRange(
            targetData,
            incrementalStartMonth,
            previousMonth,
            curYear
          );
        valueO =
          fixedTargetRule.fixedCumulativeTarget +
          sumValueByMonthRange(
            targetData,
            incrementalStartMonth,
            curMonth,
            curYear
          );

        // 1~fixedThroughMonth 月的累计完成值同样写死，10 月起累加各月完成值
        if (fixedTargetRule.fixedCumulativeActual !== undefined) {
          valueK =
            fixedTargetRule.fixedCumulativeActual +
            sumValueByMonthRange(
              actualData,
              incrementalStartMonth,
              previousMonth,
              curYear
            );
        }

        // 固定值只对「考核 fixedThroughMonth 月及以后」成立；
        // 导出更早月份时，历史数据来自旧口径，结果不可用
        if (curMonth <= fixedTargetRule.fixedThroughMonth) {
          console.warn(
            `[月度指标导出] 注意：${dataItem.userName}「${dataItem.examinationType}」的 ` +
              `1-${fixedTargetRule.fixedThroughMonth} 月历史数据来自旧指标口径，` +
              `本次导出 ${curMonth} 月（考核 ${previousMonth} 月）结果可能不准确，请人工核对`
          );
        }

        console.log(
          `[月度指标导出] ${dataItem.userName}「${dataItem.examinationType}」按固定累计口径：` +
            `1-${fixedTargetRule.fixedThroughMonth}月累计目标=${fixedTargetRule.fixedCumulativeTarget}，` +
            `累计完成=${fixedTargetRule.fixedCumulativeActual ?? "取系统数据"}，` +
            `上月目标=${valueI}，上月完成=${valueK}，次月目标=${valueO}`
        );
      }

      // 计算完成率
      let completionRate = 0;
      if (valueI !== 0) {
        completionRate = (valueK / valueI) * 100;
      }

      result.push({
        userId: String(dataItem.userId), // 确保 userId 是字符串
        userName: dataItem.userName,
        jobNum: dataItem.jobNum,
        metricType: dataItem.metricType,
        metricId: dataItem.metricId,
        kpiDepict: dataItem.kpiDepict,
        rate: dataItem.rate,
        examinationType: dataItem.examinationType,
        examinationGroup: dataItem.examinationGroup,
        calculationType: dataItem.calculationType,
        previousMonthTarget: valueI,
        previousMonthActual: valueK,
        currentMonthTarget: valueO,
        completionRate: Number(Math.max(0, completionRate).toFixed(2))
      });
    });

    // 校验固定累计目标规则是否命中，避免指标改名后静默回退到系统累计值
    FIXED_CUMULATIVE_TARGET_RULES.forEach(rule => {
      const missingUsers: string[] = [];

      rule.userNames.forEach(userName => {
        const matchedItems = apiTableData.filter(
          (item: any) =>
            String(item.userName ?? "").trim() === userName &&
            isFixedTargetRuleMatched(rule, item.examinationType)
        );

        if (matchedItems.length === 0) {
          missingUsers.push(userName);
          return;
        }

        if (matchedItems.length > 1) {
          console.warn(
            `[月度指标导出] ${userName} 匹配到多条固定累计目标指标「${rule.label}」，` +
              `已全部按固定口径处理，请确认是否误命中：` +
              matchedItems.map((item: any) => item.examinationType).join("、")
          );
        }
      });

      if (missingUsers.length > 0) {
        console.warn(
          `[月度指标导出] 以下用户未匹配到固定累计目标指标「${rule.label}」，` +
            `将回退为系统累计目标，请检查指标名称：${missingUsers.join("、")}`
        );
      }
    });

    return result;
  } catch (error) {
    console.error("计算月度指标数据失败:", error);
    throw error;
  }
};

/**
 * 处理月度指标人事数据：从源数据直接遍历填充 Excel 后导出
 * @param sourceFileName 源文件名
 * @param outputFileName 输出文件名（不含扩展名）
 * @param year 指定年份，默认当前年
 * @param currentMonth 指定当前月份（1-12），默认当前月
 */
export const processAndExportMonthlyMetricForHR = async (
  sourceFileName?: string,
  outputFileName?: string,
  year?: number,
  currentMonth?: number
) => {
  try {
    const fileName = sourceFileName || "考核应用报表导出模板_202607031452.xlsx";

    // 获取当前年月（参数优先，默认当前）
    const curYear = year || dayjs().year();
    const curMonth = currentMonth || dayjs().month() + 1;

    // 获取月度指标数据并转换格式（应用临时排除规则）
    const rawData = filterTemporaryExcludedRecords(
      await fetchMonthlyMetricFullData(curYear),
      curYear,
      curMonth
    );

    // 获取当前登录用户信息
    let currentUserId = "";
    try {
      const userInfo = localStorage.getItem("user-check-info");
      if (userInfo) {
        const parsed = JSON.parse(userInfo);
        currentUserId = String(parsed?.id ?? "");
      }
    } catch (e) {
      console.error("获取用户信息失败:", e);
    }

    // 检查当前用户是否在白名单中，不在白名单才进行检查
    if (!SKIP_CHECK_USER_IDS.includes(currentUserId)) {
      // 检查上月手填数据
      const checkResult = checkLastMonthManualData(rawData, curYear, curMonth);
      if (!checkResult.isValid) {
        // 构建错误信息
        const previousMonth = curMonth - 1;

        let errorMsg = `${curYear}年${previousMonth}月数据中存在手填类型数据不符合要求：共发现 ${checkResult.invalidRecords.length} 条`;
        // console.log("详细不符合要求的记录:", checkResult.invalidRecords);
        throw new Error(errorMsg);
      }
    } else {
      // console.log("✅ 当前登录用户在白名单中，跳过数据检查");
    }

    const apiTableData = transformMonthlyMetricData(rawData);

    const filePath = `/Examination/${fileName}`;
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`无法访问文件：${fileName}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // 创建新的工作簿
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error("Excel 文件中没有工作表");
    }

    // 删除 E 列（第 5 列）
    worksheet.spliceColumns(5, 1);

    // 调整列宽
    worksheet.getColumn(8).width = 12; // H列 - 调窄
    worksheet.getColumn(10).width = 18; // J列 - 加宽
    worksheet.getColumn(12).width = 18; // L列 - 加宽
    worksheet.getColumn(14).width = 18; // N列 - 加宽

    // 清空从第 3 行开始的所有数据，并将所有单元格填充颜色设置为空
    let rowNumber = 3;
    while (worksheet.getRow(rowNumber).hasValues) {
      const row = worksheet.getRow(rowNumber);
      // 清空所有单元格值
      row.eachCell(cell => {
        cell.value = null;
        // 将所有单元格的填充颜色设置为空
        cell.fill = {
          type: "pattern",
          pattern: "none"
        };
      });
      rowNumber++;
    }

    // 先计算好所有数据
    const processedData = await calculateMonthlyMetricData(
      curYear,
      curMonth,
      true
    );

    // 获取当前月份
    const previousMonth = curMonth - 1; // 上个月份

    let modifiedCount = 0;

    // 定义计算类型名称映射
    const calculationTypeNames: { [key: number]: string } = {
      1: "混合模式",
      2: "累计模式",
      3: "当月模式",
      4: "自定义模式"
    };
    calculationTypeNames[-1] = "人工填报";

    // 按照 calculationType 对数据进行分组
    const groupedData: { [key: number]: any[] } = {};
    apiTableData.forEach((item: any) => {
      const type = item.calculationType || 0;
      if (!groupedData[type]) {
        groupedData[type] = [];
      }
      groupedData[type].push(item);
    });

    // 创建 processedData 的索引，方便快速查找
    const processedDataMap = new Map();
    processedData.forEach(item => {
      // 使用 username + jobNum + examinationType 作为 key，避免大整数精度丢失问题
      const key = `${item.userName}-${item.jobNum}-${item.examinationType}`;
      processedDataMap.set(key, item);
    });

    // 从第 3 行开始填充数据
    let currentRowNum = 3;
    // 按照类型顺序处理各组数据
    [1, 2, 3, 4, -1].forEach(type => {
      const items = groupedData[type];
      if (!items || items.length === 0) return;

      // 添加分组标题行
      const titleRow = worksheet.getRow(currentRowNum);
      // 在 A 列显示分组标题
      titleRow.getCell(1).value = calculationTypeNames[type] || "其他模式";
      // 设置标题行填充颜色为鲜艳的颜色
      const colors: { [key: number]: string } = {
        1: "FF90EE90", // 混合模式 - 淡绿色
        2: "FF87CEEB", // 累计模式 - 淡蓝色
        3: "FFFFD700", // 当月模式 - 金色
        4: "FFFFA07A" // 自定义模式 - 浅橙色
      };
      colors[-1] = "FFE0B0FF"; // 人工填报 - 浅紫色
      titleRow.eachCell(cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colors[type] || "FFE0E0E0" }
        };
      });
      currentRowNum++;

      // 填充该组的数据
      items.forEach((dataItem: any) => {
        // 添加调试日志
        if (dataItem.userName === "梁钰") {
          console.log("processAndExportMonthlyMetricForHR 处理梁钰的数据：", {
            dataItem,
            type
          });
        }

        const row = worksheet.getRow(currentRowNum);

        // A 列：工号
        row.getCell(1).value = dataItem.jobNum;
        // B 列：用户名
        row.getCell(2).value = dataItem.userName;
        // C 列：指标类型
        row.getCell(3).value = getMetricTypeText(dataItem.metricType);
        // D 列：指标名称（半角括号统一为中文括号）
        row.getCell(4).value = toChineseBrackets(dataItem.examinationType);
        // E 列（原 F 列）：指标ID
        row.getCell(5).value = dataItem.metricId;
        // F 列（原 G 列）：指标描述
        row.getCell(6).value = dataItem.kpiDepict;
        // G 列（原 H 列）：权重
        row.getCell(7).value = dataItem.rate;

        // 清空保留列的数据
        [9, 11, 13, 15, 16, 17].forEach(colNum => {
          row.getCell(colNum).value = null;
        });

        // 从 processedDataMap 中获取计算好的数据
        // 使用 username + jobNum + examinationType 作为 key，避免大整数精度丢失问题
        const key = `${dataItem.userName}-${dataItem.jobNum}-${dataItem.examinationType}`;
        const processedItem = processedDataMap.get(key);

        // 添加调试日志
        if (dataItem.userName === "梁钰") {
          console.log("查找梁钰的 processedItem：", {
            key,
            processedItem,
            allKeys: Array.from(processedDataMap.keys())
          });
        }

        if (!processedItem) {
          console.warn(
            `找不到计算后的数据：${dataItem.userName} - ${dataItem.examinationType}`
          );
          return;
        }

        // 填充到对应列
        row.getCell(8).value = Number(
          processedItem.previousMonthTarget?.toFixed(4) || 0
        );
        row.getCell(9).value = "元";
        row.getCell(10).value = Number(
          processedItem.previousMonthActual?.toFixed(4) || 0
        );
        row.getCell(11).value = "元";
        row.getCell(12).value = processedItem.completionRate;
        row.getCell(13).value = "%";
        row.getCell(14).value = Number(
          processedItem.currentMonthTarget?.toFixed(4) || 0
        );
        row.getCell(15).value = "元";

        // 添加调试日志
        if (dataItem.userName === "梁钰") {
          console.log("梁钰的数据已填充到 Excel，行号：", currentRowNum, {
            targetName: dataItem.examinationType,
            previousMonthTarget: processedItem.previousMonthTarget,
            previousMonthActual: processedItem.previousMonthActual
          });
        }

        modifiedCount++;
        currentRowNum++;
      });
    });

    // 删除 E 列（第 5 列）
    worksheet.spliceColumns(5, 1);

    // 由于添加了分组标题行，保留列的数据无法正确对应，所以暂不恢复保留列数据
    // 确保指标ID列（第5列，原F列）的所有单元格背景色都为空
    for (let r = 1; r <= worksheet.rowCount; r++) {
      const cell = worksheet.getRow(r).getCell(5);
      cell.fill = {
        type: "pattern",
        pattern: "none"
      };
    }

    // 末尾新增一列：姓名&指标名称（便于人事核对/引用）
    // 注意：两次删列后工作表尾部可能残留空列，这里以表头行最后一个非空列为准
    const headerRow = worksheet.getRow(2);
    let lastHeaderColumn = 0;
    for (let c = 1; c <= worksheet.columnCount; c++) {
      const headerValue = headerRow.getCell(c).value;
      if (
        headerValue !== null &&
        headerValue !== undefined &&
        String(headerValue).trim() !== ""
      ) {
        lastHeaderColumn = c;
      }
    }

    const nameAndMetricColumn = lastHeaderColumn + 1;
    const referenceHeaderCell = headerRow.getCell(lastHeaderColumn);
    const newHeaderCell = headerRow.getCell(nameAndMetricColumn);
    newHeaderCell.value = "姓名&指标名称";
    copyCellStyle(newHeaderCell, referenceHeaderCell);
    worksheet.getColumn(nameAndMetricColumn).width = 40;

    // 数据行用 B 列（姓名）和 D 列（指标名称）拼接；分组标题行没有这两个值，自动跳过
    for (let r = 3; r < currentRowNum; r++) {
      const row = worksheet.getRow(r);
      const userName = row.getCell(2).value;
      const metricName = row.getCell(4).value;

      if (!userName || !metricName) continue;

      const cell = row.getCell(nameAndMetricColumn);
      cell.value = `${userName}&${metricName}`;
      copyCellStyle(cell, row.getCell(4));
    }

    workbook.modified = new Date();
    workbook.lastModifiedBy = "Peidi PM System - Monthly Metric HR Export";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const finalFileName = `${outputFileName || "月度指标人事数据"}_${new Date().getTime()}.xlsx`;

    saveAs(blob, finalFileName);

    // console.log(`月度指标人事数据处理完成，共添加 ${modifiedCount} 行数据`);

    // 非白名单用户调用锁表接口，锁定上个月的数据
    if (!SKIP_CHECK_USER_IDS.includes(currentUserId)) {
      try {
        // 获取上个月的第一天作为锁表月份
        const monthStr = dayjs()
          .subtract(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD");

        await updateEditStatusApi({
          isEdit: 0,
          month: monthStr
        });
      } catch (error) {
        console.error("锁表调用失败:", error);
        // 这里不抛出错误，避免影响导出功能
      }
    }

    return { success: true, count: modifiedCount };
  } catch (error) {
    console.error("处理和导出月度指标人事数据失败:", error);
    throw new Error(
      `处理和导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};
