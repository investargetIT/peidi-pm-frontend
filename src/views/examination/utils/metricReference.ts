/**
 * 指标联动规则（读时派生）
 *
 * 设计原则：
 * - 只保留一份「权威数据」（来源用户），目标用户的数据在展示 / 导出时「引用」来源用户；
 * - 不做写回、不做写时传播，避免出现两份数据互相打架，也不存在「改了谁」的问题；
 * - 页面表格与人事导出共用本文件的规则，保证两边口径一致。
 *
 * 匹配方式：按指标名称关键词（同时包含全部关键词才命中），并按姓名匹配用户。
 * 后续如需演进，建议把关键词匹配改为 metricId / metricConfigId 等稳定 ID。
 */
/** 汇总项：某个用户的某个指标，参与求和的一个加数 */
export interface MetricAggregateSource {
  /** 来源用户 */
  userName: string;
  /** 来源指标名称需同时包含的关键词（归一化后匹配） */
  metricKeywords: string[];
  /** 来源指标名称包含这些关键词时不匹配，避免误命中 */
  metricExcludeKeywords?: string[];
  /** 来源指标名称（日志展示，并用于精确匹配优先） */
  metricLabel?: string;
  /** 取该指标的哪个字段参与求和 */
  field: "target" | "achieved";
}

/** 汇总规则：目标用户的某个指标值 = 若干来源指标值之和（读时派生，不写回） */
export interface MetricAggregateRule {
  /** 规则唯一标识，便于日志排查 */
  id: string;
  /** 目标用户（汇总结果写入该用户） */
  targetUserName: string;
  /** 目标指标名称需同时包含的关键词（归一化后匹配） */
  targetMetricKeywords: string[];
  /** 目标指标名称包含这些关键词时不匹配，避免误命中 */
  targetMetricExcludeKeywords?: string[];
  /** 目标指标名称（日志展示，并用于精确匹配优先） */
  targetMetricLabel: string;
  /** 汇总结果写入目标指标的哪个字段 */
  targetField: "target" | "achieved";
  /** 参与求和的加数 */
  sources: MetricAggregateSource[];
}

export const METRIC_AGGREGATE_RULES: MetricAggregateRule[] = [
  // ⚠️ 王琳「渠道累计收入（目标值）」的自动汇总规则已停用：
  // 该指标依赖的其他指标中存在写死/历史调整过的数据，直接按当前值求和会被旧数据污染，
  // 因此仍保持「人工计算后填入」。如后续确认口径干净，可按以下结构恢复：
  // {
  //   id: "wanglin-channel-cumulative-income-target",
  //   targetUserName: "王琳",
  //   targetMetricKeywords: ["渠道累计收入"],
  //   targetMetricExcludeKeywords: ["达成率"],
  //   targetMetricLabel: "渠道累计收入",
  //   targetField: "target",
  //   sources: [
  //     { userName: "王小龙", metricKeywords: ["累计月销售", "GMV"], metricLabel: "累计月销售(GMV)达成", field: "achieved" },
  //     { userName: "张震西", metricKeywords: ["累计月销售", "GMV"], metricLabel: "累计月销售(GMV)达成", field: "achieved" },
  //     { userName: "周环寰", metricKeywords: ["累计月销售", "GMV"], metricLabel: "累计月销售(GMV)达成", field: "achieved" },
  //     { userName: "范振吉", metricKeywords: ["累计月销售", "GMV"], metricLabel: "累计月销售(GMV)达成", field: "achieved" },
  //     { userName: "付阳", metricKeywords: ["累计月销售", "GMV"], metricLabel: "累计月销售(GMV)达成", field: "achieved" },
  //     { userName: "梁钰", metricKeywords: ["渠道全年累计销售收入GMV"], metricLabel: "渠道全年累计销售收入GMV", field: "achieved" }
  //   ]
  // }
];

/**
 * 一致性校验分组（只做展示标记，不参与计算、不写回）
 * 场景：某条指标由多个人各自维护，但业务要求他们的数值必须完全一致。
 * 例：黄向前 / 梁钰 / 方林霞 的「渠道全年累计销售收入GMV」。
 */
export interface MetricConsistencyGroup {
  /** 分组唯一标识 */
  id: string;
  /** 参与该分组的指标名称需同时包含的关键词 */
  metricKeywords: string[];
  /** 指标名称包含这些关键词时不参与 */
  metricExcludeKeywords?: string[];
  /** 指标名称（用于精确定位） */
  label: string;
  /** 要求数值一致的成员用户 */
  userNames: string[];
  /** 口径公式（逐行），用于 Tooltip 展示 */
  formulaLines: string[];
}

export const METRIC_CONSISTENCY_GROUPS: MetricConsistencyGroup[] = [
  {
    id: "channel-full-year-cumulative-sales-gmv",
    metricKeywords: ["渠道全年累计销售收入GMV"],
    label: "渠道全年累计销售收入GMV",
    userNames: ["黄向前", "梁钰", "方林霞"],
    formulaLines: [
      "梁钰「达播销售收入月度目标达成率」",
      "黄向前「商品卡+短视频（自营）销售收入月度目标达成率」",
      "方林霞「自播间销售收入月度目标达成率」"
    ]
  }
];

/** 查找某个用户的某个指标是否命中一致性校验分组 */
export const findConsistencyGroup = (
  userName?: string | null,
  metricName?: string | null
) =>
  METRIC_CONSISTENCY_GROUPS.find(
    group =>
      group.userNames.includes(String(userName ?? "").trim()) &&
      isKeywordMatched(
        metricName,
        group.metricKeywords,
        group.metricExcludeKeywords
      )
  );

export interface MetricReferenceRule {
  /** 规则唯一标识，便于日志排查 */
  id: string;
  /** 来源用户（权威数据所在人） */
  sourceUserName: string;
  /** 来源指标名称需同时包含的关键词（归一化后匹配） */
  sourceMetricKeywords: string[];
  /** 来源指标名称包含这些关键词时不匹配，避免误命中 */
  sourceExcludeKeywords?: string[];
  /** 复用来源数据的目标用户 */
  targetUserNames: string[];
  /** 目标指标名称需同时包含的关键词（归一化后匹配） */
  targetMetricKeywords: string[];
  /** 来源指标名称（日志展示，并用于来源指标的精确匹配优先） */
  sourceMetricLabel: string;
  /** 目标指标名称（日志展示，默认同来源） */
  targetMetricLabel?: string;
  /** 规则生效起始月份（YYYY-MM），早于该月份不做联动；不填表示一直生效 */
  effectiveFromMonth?: string;
}

export const METRIC_REFERENCE_RULES: MetricReferenceRule[] = [
  {
    id: "huang-xiangqian-to-yumengqiu-jijie-mengbingru-commodity-card",
    sourceUserName: "黄向前",
    sourceMetricKeywords: ["商品卡", "短视频", "自营", "销售收入"],
    targetUserNames: ["俞梦秋", "季节", "蒙炳如"],
    targetMetricKeywords: ["商品卡", "短视频", "自营", "销售收入"],
    sourceMetricLabel: "商品卡+短视频（自营）销售收入月度目标达成率"
  },
  {
    id: "wanglin-to-wangxiangni-channel-income",
    sourceUserName: "王琳",
    sourceMetricKeywords: ["渠道累计收入"],
    sourceExcludeKeywords: ["达成率"], // 只复用金额口径的「渠道累计收入」
    targetUserNames: ["王湘妮"],
    targetMetricKeywords: ["前台全渠道业绩目标达成率"],
    sourceMetricLabel: "渠道累计收入",
    targetMetricLabel: "前台全渠道业绩目标达成率"
  },
  {
    id: "huang-xiangqian-to-yumengqiu-jijie-roi",
    sourceUserName: "黄向前",
    sourceMetricKeywords: ["自营全域净成交ROI", "不含达播"],
    targetUserNames: ["俞梦秋", "季节"],
    targetMetricKeywords: ["自营全域净成交ROI", "不含达播"],
    sourceMetricLabel: "自营全域净成交ROI（不含达播）"
  }
];

/** 去除空白字符并统一全角加号，避免指标名称中的空格/符号差异导致匹配失败 */
export const normalizeMetricName = (name?: string | null) =>
  String(name ?? "")
    .replace(/\s/g, "")
    .replace(/＋/g, "+");

/** 指标名称是否同时包含全部关键词（支持排除关键词） */
export const isKeywordMatched = (
  metricName: string | undefined | null,
  keywords: string[],
  excludeKeywords?: string[]
) => {
  const normalized = normalizeMetricName(metricName);

  if (
    excludeKeywords?.some(keyword =>
      normalized.includes(normalizeMetricName(keyword))
    )
  ) {
    return false;
  }

  return keywords.every(keyword =>
    normalized.includes(normalizeMetricName(keyword))
  );
};

/** 规则在指定月份（YYYY-MM 或 YYYY-MM-DD）是否生效 */
export const isReferenceRuleEffective = (
  rule: MetricReferenceRule,
  month?: string | null
) => {
  if (!rule.effectiveFromMonth) return true;
  if (!month) return true;
  return String(month).slice(0, 7) >= rule.effectiveFromMonth;
};

/** 查找某个用户的某个指标是否命中「目标端」联动规则 */
export const findTargetReferenceRule = (
  userName?: string | null,
  metricName?: string | null,
  month?: string | null
) =>
  METRIC_REFERENCE_RULES.find(
    rule =>
      rule.targetUserNames.includes(String(userName ?? "").trim()) &&
      isKeywordMatched(metricName, rule.targetMetricKeywords) &&
      isReferenceRuleEffective(rule, month)
  );

/** 在指标列表里按关键词查找指标（优先名称完全一致的） */
export const findMetricInList = <T extends { targetName?: string }>(
  metrics: T[],
  keywords: string[],
  excludeKeywords?: string[],
  label?: string
): T | undefined => {
  const matched = metrics.filter(metric =>
    isKeywordMatched(metric.targetName, keywords, excludeKeywords)
  );

  if (label) {
    const exact = matched.find(
      metric =>
        normalizeMetricName(metric.targetName) === normalizeMetricName(label)
    );
    if (exact) return exact;
  }

  return matched[0];
};

/** 在来源用户的指标列表里查找规则对应的来源指标（优先名称完全一致的） */
export const findSourceMetricForRule = <T extends { targetName?: string }>(
  metrics: T[],
  rule: MetricReferenceRule
): T | undefined =>
  findMetricInList(
    metrics,
    rule.sourceMetricKeywords,
    rule.sourceExcludeKeywords,
    rule.sourceMetricLabel
  );

/** 查找某个用户的某个指标是否命中「自动汇总」规则 */
export const findAggregateRule = (
  userName?: string | null,
  metricName?: string | null
) =>
  METRIC_AGGREGATE_RULES.find(
    rule =>
      rule.targetUserName === String(userName ?? "").trim() &&
      isKeywordMatched(
        metricName,
        rule.targetMetricKeywords,
        rule.targetMetricExcludeKeywords
      )
  );

/** 汇总规则的可读公式，用于页面提示与日志 */
export const getAggregateFormulaText = (rule: MetricAggregateRule) => {
  const fieldText = (field: "target" | "achieved") =>
    field === "target" ? "目标值" : "完成值";
  const sourceText = rule.sources
    .map(
      source =>
        `${source.userName}「${source.metricLabel ?? source.metricKeywords.join("")}」${fieldText(source.field)}`
    )
    .join(" ＋ ");
  return `${sourceText}`;
};
