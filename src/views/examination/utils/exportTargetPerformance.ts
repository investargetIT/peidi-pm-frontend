import { getPmKpiMonthMetricTargetPage } from "@/api/evaluation";
import {
  findTargetReferenceRule,
  isKeywordMatched,
  normalizeMetricName
} from "@/views/examination/utils/metricReference";
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
const TEMPLATE_FILE_NAME = "2026年季度GMV目标模板_202611051627.xlsx";

/**
 * 领导确认的签字版目标文件（放在 public/Examination/ 目录下）
 * 打包时会原样放入 ZIP，不做任何修改
 */
const SIGNED_FILE_NAME = "2026年Q4季度GMV目标（签字版).xlsx";

/**
 * 需要拉取的月份（Q4: 10月、11月、12月）
 * 对应模板中的列：E列=10月, F列=11月, G列=12月
 */
const MONTH_CONFIG = [
  { month: 10, column: 5 }, // E列 = 10月
  { month: 11, column: 6 }, // F列 = 11月
  { month: 12, column: 7 } // G列 = 12月
];

/**
 * 数据年份
 */
const DATA_YEAR = 2026;

/**
 * 导出范围说明（供页面提示文案使用，避免文案与配置不一致）
 */
export const EXPORT_SCOPE_LABEL = `${DATA_YEAR} 年 Q4（10月、11月、12月）`;

export const SIGNED_FILE_LABEL = SIGNED_FILE_NAME;

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
    if (!name || name === "小计：" || name === "小计:" || name === "姓名")
      return;
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
const fetchAllMonthData = async (): Promise<
  Map<string, Record<string, MonthData>>
> => {
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

        console.log(
          `  ✅ ${DATA_YEAR}年${month}月: 获取 ${res.data.records.length} 条记录，${recordCount} 个指标`
        );
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

//#region 联动指标解析

type MonthDataMap = Record<string, MonthData>;
type ReferenceSourceLookup = Map<
  string,
  Array<{ targetName: string; monthData: MonthDataMap }>
>;

/**
 * 建立「来源用户 → 指标列表」索引，供联动规则按关键词查找
 */
const buildReferenceSourceLookup = (
  dataMap: Map<string, MonthDataMap>
): ReferenceSourceLookup => {
  const lookup: ReferenceSourceLookup = new Map();

  dataMap.forEach((monthData, key) => {
    const separatorIndex = key.indexOf("||");
    if (separatorIndex < 0) return;

    const username = key.slice(0, separatorIndex);
    const targetName = key.slice(separatorIndex + 2);
    const list = lookup.get(username) || [];
    list.push({ targetName, monthData });
    lookup.set(username, list);
  });

  return lookup;
};

/**
 * 解析模板行实际应使用的数据：
 * - 未命中联动规则：用该用户自身数据；
 * - 命中联动规则：用来源用户的数据（读时派生，不写回）；
 * - 来源缺失：回退自身数据并告警。
 */
const resolveReferenceMonthData = (
  name: string,
  dbTargetName: string,
  ownData: MonthDataMap | undefined,
  lookup: ReferenceSourceLookup
): MonthDataMap | undefined => {
  const rule = findTargetReferenceRule(name, dbTargetName);
  if (!rule) return ownData;

  const candidates = lookup.get(rule.sourceUserName) || [];
  const matched = candidates.filter(candidate =>
    isKeywordMatched(
      candidate.targetName,
      rule.sourceMetricKeywords,
      rule.sourceExcludeKeywords
    )
  );
  const source =
    matched.find(
      candidate =>
        normalizeMetricName(candidate.targetName) ===
        normalizeMetricName(rule.sourceMetricLabel)
    ) || matched[0];

  if (!source) {
    console.warn(
      `[目标绩效导出] 未找到 ${rule.sourceUserName} 的「${rule.sourceMetricLabel}」，` +
        `${name} 的「${dbTargetName}」将使用自身数据`
    );
    return ownData;
  }

  console.log(
    `[目标绩效导出] ${name} 的「${dbTargetName}」联动 ${rule.sourceUserName} 的「${source.targetName}」`
  );
  return source.monthData;
};

//#endregion

//#region 导出主函数

/**
 * 读取 public/Examination/ 下的静态文件
 */
const fetchStaticFile = async (fileName: string): Promise<ArrayBuffer> => {
  const filePath = `/Examination/${fileName}`;
  console.log(`📄 读取文件: ${filePath}`);

  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`无法访问文件：${fileName}（HTTP ${response.status}）`);
  }
  return response.arrayBuffer();
};

/**
 * 导出目标绩效结果表
 *
 * 流程：
 * 1. 读取 public/Examination/ 下的模板文件
 * 2. 解析模板中每个人的姓名（C列）和数据库指标名称（I列）
 * 3. 调用 /pm/kpi-month-metric-target/page 接口拉取 Q4（10-12月）数据
 * 4. 按 (username + targetName) 匹配，将 target 填入对应月份列
 * 5. 与领导确认的签字版目标文件一起打包成 ZIP 导出
 */
export const exportTargetPerformance = async () => {
  try {
    // 1. 读取模板
    const arrayBuffer = await fetchStaticFile(TEMPLATE_FILE_NAME);
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

    // 联动指标的来源索引（如：俞梦秋/季节/蒙炳如 的指标数据跟随黄向前）
    const referenceLookup = buildReferenceSourceLookup(dataMap);

    // 4. 匹配并填充数据
    let filledCount = 0;
    const unmatchedRows: string[] = [];
    const matchedRows: string[] = [];

    for (const row of templateRows) {
      const key = `${row.name}||${row.dbTargetName}`;
      // 命中联动规则时取来源用户的数据，否则取自身数据
      const monthData = resolveReferenceMonthData(
        row.name,
        row.dbTargetName,
        dataMap.get(key),
        referenceLookup
      );

      if (!monthData) {
        unmatchedRows.push(
          `${row.name} - ${row.dbTargetName} (行${row.rowNumber})`
        );
        console.warn(`  ⚠️ 未匹配: ${row.name} - ${row.dbTargetName}`);
        continue;
      }

      // 填充 10月、11月、12月 的 target 值
      for (const { month, column } of MONTH_CONFIG) {
        const data = monthData[month.toString()];
        if (data) {
          worksheet.getRow(row.rowNumber).getCell(column).value = data.target;
        }
      }

      matchedRows.push(
        `${row.name} - ${row.dbTargetName} (行${row.rowNumber})`
      );
      filledCount++;
    }

    console.log(`✅ 成功填充 ${filledCount} 行`);
    if (matchedRows.length > 0) {
      console.log("已匹配的行:", matchedRows);
    }
    if (unmatchedRows.length > 0) {
      console.warn(
        `⚠️ 未匹配到数据的行 (${unmatchedRows.length}):`,
        unmatchedRows
      );
    }

    // 5. 生成系统口径 Excel
    // exceljs 有 bug：load → writeBuffer 会破坏部分 XML，此处用 JSZip 后处理修回去
    let buffer = await workbook.xlsx.writeBuffer();

    try {
      const zip = await JSZip.loadAsync(buffer);
      let patched = false;

      // 5.1 修复被 exceljs 吞掉转义符的数字格式（如 \. 变成 .）
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
          patched = true;
          console.log('🔧 已修复数字格式编码（0\\.0,"万"）');
        }
      }

      // 5.2 删除空的 conditionalFormatting 标签
      // 模板的隐藏工作表里存在「重复值」条件格式，exceljs 读取后会丢失 cfRule，
      // 写出 <conditionalFormatting sqref="..."/>（无子节点），不符合 OOXML 规范，
      // Excel 打开时会提示“有 XML 错误的 /xl/worksheets/sheetN.xml”并修复。
      for (const name of Object.keys(zip.files)) {
        if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;

        const sheetXml = await zip.file(name)?.async("string");
        if (!sheetXml) continue;

        const fixedXml = sheetXml
          .replace(/\s*<conditionalFormatting\b[^>]*\/>/g, "")
          .replace(
            /\s*<conditionalFormatting\b[^>]*>\s*<\/conditionalFormatting>/g,
            ""
          );
        if (fixedXml !== sheetXml) {
          zip.file(name, fixedXml);
          patched = true;
          console.log(`🔧 已清理 ${name} 中的空 conditionalFormatting 标签`);
        }
      }

      if (patched) {
        buffer = await zip.generateAsync({ type: "arraybuffer" });
      }
    } catch (patchError) {
      // 修补失败不阻止下载，只用 console 警告
      console.warn("⚠️ XML 修补失败，导出的 Excel 可能提示修复:", patchError);
    }

    // 6. 打包下载：系统口径表 + 领导确认的签字版文件（原样放入，不做修改）
    const now = dayjs().format("YYYYMMDDHHmmss");
    const systemFileName = `目标绩效结果表_${now}.xlsx`;

    const packageZip = new JSZip();
    packageZip.file(systemFileName, buffer);

    let signedFileIncluded = false;
    let signedFileError = "";
    try {
      const signedBuffer = await fetchStaticFile(SIGNED_FILE_NAME);
      packageZip.file(SIGNED_FILE_NAME, signedBuffer);
      signedFileIncluded = true;
      console.log(`📎 已加入签字版文件: ${SIGNED_FILE_NAME}`);
    } catch (error) {
      // 签字版读取失败不阻断系统口径表的导出
      signedFileError = error instanceof Error ? error.message : "未知错误";
      console.warn("⚠️ 签字版文件读取失败，ZIP 中仅包含系统口径表:", error);
    }

    const zipBuffer = await packageZip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const zipFileName = `目标绩效结果表_Q4_${now}.zip`;
    saveAs(new Blob([zipBuffer], { type: "application/zip" }), zipFileName);

    console.log(`🎉 导出成功: ${zipFileName}`);

    return {
      success: true,
      filledCount,
      unmatchedCount: unmatchedRows.length,
      unmatchedRows,
      signedFileIncluded,
      signedFileError,
      zipFileName,
      systemFileName
    };
  } catch (error) {
    console.error("❌ 导出目标绩效结果表失败:", error);
    throw new Error(
      `导出失败：${error instanceof Error ? error.message : "未知错误"}`
    );
  }
};

//#endregion
