import {
  getPmKpiMonthMetricTargetResultList,
  updateEditStatusApi
} from "@/api/evaluation";
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
const findObjectByMonthWithFirstDay = (array: any[], month: number) => {
  return array.find(
    obj => obj.month === getFirstDayOfMonth(dayjs().year(), month)
  );
};

// 在对象数组里查找month为指定日期的对象 在 数组中的索引
const findObjectByMonthIndex = (array: any[], month: number) => {
  const idx = array.findIndex(
    obj => obj.month === getFirstDayOfMonth(dayjs().year(), month)
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
  "1926449443739601629" // 杨世豪
];

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
  userId?: number;
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

    return res.data || [];
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

    const key = `${userId}-${targetName}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        id: null,
        month: null,
        userId: userId,
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
  });

  // 转换为数组格式
  return Object.values(groupedData);
};

/**
 * 检查上月手填数据是否符合要求
 * @param rawData 原始数据
 * @returns 是否符合要求，以及不符合时的错误信息
 */
const checkLastMonthManualData = (rawData: MonthlyMetricResultRecord[]) => {
  // 获取当前年份和月份
  const now = dayjs(); // 2026-07-07
  const currentYear = now.year(); // 2026
  const currentMonth = now.month() + 1; // 7 (因为 month() 是 0-11)
  const previousMonth = currentMonth - 1; // 6
  const previousMonthDate = getFirstDayOfMonth(currentYear, previousMonth); // 2026-06-01

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
      // console.log(
      //   `✅ 发现手填类型指标: 用户=${record.username}, 指标=${record.targetName}`
      // );

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
          // 忽略侯子洋的"好适嘉项目净毛利20%"这条数据
          const isIgnoredRecord =
            record.username === "侯子洋" &&
            record.targetName === "好适嘉项目净毛利20%";

          if (!isIgnoredRecord) {
            // console.log(
            //   `  ❌ 不符合要求: 目标值=${targetValue}, 完成值=${achievedValue}`
            // );
            invalidRecords.push({
              username: record.username || "未知用户",
              targetName: record.targetName || "未知指标",
              targetValue: targetValue,
              achievedValue: achievedValue
            });
          } else {
            // console.log(`  - 忽略侯子洋的好适嘉项目净毛利20%数据`);
          }
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
 * @returns 处理后的月度指标数据数组
 */
export const calculateMonthlyMetricData = async (
  year?: number
): Promise<ProcessedMonthlyMetricData[]> => {
  try {
    // 获取月度指标数据并转换格式
    const rawData = await fetchMonthlyMetricFullData(year);
    const apiTableData = transformMonthlyMetricData(rawData);

    // 获取当前月份
    const currentMonth = dayjs().month() + 1; // 当前月份（1-12）
    const previousMonth = currentMonth - 1; // 上个月份

    const result: ProcessedMonthlyMetricData[] = [];

    apiTableData.forEach((dataItem: any) => {
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
          .slice(0, findObjectByMonthIndex(targetData, previousMonth) + 1)
          .reduce(sumDataValue, 0);

        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;

        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, currentMonth) + 1)
          .reduce(sumDataValue, 0);
      } else if (calculationType === 2) {
        // 累计模式：目标值和实际值都累计
        valueI = targetData
          .slice(0, findObjectByMonthIndex(targetData, previousMonth) + 1)
          .reduce(sumDataValue, 0);

        valueK = actualData
          .slice(0, findObjectByMonthIndex(actualData, previousMonth) + 1)
          .reduce(sumDataValue, 0);

        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, currentMonth) + 1)
          .reduce(sumDataValue, 0);
      } else if (calculationType === 3) {
        // 当月模式：目标值和实际值都取当月
        valueI =
          findObjectByMonthWithFirstDay(targetData, previousMonth)?.value || 0;
        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;
        valueO =
          findObjectByMonthWithFirstDay(targetData, currentMonth)?.value || 0;
      } else if (calculationType === 4) {
        // 自定义模式：需要在这里单独写逻辑的指标
        if (
          dataItem.userName === "侯子洋" &&
          dataItem.examinationType === "好适嘉项目净毛利20%"
        ) {
          // 侯子洋 好适嘉项目净毛利20%：取上上个月
          valueI = targetData
            .slice(
              0,
              findObjectByMonthIndex(targetData, previousMonth - 1) + 1
            )
            .reduce(sumDataValue, 0);

          valueK = actualData
            .slice(
              0,
              findObjectByMonthIndex(actualData, previousMonth - 1) + 1
            )
            .reduce(sumDataValue, 0);

          valueO = targetData
            .slice(
              0,
              findObjectByMonthIndex(targetData, currentMonth - 1) + 1
            )
            .reduce(sumDataValue, 0);
        } else {
          // 其他 calculationType 为 4 但没有定义逻辑的指标，不计算
          console.warn(
            `未定义 calculationType 为 4 的指标逻辑：${dataItem.userName} - ${dataItem.examinationType}`
          );
          return;
        }
      } else if (calculationType === -1) {
        // 人工填报：直接取上个月的目标值和实际值，以及当前月的目标值
        valueI =
          findObjectByMonthWithFirstDay(targetData, previousMonth)?.value || 0;
        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;
        valueO =
          findObjectByMonthWithFirstDay(targetData, currentMonth)?.value || 0;
      }

      // 统一转成 number
      valueI = toNumber(valueI);
      valueK = toNumber(valueK);
      valueO = toNumber(valueO);

      // 计算完成率
      let completionRate = 0;
      if (valueI !== 0) {
        completionRate = (valueK / valueI) * 100;
      }

      result.push({
        userId: dataItem.userId,
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
 */
export const processAndExportMonthlyMetricForHR = async (
  sourceFileName?: string,
  outputFileName?: string,
  year?: number
) => {
  try {
    const fileName = sourceFileName || "考核应用报表导出模板_202607031452.xlsx";

    // 获取月度指标数据并转换格式
    const rawData = await fetchMonthlyMetricFullData(year);

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
      const checkResult = checkLastMonthManualData(rawData);
      if (!checkResult.isValid) {
        // 构建错误信息
        const currentYear = dayjs().year();
        const currentMonth = dayjs().month() + 1;
        const previousMonth = currentMonth - 1;

        let errorMsg = `${currentYear}年${previousMonth}月数据中存在手填类型数据不符合要求：共发现 ${checkResult.invalidRecords.length} 条`;
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
    const processedData = await calculateMonthlyMetricData(year);

    // 获取当前月份
    const currentMonth = dayjs().month() + 1; // 当前月份（1-12）
    const previousMonth = currentMonth - 1; // 上个月份

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
      const key = `${item.userId}-${item.examinationType}`;
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
        const row = worksheet.getRow(currentRowNum);

        // A 列：工号
        row.getCell(1).value = dataItem.jobNum;
        // B 列：用户名
        row.getCell(2).value = dataItem.userName;
        // C 列：指标类型
        row.getCell(3).value = getMetricTypeText(dataItem.metricType);
        // D 列：指标名称
        row.getCell(4).value = dataItem.examinationType;
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
        const key = `${dataItem.userId}-${dataItem.examinationType}`;
        const processedItem = processedDataMap.get(key);

        if (!processedItem) {
          console.warn(
            `找不到计算后的数据：${dataItem.userName} - ${dataItem.examinationType}`
          );
          return;
        }

        // 填充到对应列
        row.getCell(8).value = processedItem.previousMonthTarget;
        row.getCell(9).value = "元";
        row.getCell(10).value = Number(processedItem.previousMonthActual?.toFixed(2) || 0);
        row.getCell(11).value = "%";
        row.getCell(12).value = processedItem.completionRate;
        row.getCell(13).value = "元";
        row.getCell(14).value = processedItem.currentMonthTarget;
        row.getCell(15).value = "元";

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

    workbook.modified = new Date();
    workbook.lastModifiedBy = "Peidi PM System - Monthly Metric HR Export";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const finalFileName = `${outputFileName || "月度指标人事数据"}_${new Date().getTime()}.xlsx`;

    saveAs(blob, finalFileName);

    // console.log(`月度指标人事数据处理完成，共添加 ${modifiedCount} 行数据`);

    // 非白名单用户调用锁表接口
    if (!SKIP_CHECK_USER_IDS.includes(currentUserId)) {
      try {
        // 获取当前月份作为锁表月份，格式为 "YYYY-MM-01"
        const monthStr = dayjs().format("YYYY-MM-01");

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
