import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * 导出Excel文件
 * @param data 表格数据
 * @param columns 列配置
 * @param fileName 文件名
 * @param sheetName 工作表名
 * @param monthList 月份列表
 */
export const exportToExcel = async (
  data: any[],
  columns: Array<{
    prop: string;
    label: string;
    width?: number;
    format?: (value: any) => string;
  }>,
  fileName: string = "导出数据",
  sheetName: string = "Sheet1",
  monthList: string[] = []
) => {
  try {
    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Peidi PM System";
    workbook.lastModifiedBy = "Peidi PM System";
    workbook.created = new Date();
    workbook.modified = new Date();

    // 添加工作表
    const worksheet = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0
      }
    });

    // 设置现代感样式
    const headerStyle = {
      font: {
        name: "微软雅黑",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" }
      },
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF2D5B8E" } // 深蓝色
      },
      border: {
        top: { style: "thin" as const, color: { argb: "FF2D5B8E" } },
        left: { style: "thin" as const, color: { argb: "FF2D5B8E" } },
        bottom: { style: "thin" as const, color: { argb: "FF2D5B8E" } },
        right: { style: "thin" as const, color: { argb: "FF2D5B8E" } }
      },
      alignment: {
        vertical: "middle" as const,
        horizontal: "center" as const,
        wrapText: true
      }
    };

    const dataStyle = {
      font: {
        name: "微软雅黑",
        size: 10,
        color: { argb: "FF333333" }
      },
      border: {
        top: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        left: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
        right: { style: "thin" as const, color: { argb: "FFE0E0E0" } }
      },
      alignment: {
        vertical: "middle" as const,
        horizontal: "left" as const,
        wrapText: true
      }
    };

    const alternateRowStyle = {
      ...dataStyle,
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFF5F5F5" } // 浅灰色
      }
    };

    // 设置列宽
    columns.forEach((col, index) => {
      worksheet.getColumn(index + 1).width = col.width || 15;
    });

    // 添加表头
    const headerRow = worksheet.addRow(columns.map(col => col.label));
    headerRow.eachCell((cell, colNumber) => {
      cell.style = headerStyle;
    });
    headerRow.height = 25;

    // 添加数据行
    data.forEach((row, rowIndex) => {
      const dataRow = worksheet.addRow(
        columns.map(col => {
          const value = row[col.prop];
          return col.format ? col.format(value) : value;
        })
      );

      // 交替行颜色 - 修复空单元格样式问题
      for (let colNumber = 1; colNumber <= columns.length; colNumber++) {
        const cell = dataRow.getCell(colNumber);
        // 使用深拷贝避免样式对象引用问题
        const currentStyle =
          rowIndex % 2 === 0
            ? JSON.parse(JSON.stringify(dataStyle))
            : JSON.parse(JSON.stringify(alternateRowStyle));
        cell.style = currentStyle;

        const propTemp = columns[colNumber - 1].prop;
        if (propTemp === "dataSum" || monthList.includes(propTemp)) {
          cell.value = Number(cell.value);
          if (!isNaN(cell.value)) {
            const absoluteValue = Math.abs(cell.value);
            // 直接设置格式字符串
            if (absoluteValue >= 10000) {
              cell.numFmt = '0\\.0,"万""元"';
            } else {
              cell.numFmt = "";
            }
          }
        }
      }
      dataRow.height = 22;
    });

    // 冻结表头
    worksheet.views = [
      { state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }
    ];

    // 添加筛选器
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length }
    };

    // 生成Excel文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    // 保存文件
    saveAs(blob, `${fileName}_${new Date().getTime()}.xlsx`);

    return true;
  } catch (error) {
    console.error("导出Excel失败:", error);
    throw new Error("导出失败，请重试");
  }
};

/**
 * 导出绩效数据表格
 * @param tableData 表格数据
 * @param monthList 月份列表
 */
export const exportExaminationTable = async (
  tableData: any[],
  monthList: string[]
) => {
  const columns = [
    { prop: "department1", label: "一级部门", width: 20 },
    { prop: "department2", label: "二级部门", width: 20 },
    { prop: "examinationGroup", label: "考核组", width: 15 },
    { prop: "userName", label: "考核人", width: 15 },
    { prop: "examinationType", label: "指标名称", width: 20 },
    { prop: "dataType", label: "数据类型", width: 15 },
    {
      prop: "dataSum",
      label: "当前数据合计",
      width: 15
    },
    ...monthList.map(month => ({
      prop: month,
      label: month,
      width: 12
    }))
  ];

  await exportToExcel(
    tableData,
    columns,
    "绩效数据报表",
    "绩效数据",
    monthList
  );
};

export function formatNumber(value: any) {
  const number = Number(value);
  if (isNaN(number)) return value;
  if (number === 0) return "0";

  const isNegative = number < 0;
  const absoluteValue = Math.abs(number);

  if (absoluteValue >= 10000) {
    return `${isNegative ? "-" : ""}${(absoluteValue / 10000).toFixed(2)} 万元`;
  }

  return number.toFixed(4);
}
