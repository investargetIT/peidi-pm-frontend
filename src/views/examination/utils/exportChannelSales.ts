import { getPmKpiShopExaminationGroupStatistics } from "@/api/evaluation";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

//#region 配置区域 - 请根据实际Excel模板修改以下配置

/**
 * Excel分类 与 groupName 的映射关系
 * key: Excel中的分类名称
 * value: API数据中的groupName
 */
export const CATEGORY_MAPPING: Record<string, string> = {
  // 示例格式，请根据实际Excel模板内容修改
  // "Excel分类A": "API_groupName_A",
  // "Excel分类B": "API_groupName_B",
  天猫: "天猫团队",
  京东: "京东团队",
  抖音: "抖音团队",
  销售一组: "销售一组",
  销售二组: "销售二组",
  销售三组: "销售三组",
  哈宠: "哈宠团队",
  AAT: "AAT孵化项目组",
  Vivaland品牌项目组: "Vivaland品牌项目组"
};

/**
 * Excel列配置
 */
export const EXCEL_CONFIG = {
  // 分类名称所在的列号（从1开始）
  CATEGORY_COLUMN: 1,

  // 数据从第几行开始
  DATA_START_ROW: 6,

  // 月份列配置：列号 -> 月份（1-12）
  MONTH_COLUMNS: {
    3: 1,
    4: 2,
    5: 3,
    6: 4,
    7: 5,
    8: 6,
    9: 7,
    10: 8,
    11: 9,
    12: 10,
    13: 11,
    14: 12
  },

  // API数据中需要填充的字段名
  DATA_FIELD: "salesCollection"
};

//#endregion

//#region 辅助函数
const toNumber = (value: any) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

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
//#endregion

/**
 * 获取各渠道销售汇总数据
 * @param year 指定年份
 * @returns Promise<any[]>
 */
const fetchChannelSalesData = async (year?: number) => {
  const targetYear = year || dayjs().year();

  try {
    const res: any = await getPmKpiShopExaminationGroupStatistics({
      year: targetYear
    });

    if (res.success && res.data) {
      return res.data;
    }
    return [];
  } catch (error) {
    console.error("获取各渠道销售汇总数据失败:", error);
    throw error;
  }
};


/**
 * 处理各渠道销售收款及OBM总营收数据：从源数据直接遍历填充 Excel 后导出
 * @param sourceFileName 源文件名
 * @param outputFileName 输出文件名（不含扩展名）
 * @param year 指定年份，默认当前年
 */
export const processAndExportChannelSales = async (
  sourceFileName?: string,
  outputFileName?: string,
  year?: number
) => {
  try {
    const fileName =
      sourceFileName || "各渠道销售收款及OBM总营收数据模板_202607071419.xlsx";

    // 获取各渠道销售汇总数据
    const apiData = await fetchChannelSalesData(year);

    // 将API数据转换为map形式，方便查找
    const dataMap = new Map<string, any>();
    apiData.forEach((item: any) => {
      dataMap.set(item.groupName, item);
    });

    console.log("========== 导出调试信息 ==========");
    console.log(`获取到 ${apiData.length} 条数据`);
    console.log("API数据groupName列表:", apiData.map((item: any) => item.groupName));
    console.log("映射表配置:", CATEGORY_MAPPING);

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

    const targetYear = year || dayjs().year();

    let modifiedCount = 0;
    let skippedCount = 0;

    // 遍历Excel行
    for (
      let rowNumber = EXCEL_CONFIG.DATA_START_ROW;
      rowNumber <= worksheet.rowCount;
      rowNumber++
    ) {
      const row = worksheet.getRow(rowNumber);

      // 获取分类名称
      const categoryName =
        row.getCell(EXCEL_CONFIG.CATEGORY_COLUMN).value?.toString() || "";

      if (!categoryName || categoryName.trim() === "") {
        continue;
      }

      // 在映射表中查找对应的groupName
      const mappedGroupName = CATEGORY_MAPPING[categoryName];

      if (!mappedGroupName) {
        console.log(`跳过行 ${rowNumber}：分类 "${categoryName}" 未配置映射`);
        skippedCount++;
        continue;
      }

      // 在API数据中查找匹配的groupName
      const matchedData = dataMap.get(mappedGroupName);

      if (!matchedData) {
        console.log(
          `跳过行 ${rowNumber}：分类 "${categoryName}" (${mappedGroupName}) 未找到匹配数据`
        );
        skippedCount++;
        continue;
      }

      // 找到了匹配数据，开始填充
      console.log(`处理行 ${rowNumber}：${categoryName} -> ${mappedGroupName}`);

      const monthData = matchedData.monthData || [];

      // 填充各月份数据
      let filledCount = 0;
      for (const [colNum, monthNum] of Object.entries(EXCEL_CONFIG.MONTH_COLUMNS)) {
        const monthStr = getFirstDayOfMonth(targetYear, Number(monthNum));
        const monthItem = monthData.find((m: any) => m.month === monthStr);

        if (monthItem && monthItem[EXCEL_CONFIG.DATA_FIELD] !== undefined) {
          const value = monthItem[EXCEL_CONFIG.DATA_FIELD];
          // 数据是元，转换为万元
          const valueInWan = toNumber(value) / 10000;
          row.getCell(Number(colNum)).value = valueInWan;
          filledCount++;
        }
      }
      console.log(`  填充了 ${filledCount} 个月份的数据`);

      modifiedCount++;
    }

    workbook.modified = new Date();
    workbook.lastModifiedBy = "Peidi PM System - Channel Sales Export";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const finalFileName = `${outputFileName || "各渠道销售收款及OBM总营收数据"}_${new Date().getTime()}.xlsx`;

    saveAs(blob, finalFileName);

    console.log(
      `数据处理完成，共修改 ${modifiedCount} 行，跳过 ${skippedCount} 行`
    );

    return {
      success: true,
      modifiedCount,
      skippedCount,
      message: `成功导出 ${modifiedCount} 行数据，跳过 ${skippedCount} 行`
    };
  } catch (error) {
    console.error("处理和导出各渠道销售数据失败:", error);
    throw new Error(
      `处理和导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};

/**
 * 调试函数：打印Excel模板的完整结构
 */
export const debugExcelTemplate = async (fileName?: string) => {
  const targetFileName = fileName || "各渠道销售收款及OBM总营收数据模板_202607071419.xlsx";
  const filePath = `/Examination/${targetFileName}`;

  console.log("========== 调试Excel模板结构 ==========");
  console.log("正在读取:", filePath);

  const response = await fetch(filePath);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    console.error("没有找到工作表");
    return;
  }

  console.log(`工作表共有 ${worksheet.rowCount} 行，${worksheet.columnCount} 列`);
  console.log("\n========== 前20行数据 ==========");

  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowData: any[] = [];

    for (let colNum = 1; colNum <= Math.min(20, worksheet.columnCount); colNum++) {
      const cell = row.getCell(colNum);
      const value = cell.value;
      if (value !== undefined && value !== null && value !== "") {
        rowData.push(`[${colNum}]:${value}`);
      }
    }

    if (rowData.length > 0) {
      console.log(`行 ${rowNum}:`, rowData.join(" | "));
    }
  }
};

/**
 * 更新映射表配置的辅助函数
 * @param newMapping 新的映射关系
 */
export const updateCategoryMapping = (newMapping: Record<string, string>) => {
  Object.assign(CATEGORY_MAPPING, newMapping);
  console.log("映射表已更新:", CATEGORY_MAPPING);
};
