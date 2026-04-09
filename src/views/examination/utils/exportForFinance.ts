import { getExaminationRecordResult } from "@/api/pmApi";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * 读取 public 目录下的 Excel 文件
 * @param fileName 文件名（包含扩展名）
 * @returns Promise<{ workbook: ExcelJS.Workbook; worksheet: ExcelJS.Worksheet; jsonData: any[] }>
 */
export const readExcelFile = async (fileName: string) => {
  try {
    // 构建文件路径
    const filePath = `/Examination/${fileName}`;

    // 通过 fetch 获取文件
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`无法访问文件：${fileName}，状态码：${response.status}`);
    }

    // 获取文件的 ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // 使用 ExcelJS 读取工作簿
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // 获取第一个工作表
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error("Excel 文件中没有工作表");
    }

    // 将工作表数据转换为 JSON 格式
    const jsonData: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      // if (rowNumber === 1) {
      //   // 第一行作为表头
      //   return;
      // }

      const rowData: any = {};
      row.eachCell((cell, colNumber) => {
        const headerCell = worksheet.getRow(1).getCell(colNumber);
        const header = headerCell.value?.toString() || `Column${colNumber}`;
        rowData[header] = cell.value;
      });

      jsonData.push(rowData);
    });

    return {
      workbook,
      worksheet,
      jsonData
    };
  } catch (error) {
    console.error("读取 Excel 文件失败:", error);
    throw new Error(
      `读取 Excel 文件失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};

/**
 * 读取示例考核目标文件 - OBM前台 26 年 2 月绩效
 * @returns Promise<{ workbook: ExcelJS.Workbook; worksheet: ExcelJS.Worksheet; jsonData: any[] }>
 */
export const readOBMPerformanceFile = async () => {
  const fileName = "考核应用报表导出模板.xlsx";
  return await readExcelFile(fileName);
};

/**
 * 处理 OBM 绩效数据：根据 API 数据填充 Excel 指定列后导出
 * @param sourceFileName 源文件名
 * @param outputFileName 输出文件名（不含扩展名）
 */
export const processAndExportOBMData = async (
  sourceFileName?: string,
  outputFileName?: string
) => {
  try {
    const fileName = sourceFileName || "考核应用报表导出模板_202604091814.xlsx";

    // 获取 API 数据
    const { tableData: apiTableData } = await fetchOBMPerformanceData();

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

    // 先删除第 72 行和第 32 行（从下往上删除，避免行号变化）
    try {
      const rowsToDelete = [72, 32].filter(
        rowNum => rowNum <= worksheet.rowCount
      );

      rowsToDelete.forEach(rowNum => {
        worksheet.spliceRows(rowNum, 1);
        console.log(`已删除第 ${rowNum} 行`);
      });
    } catch (error) {
      console.error("删除行失败:", error);
    }

    // 定义需要跳过的行号
    const skipRows = [1, 2];

    // 定义需要修改的列号（I=9, K=11, M=13, O=15）
    const targetColumns = [9, 11, 13, 15];

    // 获取当前月份
    const currentMonth = dayjs().month() + 1; // 当前月份（1-12）
    // console.log("当前月份：", currentMonth);
    const previousMonth = currentMonth - 1; // 上个月份

    let modifiedCount = 0;

    // 逐行处理
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      // 跳过指定的行
      if (skipRows.includes(rowNumber)) {
        continue;
      }

      const row = worksheet.getRow(rowNumber);

      // 读取 B 列（userName）和 E 列（examinationType）
      const userName = row.getCell(2).value?.toString() || "";
      const examinationType = row.getCell(5).value?.toString() || "";

      // 根据 userName 和 examinationType 匹配 API 数据
      const matchedData = apiTableData.find(
        (item: any) =>
          item.userName === userName && item.examinationType === examinationType
      );
      // console.log("matchedData", matchedData);

      // 未找到匹配数据时，填充提示文字
      if (!matchedData || !matchedData.examination) {
        console.warn(`未找到匹配的数据：${userName} - ${examinationType}`);

        // 在 I、K、M、O 列填充"未找到匹配的数据"
        row.getCell(9).value = "未找到匹配的数据"; // I 列
        row.getCell(11).value = "未找到匹配的数据"; // K 列
        row.getCell(13).value = "未找到匹配的数据"; // M 列
        row.getCell(15).value = "未找到匹配的数据"; // O 列

        modifiedCount++;
        continue;
      }

      const examination = matchedData.examination;

      // 确保有足够的 examination 数据
      if (examination.length < 2) {
        console.warn(`examination 数据不足：${userName} - ${examinationType}`);

        // 在 I、K、M、O 列填充"未找到匹配的数据"
        row.getCell(9).value = "未找到匹配的数据"; // I 列
        row.getCell(11).value = "未找到匹配的数据"; // K 列
        row.getCell(13).value = "未找到匹配的数据"; // M 列
        row.getCell(15).value = "未找到匹配的数据"; // O 列

        modifiedCount++;
        continue;
      }

      const targetData = examination[0]?.data || []; // 目标值
      const actualData = examination[1]?.data || []; // 实际值

      // 按月份排序数据
      targetData.sort((a: any, b: any) => a.month.localeCompare(b.month));
      actualData.sort((a: any, b: any) => a.month.localeCompare(b.month));

      let valueI = 0; // I 列值
      let valueK = 0; // K 列值
      let valueO = 0; // O 列值

      // 根据不同行范围使用不同的计算逻辑
      if (rowNumber >= 3 && rowNumber <= 31) {
        // 第 3-31 行：累计值计算（行号不变）
        // I 列：前 previousMonth 个月的目标值之和
        // console.log("累计", findObjectByMonthIndex(targetData, previousMonth));
        valueI = targetData
          .slice(0, findObjectByMonthIndex(targetData, previousMonth) + 1)
          .reduce((sum: number, item: any) => sum + item.value, 0);

        // K 列：前 previousMonth 个月的实际值之和
        valueK = actualData
          .slice(0, findObjectByMonthIndex(actualData, previousMonth) + 1)
          .reduce((sum: number, item: any) => sum + item.value, 0);

        // O 列：前 currentMonth 个月的目标值之和
        valueO = targetData
          .slice(0, findObjectByMonthIndex(targetData, currentMonth) + 1)
          .reduce((sum: number, item: any) => sum + item.value, 0);
      } else if (
        (rowNumber >= 32 && rowNumber <= 70) ||
        (rowNumber >= 71 && rowNumber <= 81)
      ) {
        // 第 32-70 行和第 71-81 行：当月值计算
        // 原第 33-71 行 → 现第 32-70 行（删除第 32 行后前移 1 行）
        // 原第 73-83 行 → 现第 71-81 行（删除第 32 和 72 行后前移 2 行）

        // I 列：上个月的目标值（索引为 previousMonth）
        // console.log(
        //   "指定",
        //   findObjectByMonthWithFirstDay(targetData, previousMonth )
        // );
        valueI =
          findObjectByMonthWithFirstDay(targetData, previousMonth)?.value || 0;

        // K 列：上个月的实际值（索引为 previousMonth）
        valueK =
          findObjectByMonthWithFirstDay(actualData, previousMonth)?.value || 0;

        // O 列：当月的目标值（索引为 currentMonth）
        valueO =
          findObjectByMonthWithFirstDay(targetData, currentMonth)?.value || 0;
      }

      // 计算 M 列：完成率 (K/I*100)
      let valueM = 0;
      if (valueI !== 0) {
        valueM = (valueK / valueI) * 100;
      }

      // 填充到对应列
      row.getCell(9).value = valueI; // I 列
      row.getCell(11).value = valueK; // K 列
      row.getCell(13).value = Number(Math.max(0, valueM).toFixed(2)); // M 列，保留两位小数，小于 0 时为 0
      row.getCell(15).value = valueO; // O 列

      modifiedCount++;
    }

    workbook.modified = new Date();
    workbook.lastModifiedBy = "Peidi PM System - Modified";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const finalFileName = `${outputFileName || "OBM 绩效数据"}_${new Date().getTime()}.xlsx`;

    saveAs(blob, finalFileName);

    console.log(
      `数据处理完成，共修改 ${modifiedCount} 行，${modifiedCount * targetColumns.length} 个单元格`
    );
    return { success: true, count: modifiedCount };
  } catch (error) {
    console.error("处理和导出 Excel 失败:", error);
    throw new Error(
      `处理和导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};

//#region 辅助函数
// 获取指定月份的第一天
const getFirstDayOfMonth = (year: number, month: number) => {
  return dayjs(`${year}-${month}`).startOf("month").format("YYYY-MM-DD");
};
// 在对象数组里查找month为指定日期的对象
const findObjectByMonth = (array: any[], month: string) => {
  return array.find(obj => obj.month === month);
};
// 在对象数组里查找month为指定日期的对象 整合 获取指定月份的第一天
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

/**
 * 获取考核目标或指标数据（无需传参）
 * @returns Promise<{ monthList: string[]; tableData: any[] }>
 */
export const fetchOBMPerformanceData = async () => {
  try {
    const searchStr = JSON.stringify([
      {
        searchName: "month",
        searchType: "betweenStr",
        searchValue: [
          dayjs().startOf("year").format("YYYY-MM-DD"),
          dayjs().endOf("year").format("YYYY-MM-DD")
        ].join(",")
      }
    ]);

    const res: any = await getExaminationRecordResult({ searchStr });

    if (res.code !== 200) {
      throw new Error(res.msg || "获取数据失败");
    }

    if (res.data.length === 0) {
      return {
        monthList: [],
        tableData: []
      };
    }

    // 提取月份列表
    const monthList = res.data[0].examination[0].data
      .map((item: any) => item.month)
      .sort((a: string, b: string) => a.localeCompare(b));

    // 转换数据结构
    const tableData: any[] = [];
    res.data.forEach((item: any) => {
      item.examination.forEach((examinationItem: any) => {
        const monthData = examinationItem.data.reduce((acc: any, cur: any) => {
          acc[cur.month] = cur.value;
          return acc;
        }, {});
        tableData.push({
          ...item,
          ...examinationItem,
          dataSum: examinationItem.data.reduce(
            (acc: number, cur: any) => acc + cur.value,
            0
          ),
          ...monthData
        });
      });
    });

    console.log(`获取成功，共 ${tableData.length} 条数据`);

    return {
      monthList,
      tableData
    };
  } catch (error) {
    console.error("获取数据失败:", error);
    throw new Error(
      `获取数据失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};
