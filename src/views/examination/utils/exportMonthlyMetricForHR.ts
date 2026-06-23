import { getPmKpiMonthMetricTargetResultList } from "@/api/evaluation";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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
  treePath?: string;
  treePathName?: string;
  userId?: number;
  username?: string;
  [property: string]: any;
}

//#region 辅助函数
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

// 解析 otherConfig 为对象
const parseMonthlyMetricOtherConfig = (otherConfig?: string | null): MonthlyMetricOtherConfig => {
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
    const { userId, username, jobNum, metric = [], targetName, nodeName, otherConfig } = record;

    // 只有有 calculationType 的指标才需要处理
    const parsedOtherConfig = parseMonthlyMetricOtherConfig(otherConfig);
    if (!parsedOtherConfig.calculationType) return;

    const key = `${userId}-${targetName}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        id: null,
        month: null,
        userId: userId,
        userName: username,
        examinationTypeId: null,
        examinationType: targetName,
        targetType: null,
        department1: null,
        department2: null,
        position: null,
        examinationGroup: nodeName || null,
        target: null,
        achieved: null,
        calculationType: parsedOtherConfig.calculationType,
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
    const fileName = sourceFileName || "考核应用报表导出模板_202604091814.xlsx";

    // 获取月度指标数据并转换格式
    const rawData = await fetchMonthlyMetricFullData(year);
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

    // 获取当前月份
    const currentMonth = dayjs().month() + 1; // 当前月份（1-12）
    const previousMonth = currentMonth - 1; // 上个月份

    let modifiedCount = 0;

    // 从第 3 行开始填充数据
    apiTableData.forEach((dataItem: any, index: number) => {
      const rowNumber = 3 + index;
      const row = worksheet.getRow(rowNumber);

      // B 列：用户名
      row.getCell(2).value = dataItem.userName;
      // E 列：指标名称
      row.getCell(5).value = dataItem.examinationType;

      const examination = dataItem.examination;
      const calculationType = dataItem.calculationType;

      // 确保有足够的 examination 数据
      if (!examination || examination.length < 2) {
        console.warn(`examination 数据不足：${dataItem.userName} - ${dataItem.examinationType}`);

        row.getCell(9).value = "未找到匹配的数据"; // I 列
        row.getCell(11).value = "未找到匹配的数据"; // K 列
        row.getCell(13).value = "未找到匹配的数据"; // M 列
        row.getCell(15).value = "未找到匹配的数据"; // O 列

        modifiedCount++;
        return;
      }

      const targetData = examination[0]?.data || []; // 目标值
      const actualData = examination[1]?.data || []; // 实际值

      // 按月份排序数据
      targetData.sort((a: any, b: any) => a.month.localeCompare(b.month));
      actualData.sort((a: any, b: any) => a.month.localeCompare(b.month));

      let valueI = 0; // I 列值
      let valueK = 0; // K 列值
      let valueO = 0; // O 列值

      // 根据 calculationType 使用不同的计算逻辑
      if (calculationType === 1) {
        // 混合模式：目标值累计，实际值当月
        valueI = targetData
          .slice(0, findObjectByMonthIndex(targetData, previousMonth) + 1)
          .reduce(sumDataValue, 0);

        valueK = findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;

        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, currentMonth) + 1)
          .reduce(sumDataValue, 0);
      } else if (calculationType === 2) {
        // 累计模式：目标值和实际值都累计
        // 侯子洋 好适嘉项目净毛利20% 单独处理 取上上个月
        if (
          dataItem.userName === "侯子洋" &&
          dataItem.examinationType === "好适嘉项目净毛利20%"
        ) {
          valueI = targetData
            .slice(0, findObjectByMonthIndex(targetData, previousMonth - 1) + 1)
            .reduce(sumDataValue, 0);

          valueK = actualData
            .slice(0, findObjectByMonthIndex(actualData, previousMonth - 1) + 1)
            .reduce(sumDataValue, 0);

          valueO = targetData
            .slice(0, findObjectByMonthIndex(targetData, currentMonth - 1) + 1)
            .reduce(sumDataValue, 0);
        } else {
          valueI = targetData
            .slice(0, findObjectByMonthIndex(targetData, previousMonth) + 1)
            .reduce(sumDataValue, 0);

          valueK = actualData
            .slice(0, findObjectByMonthIndex(actualData, previousMonth) + 1)
            .reduce(sumDataValue, 0);

          valueO = targetData
            .slice(0, findObjectByMonthIndex(targetData, currentMonth) + 1)
            .reduce(sumDataValue, 0);
        }
      } else if (calculationType === 3) {
        // 当月模式：目标值和实际值都取当月
        valueI = findObjectByMonthWithFirstDay(targetData, previousMonth)?.value || 0;
        valueK = findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;
        valueO = findObjectByMonthWithFirstDay(targetData, currentMonth)?.value || 0;
      }

      // 统一转成 number，避免接口返回字符串/null 导致 toFixed 报错
      valueI = toNumber(valueI);
      valueK = toNumber(valueK);
      valueO = toNumber(valueO);

      // 计算 M 列：完成率 (K/I*100)
      let valueM = 0;
      if (valueI !== 0) {
        valueM = (valueK / valueI) * 100;
      }

      // 填充到对应列
      row.getCell(9).value = valueI; // I 列
      row.getCell(11).value = Number(valueK.toFixed(2)); // K 列 保留两位小数
      row.getCell(13).value = Number(Math.max(0, valueM).toFixed(2)); // M 列 保留两位小数，小于 0 时为 0
      row.getCell(15).value = valueO; // O 列

      modifiedCount++;
    });

    workbook.modified = new Date();
    workbook.lastModifiedBy = "Peidi PM System - Monthly Metric HR Export";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const finalFileName = `${outputFileName || "月度指标人事数据"}_${new Date().getTime()}.xlsx`;

    saveAs(blob, finalFileName);

    console.log(
      `月度指标人事数据处理完成，共添加 ${modifiedCount} 行数据`
    );
    return { success: true, count: modifiedCount };
  } catch (error) {
    console.error("处理和导出月度指标人事数据失败:", error);
    throw new Error(
      `处理和导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};
