import { getPmKpiMonthMetricTargetPage } from "@/api/evaluation";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import JSZip from "jszip";

const ALL_PAGE_SIZE = 99999;

//#region 类型定义

interface TemplateRow {
  department: string;
  position: string;
  name: string;
  indicator: string;
  dbTargetName: string;
  rowNumber: number;
}

interface MonthData {
  target: number;
  achieved: number;
}

//#endregion

//#region 模板配置

/**
 * 模板文件名（放在 public/Examination/ 目录下）
 */
const TEMPLATE_FILE_NAME = "2026年季度GMV目标模板_202607241622.xlsx";

/**
 * 需要拉取的月份（Q3: 7月、8月、9月）
 * 对应模板中的列：E列=7月, F列=8月, G列=9月
 */
const MONTH_CONFIG = [
  { month: 7, column: 5 }, // E列 = 7月
  { month: 8, column: 6 }, // F列 = 8月
  { month: 9, column: 7 }  // G列 = 9月
];

/**
 * 数据年份
 */
const DATA_YEAR = 2026;

//#endregion

//#region 模板解析

/**
 * 解析模板中的行，提取需要匹配的数据
 * - C列：姓名
 * - I列：数据库对应指标名称（用于匹配 API 的 targetName）
 */
const parseTemplateRows = (worksheet: ExcelJS.Worksheet): TemplateRow[] => {
  const rows: TemplateRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    // 跳过标题行（第1行）和表头行（第2行）
    if (rowNumber <= 2) return;

    const name = row.getCell(3).value?.toString()?.trim() || "";
    const dbTargetName = row.getCell(9).value?.toString()?.trim() || "";

    // 跳过空行、小计行、表头分隔行
    if (!name || name === "小计：" || name === "小计:" || name === "姓名") return;
    // 跳过没有数据库指标名称的行
    if (!dbTargetName) return;

    rows.push({
      department: row.getCell(1).value?.toString()?.trim() || "",
      position: row.getCell(2).value?.toString()?.trim() || "",
      name,
      indicator: row.getCell(4).value?.toString()?.trim() || "",
      dbTargetName,
      rowNumber
    });
  });

  return rows;
};

//#endregion

//#region API 数据获取

/**
 * 调用 API 获取指定月份的所有指标数据
 * 构建 (username + targetName) → { month: { target, achieved } } 的映射表
 */
const fetchAllMonthData = async (): Promise<Map<string, Record<string, MonthData>>> => {
  const dataMap = new Map<string, Record<string, MonthData>>();

  for (const { month } of MONTH_CONFIG) {
    const monthDate = dayjs(`${DATA_YEAR}-${month}-01`).format("YYYY-MM-DD");

    console.log(`📡 正在获取 ${DATA_YEAR}年${month}月 数据...`);

    try {
      const res: any = await getPmKpiMonthMetricTargetPage({
        startDate: monthDate,
        endDate: monthDate,
        pageNo: 1,
        pageSize: ALL_PAGE_SIZE
      });

      if (res?.success && res?.data?.records) {
        let recordCount = 0;

        for (const record of res.data.records) {
          const username = (record.username || "").trim();
          if (!username) continue;

          const metricList = record.metricTargetList || [];

          for (const metric of metricList) {
            if (metric.status === 0) continue;

            const targetName = (metric.targetName || "").trim();
            if (!targetName) continue;

            const key = `${username}||${targetName}`;

            if (!dataMap.has(key)) {
              dataMap.set(key, {});
            }

            const monthDataMap = dataMap.get(key)!;
            monthDataMap[month.toString()] = {
              target: Number(metric.target ?? 0),
              achieved: Number(metric.achieved ?? 0)
            };

            recordCount++;
          }
        }

        console.log(`  ✅ ${DATA_YEAR}年${month}月: 获取 ${res.data.records.length} 条记录，${recordCount} 个指标`);
      } else {
        console.warn(`  ⚠️ ${DATA_YEAR}年${month}月: 无数据或接口返回异常`);
      }
    } catch (error) {
      console.error(`  ❌ ${DATA_YEAR}年${month}月 数据获取失败:`, error);
    }
  }

  return dataMap;
};

//#endregion

//#region 导出主函数

/**
 * 导出目标绩效结果表
 *
 * 流程：
 * 1. 读取 public/Examination/ 下的模板文件
 * 2. 解析模板中每个人的姓名（C列）和数据库指标名称（I列）
 * 3. 调用 /pm/kpi-month-metric-target/page 接口拉取 Q3（7-9月）数据
 * 4. 按 (username + targetName) 匹配，将 target 填入对应月份列
 * 5. 导出为新 Excel 文件
 */
export const exportTargetPerformance = async () => {
  try {
    // 1. 读取模板
    const filePath = `/Examination/${TEMPLATE_FILE_NAME}`;
    console.log(`📄 读取模板文件: ${filePath}`);

    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`无法访问模板文件：${TEMPLATE_FILE_NAME}（HTTP ${response.status}）`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error("模板中不存在工作表");
    }

    // 2. 解析模板行
    const templateRows = parseTemplateRows(worksheet);
    console.log(`📋 解析到 ${templateRows.length} 条需要填充的数据行`);
    console.log(
      "数据行明细:",
      templateRows.map(r => `${r.name} → ${r.dbTargetName}`)
    );

    if (templateRows.length === 0) {
      throw new Error("模板中未解析到有效数据行，请检查模板格式");
    }

    // 3. 获取 API 数据
    const dataMap = await fetchAllMonthData();
    console.log(`📊 API 数据共 ${dataMap.size} 个匹配键`);

    // 4. 匹配并填充数据
    let filledCount = 0;
    const unmatchedRows: string[] = [];
    const matchedRows: string[] = [];

    for (const row of templateRows) {
      const key = `${row.name}||${row.dbTargetName}`;
      const monthData = dataMap.get(key);

      if (!monthData) {
        unmatchedRows.push(`${row.name} - ${row.dbTargetName} (行${row.rowNumber})`);
        console.warn(`  ⚠️ 未匹配: ${row.name} - ${row.dbTargetName}`);
        continue;
      }

      // 填充 7月、8月、9月 的 target 值
      for (const { month, column } of MONTH_CONFIG) {
        const data = monthData[month.toString()];
        if (data) {
          worksheet.getRow(row.rowNumber).getCell(column).value = data.target;
        }
      }

      matchedRows.push(`${row.name} - ${row.dbTargetName} (行${row.rowNumber})`);
      filledCount++;
    }

    console.log(`✅ 成功填充 ${filledCount} 行`);
    if (matchedRows.length > 0) {
      console.log("已匹配的行:", matchedRows);
    }
    if (unmatchedRows.length > 0) {
      console.warn(`⚠️ 未匹配到数据的行 (${unmatchedRows.length}):`, unmatchedRows);
    }

    // 5. 生成并下载
    // exceljs 有 bug：load → writeBuffer 会吞掉 numFmt 里的转义符（如 \. 变成 .）
    // 此处用 JSZip 后处理 styles.xml，把被破坏的格式修回去
    let buffer = await workbook.xlsx.writeBuffer();

    // 用 JSZip 修补被 exceljs 破坏的数字格式
    try {
      const zip = await JSZip.loadAsync(buffer);
      const stylesXml = await zip.file("xl/styles.xml")?.async("string");
      if (stylesXml) {
        // 原始模板 numFmt 是 0\.0,"万"（反斜杠转义小数点，配合千分逗号缩放）
        // exceljs 序列化时会丢失 \，变成 0.0,"万"，导致 >=1000 的数字显示错误
        // 这里用 fromCharCode(92) 构造反斜杠来规避 JS 字符串转义歧义
        const BS = String.fromCharCode(92);
        const fixedXml = stylesXml.replace(
          /0\.0,&quot;万&quot;/g,
          "0" + BS + ".0,&quot;万&quot;"
        );
        if (fixedXml !== stylesXml) {
          zip.file("xl/styles.xml", fixedXml);
          buffer = await zip.generateAsync({ type: "arraybuffer" });
          console.log("🔧 已修复数字格式编码（0\\.0,\"万\"）");
        }
      }
    } catch (patchError) {
      // 修补失败不阻止下载，只用 console 警告
      console.warn("⚠️ 数字格式修补失败，显示可能异常:", patchError);
    }

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const now = dayjs().format("YYYYMMDDHHmmss");
    const outputFileName = `目标绩效结果表_${now}.xlsx`;
    saveAs(blob, outputFileName);

    console.log(`🎉 导出成功: ${outputFileName}`);

    return {
      success: true,
      filledCount,
      unmatchedCount: unmatchedRows.length,
      unmatchedRows
    };
  } catch (error) {
    console.error("❌ 导出目标绩效结果表失败:", error);
    throw new Error(
      `导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};

//#endregion
