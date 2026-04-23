import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { ElMessage } from "element-plus";

interface ImageConfigItem {
  id: string;
  name: string;
  type: "image" | "text" | "group";
  remark?: string;
  content?: Array<{
    label: string;
    text: string;
  }>;
}

/**
 * 导出配置为 Excel 文件 - 单行表头格式，便于批量导入
 * @param imageConfig - 图片配置数组
 */
export const exportConfigToExcel = async (
  imageConfig: ImageConfigItem[],
  fileName?: string
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("配置导入模板");

    // 收集所有需要导出的字段，构建表头
    const headers: Array<{
      header: string;
      key: string;
      width: number;
      isAIRef?: boolean;
      // isKeepRef?: boolean;
      isEraseRef?: boolean;
      isImage?: boolean;
      isRemark?: boolean;
    }> = [];

    let colIndex = 0;
    imageConfig.forEach(item => {
      if (item.type === "text" && item.content) {
        // 文本类型：每个子字段占一列
        item.content.forEach(field => {
          headers.push({
            header: `${field.label}`,
            key: `col_${colIndex++}`,
            width: 20
          });
        });
      } else if (item.type === "image") {
        // 图片类型：名称列 + AI 引用列
        headers.push({
          header: `${item.name}`,
          key: `col_${colIndex++}`,
          width: 25,
          isImage: true
        });
        // headers.push({
        //   header: `${item.name}-AI 引用`,
        //   key: `col_${colIndex++}`,
        //   width: 15,
        //   isAIRef: true
        // });
        headers.push({
          header: `${item.name}-是否抹除`,
          key: `col_${colIndex++}`,
          width: 15,
          isEraseRef: true
        });
      } else if (item.type === "group" && item.content) {
        // 组合类型：每个子字段占一列
        item.content.forEach(field => {
          headers.push({
            header: `${field.label}(${item.name})`,
            key: `col_${colIndex++}`,
            width: 20
          });
        });
      }
    });

    // 添加备注列
    headers.push({
      header: `必做事项`,
      key: `col_${colIndex++}`,
      width: 30,
      isRemark: true
    });

    // 设置列
    worksheet.columns = headers;

    // 设置表头样式
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };

      // AI 引用列和是否保留列用不同颜色标记
      const colConfig = headers[colNum - 1];
      if (colConfig?.isImage) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4BACC6" }
        };
      } else if (colConfig?.isAIRef) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF70AD47" }
        };
      } else if (colConfig?.isEraseRef) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFB961" }
        };
      } else if (colConfig?.isRemark) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFD966" }
        };
      }
    });

    // 添加一行示例数据（可选，方便用户理解格式）
    const dataRow: any = {};
    headers.forEach((header, index) => {
      if (header.isAIRef || header.isEraseRef) {
        dataRow[`col_${index}`] = "是";
      } else {
        dataRow[`col_${index}`] = "";
      }
    });

    const rowInstance = worksheet.getRow(2);
    rowInstance.values = Object.values(dataRow);
    rowInstance.eachCell(cell => {
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // 设置行高
    worksheet.getRow(1).height = 30;
    worksheet.getRow(2).height = 25;

    // 生成 Excel 文件的 ArrayBuffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    // 下载文件
    const defaultFileName = `配置导入模板_${new Date().getTime()}.xlsx`;
    const finalFileName = fileName ? `${fileName}.xlsx` : defaultFileName;
    saveAs(blob, finalFileName);

    ElMessage.success("导出成功，请在 Excel 中填写后重新导入");
    return true;
  } catch (error) {
    console.error("导出 Excel 失败:", error);
    ElMessage.error("导出失败：" + (error as Error).message);
    throw error;
  }
};

/**
 * 从 Excel 文件导入配置数据
 * @param file - Excel 文件
 * @param imageConfig - 图片配置数组（用于解析列对应关系）
 * @returns 导入的配置数据数组，每行是一个配置对象
 */
export const importConfigFromExcel = async (
  file: File,
  imageConfig: ImageConfigItem[]
): Promise<Array<Record<string, any>>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);

        const worksheet = workbook.getWorksheet("配置导入模板");
        if (!worksheet) {
          throw new Error("未找到工作表");
        }

        // 获取表头行（第一行）
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];

        // 读取表头
        headerRow.eachCell(cell => {
          headers.push(cell.value as string);
        });

        // 解析数据行（从第 2 行开始）
        const importedData: Array<Record<string, any>> = [];

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // 跳过表头

          const rowData: Record<string, any> = {};
          let hasData = false;

          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            const value = cell.value;

            if (value && typeof value === "string" && value.trim()) {
              hasData = true;
            }

            // 判断是否是 AI 引用列
            if (header && header.includes("-AI 引用")) {
              const baseName = header.replace("-AI 引用", "");
              rowData[`${baseName}_aiRef`] = value === "是" ? true : false;
            } else if (header && header.includes("-是否抹除")) {
              const baseName = header.replace("-是否抹除", "");
              rowData[`${baseName}_eraseRef`] = value === "是" ? true : false;
            } else if (header === "第一优先级提示词") {
              // 解析备注列
              rowData["remark"] = value;
            } else if (header) {
              // 解析列名，提取字段信息
              // 格式：标签名 (配置名) 或 配置名
              const match = header.match(/(.*)\((.*)\)/);
              if (match) {
                const label = match[1].trim();
                const configName = match[2].trim();

                // 找到对应的配置项
                const configItem = imageConfig.find(
                  item => item.name === configName
                );
                if (configItem) {
                  if (configItem.type === "image") {
                    // 图片类型：存储图片路径/URL
                    rowData[`${configItem.id}_image`] = value;
                  } else if (configItem.content) {
                    // 文本/组合类型：查找对应的字段
                    const field = configItem.content.find(
                      f => f.label === label
                    );
                    if (field) {
                      rowData[`${configItem.id}_${label}`] = value;
                    }
                  }
                }
              } else {
                // 没有括号的列名（可能是图片名称）
                const configItem = imageConfig.find(
                  item => item.name === header
                );
                if (configItem && configItem.type === "image") {
                  rowData[`${configItem.id}_image`] = value;
                }
              }
            }
          });

          // 只有当该行有数据时才添加
          if (hasData) {
            importedData.push(rowData);
          }
        });

        if (importedData.length === 0) {
          throw new Error("Excel 中没有有效数据");
        }

        resolve(importedData);
      } catch (error) {
        console.error("导入 Excel 失败:", error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("文件读取失败"));
    };

    reader.readAsArrayBuffer(file);
  });
};
