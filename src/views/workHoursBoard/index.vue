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

// 数据最早月份（该月之前存在数据，禁止选择）
const MIN_MONTH = dayjs("2026-03-01");
// 默认结束月份为当前月（禁止选择未来月份）
const CURRENT_MONTH = dayjs().startOf("month");
// 月份范围选择器禁选月份：早于最早数据月份 或 晚于当前月
const disabledMonth = (date: Date) => {
  const m = dayjs(date).startOf("month");
  return m.isBefore(MIN_MONTH.startOf("month")) || m.isAfter(CURRENT_MONTH);
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

// 按人员+月份聚合的数据（保存有效工时总和、应出勤/请假天数）
interface PersonData {
  username: string;
  dingUserId: string;
  deptId?: string;
  chain: DeptNode[]; // 从顶级到所在部门的完整链路
  totalHours: Record<string, number>; // 每月有效工时总和（扣除午休/晚餐）
  scheduledDays: Record<string, number>; // 每月应出勤天数（当月实际数据条数）
  leaveDays: Record<string, number>; // 每月请假天数（扣减口径，同详情弹窗）
}

// 全部人员聚合数据（不套用姓名筛选，用于部门汇总口径）
const allPersons = computed<PersonData[]>(() => {
  const map = new Map<string, PersonData>();
  // 每人每月原始日记录（用于计算请假天数，同详情弹窗口径）
  const rawByPerson = new Map<string, Record<string, AttendanceDailySummaryDTO[]>>();
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
        scheduledDays: {},
        leaveDays: {}
      };
      monthColumns.value.forEach(m => {
        row.totalHours[m] = 0;
        row.scheduledDays[m] = 0;
        row.leaveDays[m] = 0;
      });
      map.set(key, row);
    }
    const p = map.get(key)!;
    const workMonth = item.workDay.substring(0, 7);
    if (p.totalHours[workMonth] !== undefined) {
      p.totalHours[workMonth] += calcEffectiveHours(item);
      if (!rawByPerson.has(key)) rawByPerson.set(key, {});
      const byMonth = rawByPerson.get(key)!;
      (byMonth[workMonth] || (byMonth[workMonth] = [])).push(item);
    }
  });
  // 逐人逐月补算应出勤天数与请假天数
  map.forEach((p, key) => {
    monthColumns.value.forEach(m => {
      // 应出勤天数直接用实际数据条数（有多少条记录就算多少天）
      p.scheduledDays[m] = rawByPerson.get(key)?.[m]?.length || 0;
      const items = rawByPerson.get(key)?.[m];
      p.leaveDays[m] = items && items.length ? calcLeaveDays(items, m) : 0;
    });
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
// 聚合一组人员：组内每人"有效工时列 / 实际工时列"取值的求和
// （两列取值同详情弹窗口径：有效工时=总和÷应出勤，实际工时=总和÷实际出勤）
const calcGroup = (plist: PersonData[], months: string[]) => {
  const effVal: Record<string, number> = {};
  const actVal: Record<string, number> = {};
  months.forEach(m => {
    effVal[m] = 0;
    actVal[m] = 0;
  });
  plist.forEach(p => {
    months.forEach(m => {
      const total = p.totalHours[m] || 0;
      const sch = p.scheduledDays[m] || 0;
      const act = Math.max(0, sch - (p.leaveDays[m] || 0));
      effVal[m] += sch > 0 ? total / sch : 0;
      actVal[m] += act > 0 ? total / act : 0;
    });
  });
  return { effVal, actVal, headcount: plist.length };
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
  // 人员行：原始口径（用于计算人日均有效/实际工时，入职详情弹窗）
  totalHours?: Record<string, number>; // 每月有效工时总和
  scheduledDays?: Record<string, number>; // 每月应出勤天数
  leaveDays?: Record<string, number>; // 每月请假天数
  // 部门/分组行：组内每人"两列值"的求和（平均=÷人数，总=原样）
  effVal?: Record<string, number>; // 组内"有效工时列"求和
  actVal?: Record<string, number>; // 组内"实际工时列"求和
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
            scheduledDays: p.scheduledDays,
            leaveDays: p.leaveDays,
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
    return deptTreeData.value
      .map(top => {
        const agg = calcGroup(personsInDept(String(top.deptId)), months);
        return {
          type: "dept",
          key: String(top.deptId),
          name: top.deptName || "-",
          deptId: top.deptId,
          hasChildren: !!top.children?.length,
          ...agg
        };
      })
      .filter(row => (row.headcount || 0) > 0);
  }

  const node = deptIdMap.value.get(String(currentDeptId.value));
  if (!node) return [];

  // 有子部门：展示下一级子部门 + 当前部门的直属人员（可能存在一边挂子部门一边挂人员的混合部门）
  if (node.children?.length) {
    // 自动隐藏人数为 0 的部门（该部门无考勤数据）
    const deptRows: ViewRow[] = node.children
      .map(child => {
        const agg = calcGroup(personsInDept(String(child.deptId)), months);
        return {
          type: "dept",
          key: String(child.deptId),
          name: child.deptName || "-",
          deptId: child.deptId,
          hasChildren: !!child.children?.length,
          ...agg
        };
      })
      .filter(row => (row.headcount || 0) > 0);
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
      scheduledDays: p.scheduledDays,
      leaveDays: p.leaveDays
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
      scheduledDays: p.scheduledDays,
      leaveDays: p.leaveDays
    }));
});

// 单元格显示值（按展示模式 + 口径计算）
// metric: "effective"=有效工时， "actual"=实际工时（原始打卡时长）
// 单元格显示值
// metric: "effective"=有效工时列（总和÷应出勤天数），"actual"=实际工时列（总和÷实际出勤天数）
// 人员行：两列取值固定（人日均口径，同详情弹窗），不受 average/total 切换影响
// 部门/分组行：average=组内每人两列值相加÷人数，total=组内每人两列值相加
const cellValue = (
  row: ViewRow,
  m: string,
  metric: "effective" | "actual"
): number => {
  if (row.type === "person") {
    const total = row.totalHours?.[m] || 0;
    const sch = row.scheduledDays?.[m] || 0;
    const act = Math.max(0, sch - (row.leaveDays?.[m] || 0));
    if (metric === "effective") return sch > 0 ? total / sch : 0;
    return act > 0 ? total / act : 0;
  }
  // 部门/分组
  const sum =
    metric === "effective" ? row.effVal?.[m] || 0 : row.actVal?.[m] || 0;
  if (displayMode.value === "total") return sum;
  return row.headcount > 0 ? sum / row.headcount : 0;
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


// 计算某天请假时段覆盖的有效工时（工作时段 9:00~12:15、13:15~18:00），返回小时数
const calcLeaveWorkHours = (
  dayStart: dayjs.Dayjs,
  start: dayjs.Dayjs,
  end: dayjs.Dayjs
): number => {
  const slots: [dayjs.Dayjs, dayjs.Dayjs][] = [
    [dayStart.hour(9).minute(0).second(0), dayStart.hour(12).minute(15).second(0)],
    [dayStart.hour(13).minute(15).second(0), dayStart.hour(18).minute(0).second(0)]
  ];
  let minutes = 0;
  slots.forEach(([ws, we]) => {
    const ovs = start.isAfter(ws) ? start : ws;
    const ove = end.isBefore(we) ? end : we;
    if (ove.isAfter(ovs)) minutes += ove.diff(ovs, "minute");
  });
  return minutes / 60;
};

// 计算某条记录当天被请假扣除的天数（用于详情「请假」列旁展示）
// 该工作日的请假与当天工作时段 9:00~18:00 取交集，覆盖时长折算：全天（>=6 小时）=1 天，上/下午=0.5 天
const calcDayLeaveDays = (item: AttendanceDailySummaryDTO): number => {
  if (!item.leaveStartTime || !item.leaveEndTime) return 0;
  const dayStart = dayjs(item.workDay);
  const start = dayjs(item.leaveStartTime);
  const end = dayjs(item.leaveEndTime);
  if (!dayStart.isValid() || !start.isValid() || !end.isValid()) return 0;
  const d0 = dayStart.startOf("day");
  const d1 = dayStart.endOf("day");
  // 请假区间与当天取交集
  const s = start.isBefore(d0) ? d0 : start;
  const e = end.isAfter(d1) ? d1 : end;
  // 无交集或交集为空
  if (e.isBefore(s) || e.isSame(s)) return 0;
  const hours = calcLeaveWorkHours(dayStart, s, e);
  if (hours <= 0) return 0;
  return hours >= 6 ? 1 : 0.5;
};

// 请假天数展示格式：整数不带小数，0.5 保留 1 位
const formatLeaveDays = (days: number): string => {
  return Number.isInteger(days) ? `${days}` : days.toFixed(1);
};

// 计算该月实际请假天数
// 注意：后端会把整段请假区间（如 2026-07-13 ~ 2026-08-13）复制到每一天的记录上，
// 所以不能按"每条记录各自展开区间"累计（会导致重复虚增）。这里合并成真实请假区间后再按覆盖工作日统计。
// 覆盖了当天（工作日）即算当天的假；全天 9:00~18:00 = 1 天，上午/下午 = 0.5 天
const calcLeaveDays = (list: AttendanceDailySummaryDTO[], monthStr: string): number => {
  if (!monthStr) return 0;
  // 1) 收集请假区间并合并（取并集）
  const spans = list
    .filter(i => i.leaveStartTime && i.leaveEndTime)
    .map(i => ({ start: dayjs(i.leaveStartTime), end: dayjs(i.leaveEndTime) }))
    .filter(s => s.start.isValid() && s.end.isValid())
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());

  const merged: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && !s.start.isAfter(last.end)) {
      if (s.end.isAfter(last.end)) last.end = s.end;
    } else {
      merged.push({ ...s });
    }
  }

  // 2) 统计合并后区间覆盖到的当月工作日（周一~五）
  const seenDays = new Set<string>();
  let days = 0;
  merged.forEach(({ start, end }) => {
    let cur = start.startOf("day");
    const last = end.startOf("day");
    while (cur.isBefore(last) || cur.isSame(last, "day")) {
      const dayKey = cur.format("YYYY-MM-DD");
      const weekday = cur.day();
      if (dayKey.startsWith(monthStr) && weekday >= 1 && weekday <= 5 && !seenDays.has(dayKey)) {
        seenDays.add(dayKey);
        const s = start.isBefore(cur) ? cur : start;
        const e = end.isAfter(cur.endOf("day")) ? cur.endOf("day") : end;
        const hours = calcLeaveWorkHours(cur, s, e);
        if (hours > 0) days += hours >= 6 ? 1 : 0.5;
      }
      cur = cur.add(1, "day");
    }
  });
  return days;
};

// 详情弹窗当前月统计
const detailMonthStats = computed(() => {
  const list = detailMonthData.value;
  const totalHours = list.reduce(
    (sum, item) => sum + calcEffectiveHours(item),
    0
  );
  // 应出勤天数直接用表格实际数据条数（有多少条记录就算多少天）
  const scheduledDays = list.length;
  const leaveDays = calcLeaveDays(list, detailActiveTab.value);
  const actualAttendanceDays = Math.max(0, scheduledDays - leaveDays);
  const avgHours = scheduledDays > 0 ? totalHours / scheduledDays : 0;
  const actualAvgHours = actualAttendanceDays > 0 ? totalHours / actualAttendanceDays : 0;
  // TODO: 临时调试日志（肖嘉玲），排查完请删除
  if (detailUser.value?.username === "肖嘉玲") {
    console.log(
      `[调试] ${detailUser.value.username} ${detailActiveTab.value}`,
      { scheduledDays, leaveDays, actualAttendanceDays, totalHours },
      list.map(i => ({
        day: i.workDay,
        leaveStart: i.leaveStartTime,
        leaveEnd: i.leaveEndTime,
        onResult: i.onDutyTimeResult,
        offResult: i.offDutyTimeResult
      }))
    );
  }
  return {
    totalHours,
    scheduledDays,
    leaveDays,
    actualAttendanceDays,
    avgHours,
    actualAvgHours
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

// 早晚都不打卡时的默认工时（小时）
const DEFAULT_NOT_SIGNED_HOURS = 8;

// 计算有效工时（扣除午休、晚餐等）。请假不参与工时计算，按打卡结果原样判定
const calcEffectiveHours = (item: AttendanceDailySummaryDTO): number => {
  // 全天请假（请假扣除满 1 天）：当天有效工时为 0
  if (calcDayLeaveDays(item) >= 1) return 0;
  // 早晚都不打卡：默认按 8 小时有效工时计，不扣午休/晚餐
  if (item.onDutyTimeResult === TimeResultEnum.NotSigned
      && item.offDutyTimeResult === TimeResultEnum.NotSigned) {
    return DEFAULT_NOT_SIGNED_HOURS;
  }
  // 未打卡时会按默认排班时间回填，因此一般情况下 onDutyTime/offDutyTime 都有值，
  // 此分支为防御性兜底，理论上不可达
  if (!item.onDutyTime || !item.offDutyTime) return 0;
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

// 格式化天数：整数显示整数，小数保留1位（半天 0.5）
const formatAttendanceDays = (val?: number): string => {
  if (val === undefined || val === null) return "-";
  return Math.round(val) === val ? String(val) : Number(val).toFixed(1);
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
  const [startMonth, endMonth] = monthRange.value;
  if (startMonth && dayjs(startMonth + "-01").isBefore(MIN_MONTH)) {
    ElMessage.warning("数据自 2026 年 3 月起，起始月份不能早于 2026-03");
    return;
  }
  if (endMonth && dayjs(endMonth + "-01").isAfter(CURRENT_MONTH)) {
    ElMessage.warning("结束月份不能晚于当前月");
    return;
  }
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
    // 同步重写地址栏，确保 reload 时 firstLogin 一定已从 URL 清除，避免死循环
    const newQuery = { ...(route.query as Record<string, string>) };
    delete newQuery.firstLogin;
    window.history.replaceState(
      null,
      "",
      router.resolve({ path: "/workHoursBoard", query: newQuery }).href
    );
    window.location.reload();
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
              <span class="desc-label">工时计算（单日）</span>
              <span class="desc-value">
                <strong>当日有效工时</strong> = 下班打卡时间 - 上班打卡时间 - 扣除项<br />
                <strong>扣除项 1：</strong>午休（12:15~13:15）1 小时 — 上下班时间覆盖该时段则扣除<br />
                <strong>扣除项 2：</strong>晚餐（18:00~19:00）1 小时 — 加班标识为 true 且下班晚于 19:00 则扣除<br />
                <strong>特殊情况：</strong>全天请假（扣除满 1 天）时当日有效工时按 <strong>0 小时</strong>计；上下班均为「未打卡」时默认按 <strong>8 小时</strong>计，不扣除午休/晚餐
              </span>
            </div>
            <div class="desc-item desc-highlight">
              <span class="desc-label">有效工时 / 实际工时</span>
              <span class="desc-value">
                <strong>有效工时（列）=</strong> 当月「当日有效工时」总和 ÷ 应出勤天数（当月实际数据条数）<br />
                <strong>实际工时（列）=</strong> 当月「当日有效工时」总和 ÷ 实际出勤天数（应出勤 - 请假）<br />
                <span style="color: #909399; font-size: 12px">
                  两列分子均为当月各日「当日有效工时」之和（扣除午休/加班晚餐），仅分母不同；与「详情弹窗」月度统计口径一致
                </span>
              </span>
            </div>
            <div class="desc-item">
              <span class="desc-label">平均 / 总工时</span>
              <span class="desc-value">
                <strong>该切换仅影响部门 / 分组的聚合方式：</strong><br />
                <strong>人员行</strong>始终展示本人的「有效工时 / 实际工时」两列取值，不随切换变化。<br />
                <strong>部门平均 =</strong> 部门内每人「有效工时 / 实际工时」取值相加 ÷ 部门人数<br />
                <strong>部门总工时 =</strong> 部门内每人「有效工时 / 实际工时」取值相加
              </span>
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
              <span class="desc-value">详情中「请假」列为当天是否有<strong>请假审批</strong>的标识状态（不代表当天全天请假）；同时请假区间会折算为当月<strong>请假天数</strong>，参与「实际出勤天数」与「实际工时」的计算（当月「当日有效工时」总和 ÷ 实际出勤天数）</span>
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

        <!-- 历史数据采集范围提示（醒目） -->
        <el-alert
          type="warning"
          :closable="false"
          show-icon
          class="history-range-alert"
          title="历史数据采集限制（仅早期补数阶段）"
        >
          <template #default>
            后续系统<strong>每日自动采集</strong>，新数据不受影响；仅在早期补数阶段，受钉钉接口限制无法采集更早历史数据：
            <strong>打卡记录</strong>近 6 个月（约 180 天）、<strong>加班审批</strong>近 365 天（单次 120 天）、
            <strong>请假信息</strong>近 180 天。补数时按时间窗口分段循环请求，避免漏数据。
          </template>
        </el-alert>

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
                :disabled-date="disabledMonth"
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
              align="center"
            >
              <el-table-column
                label="有效工时"
                width="90"
                align="center"
                sortable
                :sort-method="(a: any, b: any) => Number(cellValue(a, month, 'effective')) - Number(cellValue(b, month, 'effective'))"
              >
                <template #default="{ row }">
                  {{ formatHours(cellValue(row, month, "effective")) }}
                </template>
              </el-table-column>
              <el-table-column
                label="实际工时"
                width="90"
                align="center"
                sortable
                :sort-method="(a: any, b: any) => Number(cellValue(a, month, 'actual')) - Number(cellValue(b, month, 'actual'))"
              >
                <template #default="{ row }">
                  {{ formatHours(cellValue(row, month, "actual")) }}
                </template>
              </el-table-column>
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
          <span class="legend-text">当天有请假审批（标识，不代表全天请假），请假区间会折算为月请假天数，参与实际出勤天数与实际工时计算</span>
        </span>
        <span class="legend-tip">
          <span class="tip-title">统计口径（与汇总月度统计一致）：</span>
          <span class="tip-line">当日有效工时＝ 打卡工时 − 午休 − 加班晚餐（单日口径）</span>
          <span class="tip-line">有效工时（小时）＝ 当月「当日有效工时」总和 ÷ <strong>应出勤天数</strong></span>
          <span class="tip-line">实际工时（小时）＝ 当月「当日有效工时」总和 ÷ <strong>实际出勤天数</strong>（应出勤 - 请假）</span>
          <span class="tip-line tip-note">总工时（小时）＝ 当月「当日有效工时」之和，非打卡原始时长</span>
          <span class="tip-line tip-note">特殊情况：全天请假（扣除满 1 天）当日有效工时按 <strong>0 小时</strong>计；上下班均未打卡默认按 <strong>8 小时</strong>计</span>
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
          <div class="stat-label">应出勤天数</div>
          <div class="stat-value">{{ detailMonthStats.scheduledDays }} 天</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-label">实际出勤天数</div>
          <div class="stat-value">{{ formatAttendanceDays(detailMonthStats.actualAttendanceDays) }} 天</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-label">有效工时（小时）</div>
          <div class="stat-value">{{ formatHours(detailMonthStats.avgHours) }}</div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <div class="stat-label">实际工时（小时）</div>
          <div class="stat-value">{{ formatHours(detailMonthStats.actualAvgHours) }}</div>
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
        <el-table-column label="请假" width="140" align="center">
          <template #default="{ row }">
            <span :class="{ 'text-leave': row.leave }">
              {{ row.leave ? "请假" : "-" }}
              <template v-if="row.leave && calcDayLeaveDays(row) > 0">
                （扣 {{ formatLeaveDays(calcDayLeaveDays(row)) }} 天）
              </template>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="当日有效工时" width="90" align="center">
          <template #default="{ row }">
            {{ formatHours(calcEffectiveHours(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="打卡工时" width="80" align="center">
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
      align-items: flex-start;
      padding: 8px 0;
      font-size: 13px;
      line-height: 1.7;

      .desc-label {
        flex-shrink: 0;
        min-width: 92px;
        padding-right: 18px;
        white-space: nowrap;
        color: #909399;
        font-weight: 500;
      }

      .desc-value {
        flex: 1;
        color: #606266;
        text-align: justify;
      }

      &.desc-highlight {
        background: linear-gradient(
          90deg,
          rgba(64, 158, 255, 0.08),
          rgba(64, 158, 255, 0.02)
        );
        border: 1px solid #d7e8ff;
        border-left: 3px solid #409eff;
        border-radius: 4px;
        padding: 10px 14px;
        margin: 8px 0;

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
.history-range-alert {
  margin-bottom: 16px;
  border-radius: 8px;

  :deep(.el-alert__content) p {
    line-height: 1.7;
    margin: 0;
  }
}

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
    width: 100%;
    font-size: 12px;
    line-height: 1.8;
    color: #909399;
    margin-top: 2px;
    padding: 8px 10px;
    background: #f7f8fa;
    border-radius: 6px;

    .tip-title {
      display: block;
      font-weight: 600;
      color: #606266;
      margin-bottom: 2px;
    }

    .tip-line {
      display: block;
    }

    .tip-note {
      color: #a8abb2;
      margin-top: 2px;
    }
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
