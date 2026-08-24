<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Search,
  Refresh,
  DataLine,
  ArrowDown,
  ArrowLeft,
  OfficeBuilding,
  User
} from "@element-plus/icons-vue";
import dayjs from "dayjs";

import NavBar from "./navBar.vue";
import {
  getDailySummary,
  getDeptTree,
  TimeResultEnum,
  type AttendanceDailySummaryDTO,
  type DeptNode
} from "@/api/attendance";

// 引入全局样式（覆盖主应用样式）
import "../aiDrawingPro/style/reset.scss";

const route = useRoute();
const router = useRouter();

// 姓名筛选（前端过滤，多选，直接生效）
const filterKeywords = ref<string[]>([]);

// 姓名下拉选项：跟随当前下钻部门（含子部门），顶层显示全员
const usernameOptions = computed(() => {
  const set = new Set<string>();
  allDailyData.value.forEach(item => {
    if (!item.username) return;
    // 下钻时只展示当前部门（含子部门）内的人，缩短查找范围
    if (currentDeptId.value) {
      const chain = item.deptId
        ? pathMap.value.get(String(item.deptId)) || []
        : [];
      const hit = chain.some(
        d => String(d.deptId) === String(currentDeptId.value)
      );
      if (!hit) return;
    }
    set.add(item.username);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
});

// 部门树数据
const deptTreeData = ref<DeptNode[]>([]);

// 部门ID -> 部门节点 映射表（O(1) 查找，性能优化）
// 统一用 string 类型 key，避免 number/string 类型不匹配导致查不到
const deptIdMap = computed<Map<string, DeptNode>>(() => {
  const map = new Map<string, DeptNode>();
  const traverse = (nodes: DeptNode[]) => {
    nodes.forEach(node => {
      if (node.deptId !== undefined && node.deptId !== null) {
        map.set(String(node.deptId), node);
      }
      if (node.children?.length) {
        traverse(node.children);
      }
    });
  };
  traverse(deptTreeData.value);
  return map;
});

// 每个部门 -> 从顶级到自身的完整链路 [top, ..., node]（用于下钻/面包屑/归属）
const pathMap = computed<Map<string, DeptNode[]>>(() => {
  const map = new Map<string, DeptNode[]>();
  const walk = (nodes: DeptNode[], prefix: DeptNode[]) => {
    nodes.forEach(node => {
      const chain = [...prefix, node];
      if (node.deptId !== undefined && node.deptId !== null) {
        map.set(String(node.deptId), chain);
      }
      if (node.children?.length) walk(node.children, chain);
    });
  };
  walk(deptTreeData.value, []);
  return map;
});

// 当前下钻到的部门ID（null 表示顶层，展示一级部门）
const currentDeptId = ref<string | number | null>(null);

// 是否处于"筛选结果"扁平视图（多选跨部门人员时展示）
const showFilterResult = ref(false);

// 当前下钻路径（用于面包屑）
const currentPath = computed<DeptNode[]>(() => {
  if (!currentDeptId.value) return [];
  return pathMap.value.get(String(currentDeptId.value)) || [];
});

// 返回上级
const handleBack = () => {
  // 先退出"筛选结果"视图
  if (showFilterResult.value) {
    showFilterResult.value = false;
    currentDeptId.value = null;
    return;
  }
  if (!currentDeptId.value) {
    ElMessage.info("已在顶层");
    return;
  }
  const path = currentPath.value;
  if (path.length <= 1) {
    currentDeptId.value = null;
  } else {
    currentDeptId.value = path[path.length - 2].deptId ?? null;
  }
};

// 面包屑跳转（-1 表示回到顶层）
const handleBreadcrumbClick = (idx: number) => {
  showFilterResult.value = false;
  if (idx === -1) {
    currentDeptId.value = null;
    return;
  }
  const node = currentPath.value[idx];
  currentDeptId.value = node.deptId ?? null;
};

// 加载部门树
const fetchDeptTree = async () => {
  try {
    const res: any = await getDeptTree();
    if (res?.success) {
      deptTreeData.value = res.data || res.list || [];
    }
  } catch (error: any) {
    console.error("加载部门树失败:", error.message);
  }
};

// 获取当前年月，默认起始月份和结束月份均为当月
const getDefaultMonthRange = (): [string, string] => {
  const now = dayjs().format("YYYY-MM");
  return [now, now];
};

// 根据 yyyy-MM 计算该月第一天和最后一天
const getMonthRange = (monthStr: string): [string, string] => {
  return [
    dayjs(monthStr).startOf("month").format("YYYY-MM-DD"),
    dayjs(monthStr).endOf("month").format("YYYY-MM-DD")
  ];
};

// 生成两个月份之间的所有月份列表（用于动态列）
const generateMonthList = (start: string, end: string): string[] => {
  const months: string[] = [];
  let current = dayjs(start).startOf("month");
  const last = dayjs(end).startOf("month");
  while (current.isBefore(last) || current.isSame(last, "month")) {
    months.push(current.format("YYYY-MM"));
    current = current.add(1, "month");
  }
  return months;
};

// 筛选条件（表单绑定值，变动后不立即生效）
const monthRange = ref<[string, string]>(getDefaultMonthRange());
// 实际生效的月份范围（点击查询后才更新）
const activeMonthRange = ref<[string, string]>(getDefaultMonthRange());

// 动态月份列
const monthColumns = computed(() => {
  return generateMonthList(activeMonthRange.value[0], activeMonthRange.value[1]);
});

// 展示模式：total=总工时，avg=平均工时
const displayMode = ref<"total" | "avg">("avg");
// 数据说明展开状态
const descExpanded = ref(false);

// 原始日数据
const allDailyData = ref<AttendanceDailySummaryDTO[]>([]);
const loading = ref(false);

// 按人员+月份聚合的数据（保存总工时和天数）
interface PersonData {
  username: string;
  dingUserId: string;
  deptId?: string;
  chain: DeptNode[]; // 从顶级到所在部门的完整链路
  totalHours: Record<string, number>; // 每月总工时
  dayCount: Record<string, number>; // 每月打卡天数
}

// 全部人员聚合数据（不套用姓名筛选，用于部门汇总口径）
const allPersons = computed<PersonData[]>(() => {
  const map = new Map<string, PersonData>();
  allDailyData.value.forEach(item => {
    if (!item.username || !item.workDay) return;
    const key = item.username;
    if (!map.has(key)) {
      const chain = item.deptId
        ? pathMap.value.get(String(item.deptId)) || []
        : [];
      const row: PersonData = {
        username: item.username,
        dingUserId: item.dingUserId || "",
        deptId: item.deptId,
        chain,
        totalHours: {},
        dayCount: {}
      };
      monthColumns.value.forEach(m => {
        row.totalHours[m] = 0;
        row.dayCount[m] = 0;
      });
      map.set(key, row);
    }
    const p = map.get(key)!;
    const workMonth = item.workDay.substring(0, 7);
    if (p.totalHours[workMonth] !== undefined) {
      p.totalHours[workMonth] += calcEffectiveHours(item);
      p.dayCount[workMonth] += 1;
    }
  });
  return Array.from(map.values());
});

// 姓名筛选后的人员（仅用于最末级的人员列表展示）
const persons = computed<PersonData[]>(() => {
  const nameSet = new Set(filterKeywords.value);
  if (nameSet.size === 0) return allPersons.value;
  return allPersons.value.filter(p => nameSet.has(p.username));
});

// 获取某个部门（含其所有子部门）下的所有人员（部门汇总保持完整、不受姓名筛选影响）
const personsInDept = (deptId: string): PersonData[] => {
  return allPersons.value.filter(p =>
    p.chain.some(d => String(d.deptId) === String(deptId))
  );
};

// 筛选结果视图中处于"折叠"状态的分组（key 为一级部门名）
const expandedGroups = ref<Set<string>>(new Set());

// 展开/收起某个分组
const handleToggleGroup = (row: ViewRow) => {
  if (row.type !== "group" || !row.name) return;
  const key = row.name;
  const next = new Set(expandedGroups.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedGroups.value = next;
};

// 定位筛选人员：单人选进入其部门，多选进入"筛选结果"分组视图
const handleLocatePerson = () => {
  const list = persons.value;
  if (list.length === 0) {
    ElMessage.info("所选人员暂无考勤记录，无法定位");
    return;
  }
  if (list.length === 1) {
    // 单个人：定位到其所在的最末级部门
    const p = list[0];
    showFilterResult.value = false;
    if (p.chain.length) {
      currentDeptId.value = p.chain[p.chain.length - 1].deptId ?? null;
    }
    return;
  }
  // 多个人（可能跨部门）：进入"筛选结果"分组视图，默认全展开
  showFilterResult.value = true;
  currentDeptId.value = null;
  expandedGroups.value = new Set();
};

// 表格行类名
const tableRowClassName = ({ row }: { row: ViewRow }) => {
  if (row.type === "group") return "row-group-header";
  return "";
};

// 聚合一组人员的月度数据
const calcGroup = (plist: PersonData[], months: string[]) => {
  const total: Record<string, number> = {};
  const day: Record<string, number> = {};
  const avgByPerson: Record<string, number> = {};
  months.forEach(m => {
    total[m] = 0;
    day[m] = 0;
    avgByPerson[m] = 0;
  });
  plist.forEach(p => {
    months.forEach(m => {
      total[m] = (total[m] || 0) + (p.totalHours[m] || 0);
      day[m] = (day[m] || 0) + (p.dayCount[m] || 0);
      // 个人平均 = 总工时 / 出勤天数；0 天则记 0
      const days = p.dayCount[m] || 0;
      avgByPerson[m] =
        (avgByPerson[m] || 0) + (days > 0 ? (p.totalHours[m] || 0) / days : 0);
    });
  });
  return { totalHours: total, dayCount: day, avgByPerson, headcount: plist.length };
};

// 看板行：部门 / 人员 / 筛选结果分组头
interface ViewRow {
  type: "dept" | "person" | "group";
  key: string;
  name: string;
  deptId?: string | number;
  dingUserId?: string;
  hasChildren: boolean;
  headcount: number;
  totalHours: Record<string, number>;
  dayCount: Record<string, number>;
  // 每月"个人平均工时"的求和（供部门平均 = 该求和 ÷ 人数 使用）
  avgByPerson?: Record<string, number>;
  // 所属部门路径（筛选结果视图展示用）
  deptPath?: string;
  // 筛选结果分组行：该组对应的命中的人员
  groupPersons?: PersonData[];
}

// 根据当前下钻层级生成展示行
const viewRows = computed<ViewRow[]>(() => {
  const months = monthColumns.value;

  // "筛选结果"视图：按一级部门分组，可展开/折叠，展示命中的筛选人员
  if (showFilterResult.value) {
    const rows: ViewRow[] = [];
    const groups = new Map<string, PersonData[]>();
    persons.value.forEach(p => {
      const top = p.chain[0]?.deptName || "未分组";
      if (!groups.has(top)) groups.set(top, []);
      groups.get(top)!.push(p);
    });
    groups.forEach((plist, top) => {
      const agg = calcGroup(plist, months);
      const collapsed = expandedGroups.value.has(top);
      rows.push({
        type: "group",
        key: "g-" + top,
        name: top,
        hasChildren: true,
        headcount: plist.length,
        ...agg,
        groupPersons: plist
      });
      if (!collapsed) {
        plist.forEach(p =>
          rows.push({
            type: "person",
            key: p.username,
            name: p.username,
            dingUserId: p.dingUserId,
            deptId: p.deptId,
            hasChildren: false,
            headcount: 1,
            totalHours: p.totalHours,
            dayCount: p.dayCount,
            deptPath: p.chain.length
              ? p.chain.map(d => d.deptName).filter(Boolean).join(" / ")
              : "-"
          })
        );
      }
    });
    return rows;
  }

  // 顶层：展示一级部门，聚合其所有子部门/人员
  if (!currentDeptId.value) {
    return deptTreeData.value.map(top => {
      const agg = calcGroup(personsInDept(String(top.deptId)), months);
      return {
        type: "dept",
        key: String(top.deptId),
        name: top.deptName || "-",
        deptId: top.deptId,
        hasChildren: !!top.children?.length,
        ...agg
      };
    });
  }

  const node = deptIdMap.value.get(String(currentDeptId.value));
  if (!node) return [];

  // 有子部门：展示下一级子部门 + 当前部门的直属人员（可能存在一边挂子部门一边挂人员的混合部门）
  if (node.children?.length) {
    const deptRows: ViewRow[] = node.children.map(child => {
      const agg = calcGroup(personsInDept(String(child.deptId)), months);
      return {
        type: "dept",
        key: String(child.deptId),
        name: child.deptName || "-",
        deptId: child.deptId,
        hasChildren: !!child.children?.length,
        ...agg
      };
    });
    // 当前部门的直属人员（deptId 严格等于本部门，不属于任何子部门）
    const directPersons = persons.value.filter(
      p => String(p.deptId || "") === String(node.deptId)
    );
    const personRows: ViewRow[] = directPersons.map(p => ({
      type: "person",
      key: p.username,
      name: p.username,
      dingUserId: p.dingUserId,
      deptId: p.deptId,
      hasChildren: false,
      headcount: 1,
      totalHours: p.totalHours,
      dayCount: p.dayCount
    }));
    return [...deptRows, ...personRows];
  }

  // 最末级部门：展示具体人员
  return persons.value
    .filter(p => String(p.deptId || "") === String(node.deptId))
    .map(p => ({
      type: "person",
      key: p.username,
      name: p.username,
      dingUserId: p.dingUserId,
      deptId: p.deptId,
      hasChildren: false,
      headcount: 1,
      totalHours: p.totalHours,
      dayCount: p.dayCount
    }));
});

// 单元格显示值（按展示模式计算）
const cellValue = (row: ViewRow, m: string): number => {
  const total = row.totalHours[m] || 0;
  if (displayMode.value === "avg") {
    if (row.type === "dept" || row.type === "group") {
      // 部门/分组平均工时 = 组内每人"平均工时"求和 ÷ 人数
      const avgByPerson = row.avgByPerson?.[m] || 0;
      return row.headcount > 0 ? avgByPerson / row.headcount : 0;
    }
    // 个人平均工时 = 有效工时总和 ÷ 出勤天数
    const days = row.dayCount[m] || 0;
    return days > 0 ? total / days : 0;
  }
  return total;
};

// 进入下级部门
const handleEnterDept = (row: ViewRow) => {
  if (row.type !== "dept") return;
  showFilterResult.value = false;
  currentDeptId.value = row.deptId ?? null;
};

// 行点击：分组展开/收起，部门进入下级，人员查看详情
const handleRowClick = (row: ViewRow) => {
  if (row.type === "group") {
    handleToggleGroup(row);
    return;
  }
  if (row.type === "dept") {
    handleEnterDept(row);
    return;
  }
  handleViewDetail(row);
};

// 详情弹窗相关
const detailVisible = ref(false);
const detailUser = ref<{ username: string; deptName: string } | null>(null);
const detailActiveTab = ref("");

const detailMonthData = computed<AttendanceDailySummaryDTO[]>(() => {
  if (!detailUser.value || !detailActiveTab.value) return [];
  return allDailyData.value.filter(
    item =>
      item.username === detailUser.value!.username &&
      item.workDay?.startsWith(detailActiveTab.value)
  );
});

// 详情弹窗当前月统计
const detailMonthStats = computed(() => {
  const list = detailMonthData.value;
  const totalHours = list.reduce(
    (sum, item) => sum + calcEffectiveHours(item),
    0
  );
  const dayCount = list.length;
  const avgHours = dayCount > 0 ? totalHours / dayCount : 0;
  return {
    totalHours,
    dayCount,
    avgHours
  };
});

// 查看详情
const handleViewDetail = (row: ViewRow) => {
  const topDeptName =
    row.type === "person" && row.deptId
      ? pathMap.value.get(String(row.deptId))?.[0]?.deptName || "-"
      : "-";
  detailUser.value = { username: row.name, deptName: topDeptName };
  detailActiveTab.value = monthColumns.value[0] || "";
  detailVisible.value = true;
};

// 判断上班是否异常（未打卡、迟到、严重迟到、旷工迟到）
const isOnDutyAbnormal = (item: AttendanceDailySummaryDTO): boolean => {
  const result = item.onDutyTimeResult;
  if (!result) return false;
  return result === TimeResultEnum.NotSigned
    || result === TimeResultEnum.Late
    || result === TimeResultEnum.SeriousLate
    || result === TimeResultEnum.Absenteeism;
};

// 判断下班是否异常（未打卡、早退）
const isOffDutyAbnormal = (item: AttendanceDailySummaryDTO): boolean => {
  const result = item.offDutyTimeResult;
  if (!result) return false;
  return result === TimeResultEnum.NotSigned
    || result === TimeResultEnum.Early;
};

// 判断上班是否迟到（当天晚于9点）— 兼容旧逻辑，优先使用打卡结果字段
const isLate = (time?: string, workDay?: string, item?: AttendanceDailySummaryDTO): boolean => {
  // 优先使用打卡结果字段
  if (item?.onDutyTimeResult) {
    return item.onDutyTimeResult === TimeResultEnum.Late
      || item.onDutyTimeResult === TimeResultEnum.SeriousLate
      || item.onDutyTimeResult === TimeResultEnum.Absenteeism
      || item.onDutyTimeResult === TimeResultEnum.NotSigned;
  }
  if (!time) return false;
  const t = dayjs(time);
  // 如果打卡日期和工作日不是同一天，算异常（默认标红）
  if (workDay && !t.isSame(workDay, "day")) {
    return true;
  }
  return t.hour() > 9 || (t.hour() === 9 && t.minute() > 0);
};

// 判断下班是否早走（当天早于18点，跨天加班不算早走）— 兼容旧逻辑，优先使用打卡结果字段
const isEarlyLeave = (time?: string, workDay?: string, item?: AttendanceDailySummaryDTO): boolean => {
  // 优先使用打卡结果字段
  if (item?.offDutyTimeResult) {
    return item.offDutyTimeResult === TimeResultEnum.Early
      || item.offDutyTimeResult === TimeResultEnum.NotSigned;
  }
  if (!time) return false;
  // 如果下班日期和工作日不是同一天（跨天加班），不算早走
  if (workDay && !dayjs(time).isSame(workDay, "day")) {
    return false;
  }
  const t = dayjs(time);
  return t.hour() < 18;
};

// 计算有效工时（扣除午休、晚餐等）。请假不参与工时计算，按打卡结果原样判定
const calcEffectiveHours = (item: AttendanceDailySummaryDTO): number => {
  if (!item.onDutyTime || !item.offDutyTime) return 0;
  // 如果上下班都是未打卡，工时直接算0，不扣午休晚餐
  if (item.onDutyTimeResult === TimeResultEnum.NotSigned
      && item.offDutyTimeResult === TimeResultEnum.NotSigned) {
    return 0;
  }
  const hours = Number(item.durationHours || 0) - calcDeductedHours(item);
  return Math.max(0, hours);
};

// 判断当天是否异常（迟到或早走）
const isAbnormal = (item: AttendanceDailySummaryDTO): boolean => {
  return isLate(item.onDutyTime, item.workDay, item) || isEarlyLeave(item.offDutyTime, item.workDay, item);
};

// 详情表格行样式
const detailTableRowClassName = ({ row }: { row: AttendanceDailySummaryDTO }) => {
  if (isAbnormal(row)) return "row-abnormal";
  if (row.overtime) return "row-overtime";
  return "";
};

// 打卡结果中文映射
const timeResultTextMap: Record<string, string> = {
  [TimeResultEnum.Normal]: "正常",
  [TimeResultEnum.Early]: "早退",
  [TimeResultEnum.Late]: "迟到",
  [TimeResultEnum.SeriousLate]: "严重迟到",
  [TimeResultEnum.Absenteeism]: "旷工迟到",
  [TimeResultEnum.NotSigned]: "未打卡"
};

// 获取上班打卡结果文本
const getOnDutyResultText = (item: AttendanceDailySummaryDTO): string => {
  if (!item.onDutyTimeResult) return "正常";
  return timeResultTextMap[item.onDutyTimeResult] || item.onDutyTimeResult;
};

// 获取下班打卡结果文本
const getOffDutyResultText = (item: AttendanceDailySummaryDTO): string => {
  if (!item.offDutyTimeResult) return "正常";
  return timeResultTextMap[item.offDutyTimeResult] || item.offDutyTimeResult;
};

// 获取状态标签类型
const getStatusTagType = (item: AttendanceDailySummaryDTO): "success" | "primary" | "danger" | "warning" => {
  if (isAbnormal(item)) return "danger";
  if (item.overtime) return "primary";
  return "success";
};

// 获取状态文本
const getStatusText = (item: AttendanceDailySummaryDTO): string => {
  const results: string[] = [];
  if (item.onDutyTimeResult && item.onDutyTimeResult !== TimeResultEnum.Normal) {
    results.push(timeResultTextMap[item.onDutyTimeResult] || item.onDutyTimeResult);
  }
  if (item.offDutyTimeResult && item.offDutyTimeResult !== TimeResultEnum.Normal) {
    results.push(timeResultTextMap[item.offDutyTimeResult] || item.offDutyTimeResult);
  }
  if (results.length > 0) return results.join(" / ");
  if (item.overtime) return "加班";
  return "正常";
};

// 计算扣除工时（午休 + 晚餐）
const calcDeductedHours = (item: AttendanceDailySummaryDTO): number => {
  if (!item.onDutyTime || !item.offDutyTime) return 0;
  let deducted = 0;
  const onTime = dayjs(item.onDutyTime);
  const offTime = dayjs(item.offDutyTime);
  const workDay = item.workDay || onTime.format("YYYY-MM-DD");

  // 午休 1 小时
  const lunchStart = dayjs(`${workDay} 12:15:00`);
  const lunchEnd = dayjs(`${workDay} 13:15:00`);
  if (onTime.isBefore(lunchEnd) && offTime.isAfter(lunchStart)) {
    deducted += 1;
  }

  // 晚餐 1 小时
  if (item.overtime) {
    const dinnerEnd = dayjs(`${workDay} 19:00:00`);
    if (offTime.isAfter(dinnerEnd)) {
      deducted += 1;
    }
  }

  return deducted;
};

// 格式化工时（保留2位小数）
const formatHours = (val?: number | string): string => {
  if (val === undefined || val === null || val === "") return "-";
  return Number(val).toFixed(2);
};

// 是否跨年
const isCrossYear = computed(() => {
  if (!activeMonthRange.value?.[0] || !activeMonthRange.value?.[1]) return false;
  return dayjs(activeMonthRange.value[0]).year() !== dayjs(activeMonthRange.value[1]).year();
});

// 格式化月份显示：跨年显示"2026年1月"，不跨年显示"1月"
const formatMonthLabel = (monthStr: string): string => {
  if (isCrossYear.value) {
    return `${dayjs(monthStr).year()}年${dayjs(monthStr).month() + 1}月`;
  }
  return `${dayjs(monthStr).month() + 1}月`;
};

// 加载进度
const loadingProgress = ref(0);
const loadingTotal = ref(0);

// 分页拉取全部数据（接口有1000条上限，需要循环拉取）
const fetchAllData = async () => {
  if (!activeMonthRange.value?.[0] || !activeMonthRange.value?.[1]) {
    ElMessage.warning("请选择月份范围");
    return;
  }
  loading.value = true;
  loadingProgress.value = 0;
  loadingTotal.value = 0;
  allDailyData.value = [];

  try {
    const [startDate] = getMonthRange(activeMonthRange.value[0]);
    const [, endDate] = getMonthRange(activeMonthRange.value[1]);
    const pageSize = 1000;
    let pageNum = 1;
    let allList: any[] = [];

    // 先拉第一页，拿到 total
    const firstRes: any = await getDailySummary({
      pageNum,
      pageSize,
      startDate,
      endDate
    });
    if (!firstRes?.success) {
      ElMessage.error(firstRes?.msg || "查询失败");
      return;
    }
    const total = Number(firstRes.data?.total ?? firstRes.total ?? 0);
    loadingTotal.value = total;
    const firstList = firstRes.data?.list ?? firstRes.list ?? [];
    allList = allList.concat(firstList);
    loadingProgress.value = firstList.length;

    // 如果还有更多页，继续拉取
    const totalPages = Math.ceil(total / pageSize);
    while (pageNum < totalPages) {
      pageNum++;
      const res: any = await getDailySummary({
        pageNum,
        pageSize,
        startDate,
        endDate
      });
      if (res?.success) {
        const list = res.data?.list ?? res.list ?? [];
        allList = allList.concat(list);
        loadingProgress.value = allList.length;
      } else {
        break;
      }
    }

    allDailyData.value = allList;
  } catch (error: any) {
    ElMessage.error(error.message || "请求失败");
  } finally {
    loading.value = false;
    loadingProgress.value = 0;
    loadingTotal.value = 0;
  }
};

// 搜索
const handleSearch = () => {
  activeMonthRange.value = [...monthRange.value] as [string, string];
  fetchAllData();
};

// 重置
const handleReset = () => {
  const defaultRange = getDefaultMonthRange();
  monthRange.value = defaultRange;
  activeMonthRange.value = defaultRange;
  filterKeywords.value = [];
  currentDeptId.value = null;
  showFilterResult.value = false;
  fetchAllData();
};

// 当姓名筛选被清空时，退出"筛选结果"视图
watch(
  () => filterKeywords.value.length,
  len => {
    if (len === 0) {
      showFilterResult.value = false;
      currentDeptId.value = null;
      expandedGroups.value = new Set();
    }
  }
);

onMounted(async () => {
  // 检查是否为首次登录进入，强制刷新确保全局样式正确覆盖
  if (route.query.firstLogin === "true") {
    const newQuery = { ...route.query };
    delete newQuery.firstLogin;
    router.replace({ query: newQuery }).then(() => {
      window.location.reload();
    });
    return;
  }

  // 并行加载部门树和工时数据
  fetchDeptTree();
  fetchAllData();
});
</script>

<template>
  <div class="work-hours-board-container">
    <NavBar />
    <div class="work-hours-content">
      <div class="board-wrapper">
        <!-- 数据说明（可折叠） -->
        <div class="data-desc">
          <div class="desc-header" @click="descExpanded = !descExpanded">
            <el-icon class="desc-icon" :class="{ expanded: descExpanded }">
              <ArrowDown />
            </el-icon>
            <span class="desc-title">数据说明</span>
            <span class="desc-hint">点击展开查看计算规则</span>
          </div>
          <div v-show="descExpanded" class="desc-content">
            <div class="desc-item desc-highlight">
              <span class="desc-label">工时计算</span>
              <span class="desc-value">
                有效工时 = 下班打卡时间 - 上班打卡时间 - 扣除项<br />
                <strong>扣除项 1：</strong>午休（12:15~13:15）1 小时 — 上下班时间覆盖该时段则扣除<br />
                <strong>扣除项 2：</strong>晚餐（18:00~19:00）1 小时 — 加班标识为 true 且下班晚于 19:00 则扣除<br />
                <strong>特殊情况：</strong>上下班均为「未打卡」时，工时直接记为 0，不扣除午休/晚餐
              </span>
            </div>
            <div class="desc-item desc-highlight">
              <span class="desc-label">平均工时</span>
              <span class="desc-value">
                <strong>员工个人平均工时 =</strong> 该员工当月有效工时总和 ÷ 当月出勤天数<br />
                <strong>部门平均工时 =</strong> 部门内每一名员工「个人平均工时」<strong>逐人相加</strong>后 ÷ 部门人数<br />
                <span style="color: #909399; font-size: 12px">
                  例：某部门 A、B 两人，A 个人平均 9h、B 个人平均 7h ⇒ 部门平均 = (9+7) ÷ 2 = 8h
                </span>
              </span>
            </div>
            <div class="desc-item">
              <span class="desc-label">总工时</span>
              <span class="desc-value">选定月份范围内，该部门/员工所有打卡天数的<strong>有效工时</strong>总和。<br />
                部门总工时 = 部门内所有成员有效工时相加；员工总工时 = 该员工有效工时总和</span>
            </div>
            <div class="desc-item">
              <span class="desc-label">下钻规则</span>
              <span class="desc-value">按钉钉组织架构逐级下钻：一级部门 → 二级部门 → … → 具体人员；最末级部门展示其直属人员</span>
            </div>
            <div class="desc-item">
              <span class="desc-label">颜色规则</span>
              <span class="desc-value">
                <span class="text-red">红色</span>：上班异常（迟到/严重迟到/旷工迟到/未打卡）或下班异常（早退/未打卡）
                <span class="text-green">绿色</span>：正常打卡（跨天加班算正常）
              </span>
            </div>
            <div class="desc-item">
              <span class="desc-label">请假标识</span>
              <span class="desc-value">详情中「请假」列仅为当天是否有<strong>请假审批</strong>的标识状态，<strong>不代表当天全天请假</strong>，不参与工时/打卡状态的计算</span>
            </div>
            <div class="desc-item">
              <span class="desc-label">数据来源</span>
              <span class="desc-value">考勤系统每日打卡汇总</span>
            </div>
            <div class="desc-item">
              <span class="desc-label">数据加载</span>
              <span class="desc-value">接口单次最多返回 1000 条，数据量大会自动分页拉取全部数据</span>
            </div>
          </div>
        </div>

        <!-- 搜索筛选区域 -->
        <div class="search-section">
          <div class="search-title">筛选条件</div>
          <el-form :inline="true" class="search-form">
            <el-form-item label="月份范围">
              <el-date-picker
                v-model="monthRange"
                type="monthrange"
                range-separator="至"
                start-placeholder="开始月份"
                end-placeholder="结束月份"
                value-format="YYYY-MM"
                style="width: 280px"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="Search" @click="handleSearch">
                查询
              </el-button>
              <el-button :icon="Refresh" @click="handleReset">重置</el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 数据列表 -->
        <div class="table-section">
          <div class="section-header">
            <div class="section-title">
              <div class="title-left">
                <span>工时汇总（小时）</span>
                <el-radio-group
                  v-model="displayMode"
                  size="small"
                  style="margin-left: 16px"
                >
                  <el-radio-button label="avg">平均工时</el-radio-button>
                  <el-radio-button label="total">总工时</el-radio-button>
                </el-radio-group>
              </div>
              <div class="title-right">
                <el-select
                  v-model="filterKeywords"
                  placeholder="筛选姓名"
                  filterable
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  clearable
                  size="small"
                  style="width: 240px; margin-right: 12px"
                >
                  <el-option
                    v-for="name in usernameOptions"
                    :key="name"
                    :label="name"
                    :value="name"
                  />
                </el-select>
                <span class="total-count">
                  共 {{ viewRows.length }}
                  {{ showFilterResult ? "人" : currentDeptId ? "项" : "个部门" }}
                </span>
              </div>
            </div>

            <!-- 面包屑 / 返回上级 -->
            <div class="breadcrumb-bar">
              <el-button
                :icon="ArrowLeft"
                text
                size="small"
                :disabled="!currentDeptId && !showFilterResult"
                @click="handleBack"
              >
                返回上级
              </el-button>
              <el-breadcrumb separator="/">
                <el-breadcrumb-item
                  :class="{ 'is-link': !!currentDeptId || showFilterResult }"
                  @click="handleBreadcrumbClick(-1)"
                >
                  全部部门
                </el-breadcrumb-item>
                <el-breadcrumb-item v-if="showFilterResult">筛选结果</el-breadcrumb-item>
                <el-breadcrumb-item
                  v-for="(d, idx) in currentPath"
                  :key="d.deptId"
                  :class="{ 'is-link': idx < currentPath.length - 1 }"
                  @click="handleBreadcrumbClick(idx)"
                >
                  {{ d.deptName }}
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>

            <!-- 筛选状态提示 -->
            <div v-if="filterKeywords.length > 0" class="filter-tip">
              <span class="filter-tip-text">
                已筛选姓名（<strong>{{ filterKeywords.length }}</strong> 个）：命中
                <strong>{{ persons.length }}</strong> 人 ·
                部门汇总保持完整，筛选在最末级人员列表显示
              </span>
              <el-button
                text
                size="small"
                type="primary"
                style="padding: 0 4px"
                @click="handleLocatePerson"
              >
                定位到人员
              </el-button>
              <el-button
                text
                size="small"
                type="primary"
                style="padding: 0 4px"
                @click="filterKeywords = []"
              >
                清空筛选
              </el-button>
            </div>
          </div>

          <!-- 加载进度条 -->
          <div v-if="loading && loadingTotal > 0" class="loading-progress">
            <el-progress
              :percentage="Math.min(100, Math.round((loadingProgress / loadingTotal) * 100))"
              :stroke-width="6"
            />
            <span class="progress-text">
              加载中... {{ loadingProgress }} / {{ loadingTotal }}
            </span>
          </div>

          <el-table
            v-loading="loading"
            :data="viewRows"
            border
            stripe
            size="small"
            style="width: 100%"
            :row-class-name="tableRowClassName"
            @row-click="handleRowClick"
          >
            <el-table-column
              label="序号"
              width="70"
              align="center"
              fixed="left"
            >
              <template #default="{ $index }">
                {{ $index + 1 }}
              </template>
            </el-table-column>
            <el-table-column
              :label="showFilterResult || currentDeptId ? '部门 / 姓名' : '部门'"
              width="160"
              align="left"
              show-overflow-tooltip
            >
              <template #default="{ row }">
  <span
    class="name-cell"
    :class="{ 'group-header': row.type === 'group' }"
  >
    <el-icon
      v-if="row.type === 'dept' || row.type === 'group'"
      class="dept-icon"
    >
      <OfficeBuilding />
    </el-icon>
    <el-icon
      v-else-if="row.type === 'person'"
      class="person-icon"
    >
      <User />
    </el-icon>
    {{ row.name }}
    <span
      v-if="row.type === 'group'"
      class="group-count"
    >
      ({{ row.headcount }}人)
    </span>
    <el-icon
      v-if="row.type === 'group'"
      class="group-arrow"
      :class="{ 'is-collapsed': expandedGroups.has(row.name) }"
      style="margin-left: 6px; vertical-align: -2px"
    >
      <ArrowDown />
    </el-icon>
  </span>
</template>
            </el-table-column>
            <el-table-column
              v-if="showFilterResult"
              label="所属部门"
              width="240"
              align="left"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.type === "group" ? "-" : row.deptPath || "-" }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="!showFilterResult"
              label="人数"
              width="80"
              align="center"
            >
              <template #default="{ row }">
                {{ row.type === "dept" ? row.headcount : "-" }}
              </template>
            </el-table-column>
            <el-table-column
              v-for="month in monthColumns"
              :key="month"
              :label="formatMonthLabel(month)"
              width="140"
              align="center"
              sortable
              :sort-method="(a: any, b: any) => Number(cellValue(a, month)) - Number(cellValue(b, month))"
            >
              <template #default="{ row }">
                {{ formatHours(cellValue(row, month)) }}
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="100"
              align="center"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  v-if="row.type === 'group'"
                  type="primary"
                  text
                  @click.stop="handleToggleGroup(row)"
                >
                  {{ expandedGroups.has(row.name) ? "收起" : "展开" }}
                </el-button>
                <el-button
                  v-else-if="row.type === 'dept'"
                  type="primary"
                  text
                  @click.stop="handleEnterDept(row)"
                >
                  进入
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  text
                  :icon="DataLine"
                  @click.stop="handleViewDetail(row)"
                >
                  详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="工时详情"
      width="900px"
      :close-on-click-modal="false"
    >
      <template v-if="detailUser" #header>
        <span style="font-size: 16px; font-weight: 600">
          {{ detailUser.username }}
          <span v-if="detailUser.deptName" style="font-size: 13px; color: #909399; font-weight: 400; margin-left: 8px">
            {{ detailUser.deptName }}
          </span>
          - 工时详情
        </span>
      </template>
      <el-tabs v-model="detailActiveTab">
        <el-tab-pane
          v-for="month in monthColumns"
          :key="month"
          :label="formatMonthLabel(month)"
          :name="month"
        />
      </el-tabs>

      <!-- 状态说明 -->
      <div class="detail-legend">
        <span class="legend-item">
          <el-tag type="success" size="small" effect="dark">正常</el-tag>
          <span class="legend-text">打卡正常</span>
        </span>
        <span class="legend-item">
          <el-tag type="primary" size="small" effect="dark">加班</el-tag>
          <span class="legend-text">有加班记录</span>
        </span>
                <span class="legend-item">
          <el-tag type="danger" size="small" effect="dark">异常</el-tag>
          <span class="legend-text">迟到或早走</span>
        </span>
        <span class="legend-item">
          <span class="text-leave">请假</span>
          <span class="legend-text">当天有请假审批（标识，不代表全天请假）</span>
        </span>
        <span class="legend-tip">
          总工时、平均工时均按有效工时计算（扣除午休及加班晚餐时长）
        </span>
      </div>

      <!-- 月度统计 -->
      <div class="detail-stats">
        <div class="stat-item">
          <div class="stat-label">总工时（小时）</div>
          <div class="stat-value">{{ formatHours(detailMonthStats.totalHours) }}</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-label">出勤天数</div>
          <div class="stat-value">{{ detailMonthStats.dayCount }} 天</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-label">平均工时（小时）</div>
          <div class="stat-value">{{ formatHours(detailMonthStats.avgHours) }}</div>
        </div>
      </div>

      <el-table
        :data="detailMonthData"
        border
        stripe
        size="small"
        :row-class-name="detailTableRowClassName"
        style="width: 100%; margin-top: 12px"
      >
        <el-table-column
          prop="workDay"
          label="日期"
          width="110"
          align="center"
        />
        <el-table-column label="状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row)" size="small">
              {{ getStatusText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="请假" width="80" align="center">
          <template #default="{ row }">
            <span :class="{ 'text-leave': row.leave }">
              {{ row.leave ? "请假" : "-" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="原始工时" width="80" align="center">
          <template #default="{ row }">
            {{ formatHours(row.durationHours) }}
          </template>
        </el-table-column>
        <el-table-column label="扣除工时" width="80" align="center">
          <template #default="{ row }">
            {{ calcDeductedHours(row) > 0 ? `-${calcDeductedHours(row).toFixed(1)}` : "-" }}
          </template>
        </el-table-column>
        <el-table-column label="上班打卡" width="150" align="center">
          <template #default="{ row }">
            <span
              :class="{
                'text-red': isLate(row.onDutyTime, row.workDay, row),
                'text-green': !isLate(row.onDutyTime, row.workDay, row) && row.onDutyTime
              }"
            >
              {{ row.onDutyTime || "-" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="下班打卡" width="150" align="center">
          <template #default="{ row }">
            <span
              :class="{
                'text-red': isEarlyLeave(row.offDutyTime, row.workDay, row),
                'text-green':
                  !isEarlyLeave(row.offDutyTime, row.workDay, row) && row.offDutyTime
              }"
            >
              {{ row.offDutyTime || "-" }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="有效工时" width="80" align="center">
          <template #default="{ row }">
            {{ formatHours(calcEffectiveHours(row)) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 回到顶部 -->
    <el-backtop :right="30" :bottom="30" />
  </div>
</template>

<style lang="scss" scoped>
.work-hours-board-container {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.work-hours-content {
  padding-top: 50px;
  min-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding-top: 46px;
  }
}

.board-wrapper {
  padding: 20px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 12px;
  }
}

// 数据说明折叠面板
.data-desc {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;

  .desc-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    .desc-icon {
      font-size: 14px;
      color: #909399;
      margin-right: 8px;
      transition: transform 0.2s;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    .desc-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
      margin-right: 12px;
    }

    .desc-hint {
      font-size: 12px;
      color: #909399;
    }
  }

  .desc-content {
    padding: 12px 16px 14px 38px;
    border-top: 1px solid #f0f2f5;

    .desc-warning {
      background: #fff7e6;
      border: 1px solid #ffd591;
      color: #d46b08;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 1.6;
      margin-bottom: 12px;
    }

    .desc-item {
      display: flex;
      padding: 6px 0;
      font-size: 13px;
      line-height: 1.6;

      .desc-label {
        flex-shrink: 0;
        width: 70px;
        color: #909399;
      }

      .desc-value {
        flex: 1;
        color: #606266;
      }

      &.desc-highlight {
        background: #ecf5ff;
        border: 1px solid #b3d8ff;
        border-radius: 6px;
        padding: 10px 12px;
        margin: 4px 0;

        .desc-label {
          color: #409eff;
          font-weight: 600;
        }

        .desc-value {
          color: #303133;
        }
      }
    }
  }
}

// 搜索筛选区域
.search-section {
  background: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  .search-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ebeef5;
  }

  :deep(.search-form) {
    .el-form-item {
      margin-bottom: 0;
    }
  }
}

// 数据列表
.table-section {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  .section-header {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ebeef5;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title-left {
      display: flex;
      align-items: center;
    }

    .title-right {
      display: flex;
      align-items: center;
    }

    .total-count {
      font-size: 14px;
      font-weight: 400;
      color: #909399;
    }
  }

  .breadcrumb-bar {
    display: flex;
    align-items: center;
    margin-top: 8px;

    .is-link {
      cursor: pointer;
      color: #409eff;
    }
  }

  .filter-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 6px 12px;
    background: #ecf5ff;
    border: 1px solid #b3d8ff;
    border-radius: 6px;
    font-size: 12px;
    color: #606266;

    .filter-tip-text {
      strong {
        color: #409eff;
      }
    }
  }

  .name-cell {
    display: inline-flex;
    align-items: center;
    cursor: pointer;

    &:hover {
      color: #409eff;
    }

    &.group-header {
      font-weight: 600;
      color: #303133;
    }

    // 部门/分组图标（蓝色建筑）
    .dept-icon {
      color: #409eff;
      vertical-align: -2px;
      margin-right: 6px;
    }

    // 人员图标（青绿色人形，与部门区分）
    .person-icon {
      color: #0f9d8f;
      vertical-align: -2px;
      margin-right: 6px;
    }

    .group-count {
      font-weight: 400;
      color: #909399;
    }

    .group-arrow {
      transition: transform 0.2s;

      &.is-collapsed {
        transform: rotate(-90deg);
      }
    }
  }

  .loading-progress {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.el-progress) {
      flex: 1;
    }

    .progress-text {
      font-size: 13px;
      color: #909399;
      white-space: nowrap;
    }
  }
}

// 筛选结果分组头行颜色
:deep(.row-group-header) {
  --el-table-tr-bg-color: #f0f4ff;
  --el-table-striped-odd-row-bg-color: #f0f4ff;
  font-weight: 600;

  &:hover > td {
    background-color: #e6efff !important;
  }
}

// 详情表格行颜色
:deep(.row-overtime) {
  --el-table-tr-bg-color: #ecf5ff;
  --el-table-striped-odd-row-bg-color: #ecf5ff;

  &:hover > td {
    background-color: #d9ecff !important;
  }
}

:deep(.row-abnormal) {
  --el-table-tr-bg-color: #fef0f0;
  --el-table-striped-odd-row-bg-color: #fef0f0;

  &:hover > td {
    background-color: #fde2e2 !important;
  }
}

// 详情图例
.detail-legend {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
  flex-wrap: wrap;

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-text {
    font-size: 12px;
    color: #909399;
  }

  .legend-tip {
    font-size: 12px;
    color: #909399;
    margin-left: auto;
  }
}

.text-red {
  color: #f56c6c;
  font-weight: 600;
}

.text-green {
  color: #67c23a;
  font-weight: 600;
}

.text-leave {
  color: #e6a23c;
  font-weight: 600;
}

// 详情弹窗统计卡片
.detail-stats {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-top: 12px;

  .stat-item {
    flex: 1;
    text-align: center;

    .stat-label {
      font-size: 13px;
      color: #909399;
      margin-bottom: 6px;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }
  }

  .stat-divider {
    width: 1px;
    height: 40px;
    background: #e4e7ed;
  }
}
</style>
