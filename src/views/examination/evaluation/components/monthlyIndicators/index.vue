<script lang="ts" setup>
import { ref, onMounted, nextTick } from "vue";
import {
  getPmKpiMonthMetricTargetPage,
  updatePmKpiMonthMetricTargetApi,
  execSqlByUserId,
  execSqlByMonth,
  getDingAllDepartmentUsersApi,
  getUserListApi,
  notifyUserApi
} from "@/api/evaluation";
import { processAndExportMonthlyMetricForHR } from "@/views/examination/utils/exportMonthlyMetricForHR";
import { ElMessage, ElMessageBox } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

interface OtherConfig {
  calculationType?: number;
  notifyUserList?: Array<number | string>;
}

interface MetricTargetItem {
  id: number | string;
  metricUserId?: number | string;
  month: string;
  targetName: string;
  target: number | string;
  achieved: number | string;
  nodeId: number | string;
  nodeName: string;
  treePath: string;
  treePathName: string;
  status?: number;
  existSqlConfig?: number;
  otherConfig?: string | null;
}

interface RecordItem extends MetricTargetItem {
  userId?: number | string;
  jobNum?: string;
  username: string;
  metricTargetList?: MetricTargetItem[];
  rowSpan?: number;
  groupIndex?: number;
}

interface ApiRecordItem {
  userId: number | string;
  jobNum?: string;
  username: string;
  metricTargetList?: MetricTargetItem[];
  month: string;
}

interface ApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: ApiRecordItem[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
}

interface DingDepartmentUser {
  leader: boolean;
  name: string;
  userid: string;
  job_number?: string;
  dept_id_list?: number[];
}

interface DingDepartmentUsersResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    list: DingDepartmentUser[];
    has_more: boolean;
  };
}

const loading = ref(false);
const tableData = ref<RecordItem[]>([]);
const allRecords = ref<ApiRecordItem[]>([]);
const visibleRecords = ref<ApiRecordItem[]>([]);
const visibleUsernameSet = ref<Set<string> | null>(new Set());
let visibleUsernameSetPromise: Promise<Set<string> | null> | null = null;
const userList = ref<any[]>([]);
const userLoading = ref(false);
const total = ref(0);

// 从localStorage读取分页状态
const STORAGE_KEY = "monthly-indicators-pagination";
const savedPagination = localStorage.getItem(STORAGE_KEY);
const initialPagination = savedPagination ? JSON.parse(savedPagination) : { currentPage: 1, pageSize: 5 };
const currentPage = ref(initialPagination.currentPage);
const pageSize = ref(initialPagination.pageSize);
const ALL_PAGE_SIZE = 99999;
const DEVELOPER_USER_IDS = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1926449443739601629", // 杨世豪
  "1869635118983348225", // 肖嘉玲
  "1870023775338692610" // 任琪琳
];
const MANUAL_VISIBLE_USERNAME_MAP: Record<string, string[]> = {
  邓苏: ["王永蝶", "夏立明", "潘明旺", "缪欣瑶"],
  孙舒欣: ["孙舒欣"],
  方云: ["侯子洋", "王琳"],
  付阳: ["黄文豪"],
  范振吉: ["邓苏", "孙舒欣"]
};
const DEPARTMENT_LIST = [
  { name: "零食", deptId: 992836831 },
  { name: "天猫业务单元", deptId: 854017879 },
  { name: "京东业务单元", deptId: 854710068 },
  { name: "运营支持", deptId: 1062696513 },
  { name: "抖音电商组", deptId: 854033863 },
  { name: "内容创作运营支持组", deptId: 1062707956 },
  { name: "销售一组", deptId: 854405501 },
  { name: "销售二组", deptId: 854421521 },
  { name: "销售三组", deptId: 1062713961 },
  { name: "销售管理部", deptId: 1062560603 },
  { name: "好适佳项目组", deptId: 1063100245 }
];
const editingCell = ref<{
  rowId: number | string;
  field: "target" | "achieved";
} | null>(null);
const editingValue = ref<string | number | undefined>();
const savingCellKey = ref("");
const updatingUserId = ref<string | null>(null);
// 批量更新相关
const batchUpdating = ref(false);
const execResultDialogVisible = ref(false);
const execResult = ref<{
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  execDetails?: Array<{
    username?: string;
    jobNum?: string;
    status?: string;
    failReason?: string;
    metricCount?: number;
  }>;
}>({});

const isUpdating = (userId: string | number) => {
  return updatingUserId.value === String(userId);
};

const getDefaultMonth = () =>
  dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD");

// 搜索条件
const searchParams = ref({
  username: "",
  treePathName: "",
  startDate: getDefaultMonth(),
  dataType: "" // ""全部/ "manual"手填/ "auto"自动计算
});

// 判断是否为手填数据：existSqlConfig为0就是手填，1是服务端计算
const isManualRow = (row: RecordItem): boolean => {
  return row.existSqlConfig === 0;
};

// 表格单元格样式
const tableCellStyle = ({ row, columnIndex }: { row: RecordItem; columnIndex: number }) => {
  // 只有指标名称(3)、目标值(4)、完成值(5)、完成率(6)这几列在手填数据行显示黄色背景
  const shouldColor = isManualRow(row) && [3, 4, 5, 6].includes(columnIndex);
  const bgColor = shouldColor ? "#fff3cd" : "#ffffff";
  return {
    backgroundColor: bgColor,
    "--el-table-cell-hover-bg-color": bgColor
  };
};

const queryUserSuggestions = (queryString: string, cb: any) => {
  let results = queryString
    ? userList.value.filter((user: any) =>
        user.username.toLowerCase().includes(queryString.toLowerCase())
      )
    : userList.value;
  cb(results.map((user: any) => ({ value: user.username })));
};

const fetchUserList = async () => {
  if (userList.value.length || userLoading.value) return;
  userLoading.value = true;
  try {
    const res = (await getUserListApi({ name: "" })) as any;
    if (res?.success && Array.isArray(res.data)) {
      userList.value = res.data.sort((a: any, b: any) =>
        (a.username || "").localeCompare(b.username || "", "zh-CN")
      );
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
  } finally {
    userLoading.value = false;
  }
};

const getCurrentUserInfo = () => {
  try {
    return JSON.parse(localStorage.getItem("user-check-info") || "{}");
  } catch (error) {
    console.error("读取当前登录用户失败", error);
    return {};
  }
};

const getCurrentUsername = () => {
  const userInfo = getCurrentUserInfo();
  return String(userInfo?.username || userInfo?.name || "").trim();
};

const getCurrentUserIds = () => {
  const userInfo = getCurrentUserInfo();
  return [userInfo?.userid, userInfo?.userId, userInfo?.id]
    .filter(Boolean)
    .map((id: string | number) => String(id).trim())
    .filter(Boolean);
};

const isDeveloper = () =>
  getCurrentUserIds().some(userId => DEVELOPER_USER_IDS.includes(userId));

const fetchVisibleUsernameSet = async () => {
  if (isDeveloper()) return null;

  const currentUsername = getCurrentUsername();
  if (!currentUsername) return new Set<string>();

  const responses = (await Promise.all(
    DEPARTMENT_LIST.map(dept =>
      getDingAllDepartmentUsersApi({ deptId: dept.deptId }).catch(error => {
        console.error(`获取${dept.name}部门用户失败`, error);
        return null;
      })
    )
  )) as Array<DingDepartmentUsersResponse | null>;

  const usernameSet = new Set<string>(
    MANUAL_VISIBLE_USERNAME_MAP[currentUsername] || []
  );

  responses.forEach(res => {
    if (!res?.success || !res.data?.list?.length) return;

    const currentUser = res.data.list.find(
      user => String(user.name || "").trim() === currentUsername
    );
    if (currentUser?.leader) {
      res.data.list.forEach(user => {
        const username = String(user.name || "").trim();
        if (username) usernameSet.add(username);
      });
    }
  });

  return usernameSet;
};

const getVisibleUsernameSet = () => {
  if (!visibleUsernameSetPromise) {
    visibleUsernameSetPromise = fetchVisibleUsernameSet().then(usernameSet => {
      visibleUsernameSet.value = usernameSet;
      return usernameSet;
    });
  }
  return visibleUsernameSetPromise;
};

const flattenRecords = (records: ApiRecordItem[]) => {
  const flatRecords: RecordItem[] = [];
  for (const record of records) {
    const userInfo = {
      userId: record.userId,
      jobNum: record.jobNum,
      username: record.username,
      month: record.month
    };
    // 过滤掉 status 为 0 的指标
    const filteredMetrics = (record.metricTargetList || []).filter(
      metric => metric.status !== 0
    );
    if (filteredMetrics.length > 0) {
      for (let i = 0; i < filteredMetrics.length; i++) {
        const metric = filteredMetrics[i];
        flatRecords.push({
          ...userInfo,
          ...metric,
          // 确保 target 和 achieved 以适当的格式存储
          target: metric.target,
          achieved: metric.achieved,
          rowSpan: i === 0 ? filteredMetrics.length : 0,
          groupIndex: i
        });
      }
    }
  }
  return flatRecords;
};

const updateTableDataByPage = () => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  tableData.value = flattenRecords(visibleRecords.value.slice(start, end));
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiMonthMetricTargetPage({
      username: searchParams.value.username || undefined,
      treePathName: searchParams.value.treePathName || undefined,
      startDate: searchParams.value.startDate || undefined,
      endDate: searchParams.value.startDate || undefined,
      pageNo: 1,
      pageSize: ALL_PAGE_SIZE
    })) as ApiResponse;
    if (res.success && res.data) {
      const usernameSet = await getVisibleUsernameSet();
      // 指标全部请求回来，先按部门负责人权限过滤，再由前端按人员维度分页
      allRecords.value = (res.data.records || []).filter(record =>
        (record.metricTargetList || []).some(metric => metric.status !== 0)
      );

      // 先按权限过滤
      let filteredByPermission = usernameSet
        ? allRecords.value.filter(record =>
            usernameSet.has(String(record.username || "").trim())
          )
        : allRecords.value;

      // 再根据数据类型过滤
      visibleRecords.value = filteredByPermission.map(record => {
        // 过滤符合dataType条件的metric
        let filteredMetrics = (record.metricTargetList || []).filter(metric => {
          if (metric.status === 0) return false;

          if (searchParams.value.dataType === "manual") {
            return metric.existSqlConfig === 0;
          } else if (searchParams.value.dataType === "auto") {
            return metric.existSqlConfig === 1;
          }
          return true; // 全部类型
        });

        // 当选择手填类型时，完成值为空的数据放上面
        if (searchParams.value.dataType === "manual") {
          filteredMetrics.sort((a, b) => {
            const aEmpty = a.achieved == null || a.achieved === '' || a.achieved === 0;
            const bEmpty = b.achieved == null || b.achieved === '' || b.achieved === 0;
            if (aEmpty && !bEmpty) return -1;
            if (!aEmpty && bEmpty) return 1;
            return 0;
          });
        }

        return {
          ...record,
          metricTargetList: filteredMetrics
        };
      }).filter(record => (record.metricTargetList || []).length > 0); // 过滤掉没有有效指标的记录

      total.value = visibleRecords.value.length;
      updateTableDataByPage();
    }
  } catch (error) {
    console.error("获取月度指标数据失败", error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchData();
};

const handleReset = () => {
  searchParams.value = {
    username: "",
    treePathName: "",
    startDate: getDefaultMonth(),
    dataType: ""
  };
  currentPage.value = 1;
  fetchData();
};

// 保存分页状态到localStorage
const savePaginationState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    currentPage: currentPage.value,
    pageSize: pageSize.value
  }));
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  savePaginationState();
  updateTableDataByPage();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  savePaginationState();
  updateTableDataByPage();
};

const handleUpdateMetricData = async (row: RecordItem) => {
  try {
    await ElMessageBox.confirm(
      `确定更新用户「${row.username}」的指标数据吗？`,
      "更新确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    if (!row.userId) return;
    updatingUserId.value = String(row.userId);
    const res = (await execSqlByUserId({ userId: row.userId })) as any;
    if (res?.code === 200 || res?.success) {
      ElMessage.success("更新指标数据成功");
      fetchData();
    } else {
      ElMessage.error(res?.msg || "更新指标数据失败");
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      console.error("更新指标数据失败", error);
      ElMessage.error("更新指标数据失败");
    }
  } finally {
    updatingUserId.value = null;
  }
};

const handleNotifyUser = async (row: RecordItem) => {
  try {
    await ElMessageBox.confirm(
      `确定通知用户「${row.username}」填写指标信息吗？`,
      "通知确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    if (!row.id) return;
    const res = (await notifyUserApi({ id: Number(row.id) })) as any;
    if (res?.code === 200 || res?.success) {
      ElMessage.success("通知成功");
    } else {
      ElMessage.error(res?.msg || "通知失败");
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      console.error("通知用户失败", error);
      ElMessage.error("通知用户失败");
    }
  }
};

const handleBatchUpdateMetricData = async () => {
  try {
    const selectedMonth = searchParams.value.startDate;
    if (!selectedMonth) {
      ElMessage.warning("请先选择月份");
      return;
    }

    await ElMessageBox.confirm(
      `确定批量更新「${formatMonth(selectedMonth)}」的指标数据吗？`,
      "批量更新确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );

    batchUpdating.value = true;
    const formattedMonth = dayjs(selectedMonth).format("YYYY-MM");
    const res = (await execSqlByMonth({ month: formattedMonth })) as any;
    if (res?.code === 200 || res?.success) {
      execResult.value = res.data || {};
      execResultDialogVisible.value = true;
      fetchData();
    } else {
      ElMessage.error(res?.msg || "批量更新指标数据失败");
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      console.error("批量更新指标数据失败", error);
      ElMessage.error("批量更新指标数据失败");
    }
  } finally {
    batchUpdating.value = false;
  }
};

// 合并单元格
const objectSpanMethod = ({
  row,
  columnIndex
}: {
  row: RecordItem;
  columnIndex: number;
}) => {
  // 合并公共信息列：序号(0)、月份(1)、负责人(2)、操作列(最后一列)
  if (columnIndex <= 2 || columnIndex === 7) {
    if (row.rowSpan && row.rowSpan > 0) {
      return { rowspan: row.rowSpan, colspan: 1 };
    }
    return { rowspan: 0, colspan: 0 };
  }
};

// 获取分组序号
const getGroupIndex = (index: number) => {
  const pageOffset = (currentPage.value - 1) * pageSize.value;
  const currentPageGroupIndex = tableData.value
    .slice(0, index + 1)
    .filter(item => item.groupIndex === 0).length;
  return pageOffset + currentPageGroupIndex;
};

const getCellKey = (row: RecordItem, field: "target" | "achieved") => {
  return `${row.id}-${field}`;
};

const isEditing = (row: RecordItem, field: "target" | "achieved") => {
  return (
    editingCell.value?.rowId === row.id && editingCell.value?.field === field
  );
};

const isSaving = (row: RecordItem, field: "target" | "achieved") => {
  return savingCellKey.value === getCellKey(row, field);
};

const startEdit = async (row: RecordItem, field: "target" | "achieved") => {
  if (savingCellKey.value) return;
  // 只有手填数据才可以编辑
  if (!isManualRow(row)) {
    ElMessage.warning("只有手填数据才可以修改");
    return;
  }
  editingCell.value = {
    rowId: row.id,
    field
  };
  // 确保编辑时使用正确的字符串格式
  editingValue.value = row[field] != null ? String(row[field]) : "";
  await nextTick();
  const input = document.querySelector(
    `.editable-cell-input-${row.id}-${field} input`
  ) as HTMLInputElement | null;
  input?.focus();
  input?.select();
};

// 验证输入是否为有效数字，最多4位小数
const validateNumberInput = (value: string): boolean => {
  if (!value || value === "") return true; // 允许空值，后续会处理
  // 正则表达式：允许整数或小数，小数最多4位
  const regex = /^-?\d+(\.\d{0,4})?$/;
  return regex.test(value);
};

const cancelEdit = () => {
  editingCell.value = null;
  editingValue.value = undefined;
};

const handleEditKeydown = (
  event: KeyboardEvent | Event,
  row: RecordItem,
  field: "target" | "achieved"
) => {
  // 类型守卫，确保是 KeyboardEvent
  if ("key" in event) {
    if (event.key === "Enter") {
      confirmEdit(row, field);
    }
    if (event.key === "Escape") {
      cancelEdit();
    }
  }
};

const confirmEdit = async (row: RecordItem, field: "target" | "achieved") => {
  if (!isEditing(row, field)) return;
  // 只有手填数据才可以编辑
  if (!isManualRow(row)) {
    ElMessage.warning("只有手填数据才可以修改");
    cancelEdit();
    return;
  }

  const newValue = editingValue.value;
  const oldValue = row[field];

  // 验证输入
  if (newValue === undefined || newValue === null || newValue === "") {
    ElMessage.warning("请输入有效数值");
    return;
  }

  if (!validateNumberInput(String(newValue))) {
    ElMessage.warning("请输入有效数值，最多保留4位小数");
    return;
  }

  const numValue = Number(newValue);
  if (Number.isNaN(numValue)) {
    ElMessage.warning("请输入有效数值");
    return;
  }

  // 格式化新值，保留用户输入的格式（最多4位小数）
  const formattedNewValue = preserveDecimalPlaces(newValue);

  // 比较数值是否相等（不比较格式）
  if (Number(formattedNewValue) === Number(oldValue)) {
    cancelEdit();
    return;
  }

  if (!row.userId) {
    ElMessage.error("缺少用户ID，无法保存");
    return;
  }

  const metricUserId = row.metricUserId ?? row.id;
  savingCellKey.value = getCellKey(row, field);
  try {
    const res = (await updatePmKpiMonthMetricTargetApi({
      id: row.id,
      userId: row.userId,
      metricUserId: metricUserId,
      month: row.month,
      targetName: row.targetName,
      nodeId: row.nodeId,
      nodeName: row.nodeName,
      treePath: row.treePath,
      treePathName: row.treePathName,
      target: Number(row.target),
      achieved: Number(row.achieved),
      [field]: numValue
    })) as { success: boolean; msg?: string };

    if (res.success) {
      // 保存为字符串以保持格式
      row[field] = formattedNewValue;
      ElMessage.success("保存成功");
      cancelEdit();
      fetchData();
    } else {
      ElMessage.error(res.msg || "保存失败");
    }
  } catch (error) {
    console.error("保存月度指标目标失败", error);
    ElMessage.error("保存失败");
  } finally {
    savingCellKey.value = "";
  }
};

// 计算完成率
const getCompletionRate = (
  target: number | string,
  achieved: number | string
) => {
  const targetNum = Number(target);
  const achievedNum = Number(achieved);
  if (!targetNum || targetNum === 0) return "-";
  const rate = (achievedNum / targetNum) * 100;
  return rate.toFixed(2) + "%";
};

// 根据完成率返回样式
const getRateClass = (target: number | string, achieved: number | string) => {
  const targetNum = Number(target);
  const achievedNum = Number(achieved);
  if (!targetNum || targetNum === 0) return "";
  const rate = achievedNum / targetNum;
  if (rate >= 1) return "rate-excellent";
  if (rate >= 0.8) return "rate-good";
  return "rate-poor";
};

// 格式化月份
const formatMonth = (dateStr: string) => {
  if (!dateStr) return "-";
  return dayjs(dateStr).format("YYYY-MM");
};

// 格式化数字，保留用户输入的小数位数，最多4位
const formatNumber = (num: number | string) => {
  if (num == null || num === "") return "-";
  // 如果是字符串，直接返回（保持原始格式）
  if (typeof num === "string") {
    // 验证是否是有效数字
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return "-";
    return num;
  }
  // 如果是数字，转换为字符串保持其格式
  return String(num);
};

// 保留小数位数，最多4位
const preserveDecimalPlaces = (num: number | string): string => {
  if (num == null || num === "") return "";
  const str = String(num);
  // 检查是否包含小数点
  if (str.includes(".")) {
    const parts = str.split(".");
    // 限制小数位数最多4位
    if (parts[1].length > 4) {
      return parts[0] + "." + parts[1].slice(0, 4);
    }
    return str;
  }
  return str;
};

// 导出Excel功能
const handleExport = () => {
  if (visibleRecords.value.length === 0) {
    ElMessage.warning("暂无数据可导出");
    return;
  }

  // 准备导出数据
  const exportData: any[] = [];

  // 遍历所有可见记录，展开为二维表格数据
  visibleRecords.value.forEach((record, recordIndex) => {
    const filteredMetrics = (record.metricTargetList || []).filter(
      metric => metric.status !== 0
    );

    filteredMetrics.forEach((metric, metricIndex) => {
      const row: any = {
        "序号": "",
        "月份": "",
        "负责人": "",
        "指标名称": metric.targetName,
        "目标值": formatNumber(metric.target),
        "完成值": formatNumber(metric.achieved),
        "完成率": getCompletionRate(metric.target, metric.achieved),
        "数据类型": metric.existSqlConfig === 0 ? "手填" : "自动计算",
        "组织路径": metric.treePathName || ""
      };

      // 只有第一个指标行显示序号、月份、负责人
      if (metricIndex === 0) {
        row["序号"] = recordIndex + 1;
        row["月份"] = formatMonth(record.month);
        row["负责人"] = record.username;
      }

      exportData.push(row);
    });
  });

  // 创建工作簿
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "月度指标");

  // 设置列宽
  worksheet["!cols"] = [
    { wch: 8 },  // 序号
    { wch: 12 }, // 月份
    { wch: 12 }, // 负责人
    { wch: 30 }, // 指标名称
    { wch: 15 }, // 目标值
    { wch: 15 }, // 完成值
    { wch: 12 }, // 完成率
    { wch: 12 }, // 数据类型
    { wch: 30 }  // 组织路径
  ];

  // 导出文件
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  const fileName = `月度指标_${formatMonth(searchParams.value.startDate) || dayjs().format("YYYY-MM")}_${dayjs().format("YYYYMMDDHHmmss")}.xlsx`;
  saveAs(blob, fileName);

  ElMessage.success("导出成功");
};

const hrExportLoading = ref(false);
const handleExportForHR = async () => {
  try {
    hrExportLoading.value = true;
    await processAndExportMonthlyMetricForHR();
    ElMessage.success("人事导出成功");
  } catch (error) {
    console.error("人事导出失败:", error);
    ElMessage.error("人事导出失败，请查看控制台日志");
  } finally {
    hrExportLoading.value = false;
  }
};

onMounted(() => {
  fetchData();
  fetchUserList();
});
</script>

<template>
  <div class="monthly-indicators-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form :model="searchParams" inline size="default">
        <el-form-item label="负责人">
          <el-autocomplete
            v-model="searchParams.username"
            :fetch-suggestions="queryUserSuggestions"
            placeholder="请输入负责人"
            clearable
            style="width: 200px"
            :trigger-on-focus="true"
          />
        </el-form-item>
        <el-form-item label="组织路径">
          <el-input
            v-model="searchParams.treePathName"
            placeholder="请输入组织路径"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="月度">
          <el-date-picker
            v-model="searchParams.startDate"
            type="month"
            placeholder="选择月度"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="数据类型">
          <el-select
            v-model="searchParams.dataType"
            placeholder="请选择数据类型"
            clearable
            style="width: 200px"
          >
            <el-option label="手填类型" value="manual" />
            <el-option label="自动计算类型" value="auto" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button
            type="success"
            :loading="batchUpdating"
            @click="handleBatchUpdateMetricData"
          >
            批量更新指标数据
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <div class="table-actions">
        <div class="table-tip">
          <el-tag size="small" type="warning" effect="light">提示</el-tag>
          <span class="tip-text">黄色背景行为手填数据</span>
        </div>
        <div class="export-buttons">
          <el-button
            class="excel-export-btn"
            :loading="hrExportLoading"
            @click="handleExportForHR"
          >
            <el-icon><Download /></el-icon>
            人事导出
          </el-button>
          <el-button
            class="excel-export-btn"
            @click="handleExport"
          >
            <el-icon><Download /></el-icon>
            导出
          </el-button>
        </div>
      </div>
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        style="width: 100%"
        :span-method="objectSpanMethod"
        :cell-style="tableCellStyle"
      >
        <el-table-column label="序号" width="60" align="center">
          <template #default="{ $index }">
            {{ getGroupIndex($index) }}
          </template>
        </el-table-column>
        <el-table-column prop="month" label="月份" width="120" align="center">
          <template #default="{ row }">
            {{ row.groupIndex === 0 ? formatMonth(row.month) : "" }}
          </template>
        </el-table-column>
        <el-table-column
          prop="username"
          label="负责人"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            {{ row.groupIndex === 0 ? row.username : "" }}
          </template>
        </el-table-column>
        <el-table-column
          prop="targetName"
          label="指标名称"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column prop="target" label="目标值" width="160" align="right">
          <template #default="{ row }">
            <el-input
              v-if="isEditing(row, 'target')"
              v-model="editingValue"
              :class="`editable-cell-input-${row.id}-target`"
              style="width: 120px"
              @blur="confirmEdit(row, 'target')"
              @keydown="handleEditKeydown($event, row, 'target')"
            />
            <span
              v-else
              v-loading="isSaving(row, 'target')"
              class="editable-cell"
              :class="{ 'editable-cell-disabled': !isManualRow(row) }"
              :title="isManualRow(row) ? '双击修改' : '不可编辑'"
              @dblclick="isManualRow(row) ? startEdit(row, 'target') : undefined"
            >
              {{ formatNumber(row.target) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="achieved"
          label="完成值"
          width="160"
          align="right"
        >
          <template #default="{ row }">
            <el-input
              v-if="isEditing(row, 'achieved')"
              v-model="editingValue"
              :class="`editable-cell-input-${row.id}-achieved`"
              style="width: 120px"
              @blur="confirmEdit(row, 'achieved')"
              @keydown="handleEditKeydown($event, row, 'achieved')"
            />
            <span
              v-else
              v-loading="isSaving(row, 'achieved')"
              class="editable-cell"
              :class="{ 'editable-cell-disabled': !isManualRow(row) }"
              :title="isManualRow(row) ? '双击修改' : '不可编辑'"
              @dblclick="isManualRow(row) ? startEdit(row, 'achieved') : undefined"
            >
              {{ formatNumber(row.achieved) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="完成率" width="140" align="center">
          <template #default="{ row }">
            <span :class="getRateClass(row.target, row.achieved)">
              {{ getCompletionRate(row.target, row.achieved) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="220" align="center">
          <template #default="{ row }">
            <template v-if="row.groupIndex === 0">
              <el-button
                type="success"
                size="small"
                :loading="isUpdating(row.userId || '')"
                @click="handleUpdateMetricData(row)"
              >
                更新指标数据
              </el-button>
              <el-button
                class="dingtalk-blue-btn"
                size="small"
                @click="handleNotifyUser(row)"
              >
                通知
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- 执行结果对话框 -->
    <el-dialog
      v-model="execResultDialogVisible"
      title="批量更新结果"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="result-summary">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="总用户数">
            <span class="total-count">{{ execResult.totalCount || 0 }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="成功数量">
            <span class="success-count">{{
              execResult.successCount || 0
            }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="失败数量">
            <span class="fail-count">{{ execResult.failCount || 0 }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <div class="result-details" v-if="execResult.execDetails?.length">
        <el-table :data="execResult.execDetails" border stripe max-height="400">
          <el-table-column prop="username" label="用户名" width="120" />
          <el-table-column prop="jobNum" label="工号" width="120" />
          <el-table-column
            prop="metricCount"
            label="执行指标数"
            width="100"
            align="center"
          />
          <el-table-column label="执行状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.status === 'success' ? 'success' : 'danger'">
                {{ row.status === "success" ? "成功" : "失败" }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="failReason"
            label="失败原因"
            show-overflow-tooltip
          />
        </el-table>
      </div>

      <template #footer>
        <el-button type="primary" @click="execResultDialogVisible = false"
          >关闭</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.monthly-indicators-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-summary {
  margin-bottom: 20px;
}

.result-summary :deep(.el-descriptions__label) {
  background-color: #f5f7fa;
  font-weight: 500;
}

.total-count {
  font-weight: 600;
  color: #303133;
}

.success-count {
  font-weight: 600;
  color: #67c23a;
}

.fail-count {
  font-weight: 600;
  color: #f56c6c;
}

.result-details {
  margin-top: 20px;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.export-buttons {
  display: flex;
  gap: 12px;
}

.table-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
}

.tip-text {
  font-size: 14px;
  color: #e6a23c;
}

.excel-export-btn {
  background-color: #217346;
  border-color: #217346;
  color: #ffffff;
}

.excel-export-btn:hover {
  background-color: #1e6b3e;
  border-color: #1e6b3e;
  color: #ffffff;
}

.dingtalk-blue-btn {
  background-color: #0089ff;
  border-color: #0089ff;
  color: #ffffff;
}

.dingtalk-blue-btn:hover {
  background-color: #006ec7;
  border-color: #006ec7;
  color: #ffffff;
}

.search-section {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
}

.search-section :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.search-section :deep(.el-form-item) {
  margin-bottom: 0;
}

.search-section :deep(.el-form-item:last-child) {
  margin-left: auto;
}

.table-section {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.editable-cell {
  display: inline-block;
  min-width: 80px;
  min-height: 24px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.editable-cell:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.editable-cell-disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.editable-cell-disabled:hover {
  background: transparent;
  color: inherit;
}

.rate-excellent {
  color: var(--el-color-success);
  font-weight: 600;
}

.rate-good {
  color: var(--el-color-warning);
  font-weight: 500;
}

.rate-poor {
  color: var(--el-color-danger);
  font-weight: 500;
}
</style>
