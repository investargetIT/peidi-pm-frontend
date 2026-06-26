<script lang="ts" setup>
import { ref, onMounted, nextTick, watch, h } from "vue";
import {
  getPmKpiMonthMetricTargetPage,
  updatePmKpiMonthMetricTargetApi,
  execSqlByUserId,
  execSqlByMonth,
  getDingAllDepartmentUsersApi,
  getUserListApi,
  notifyUserApi,
  notifyUserConfirmApi
} from "@/api/evaluation";
import { processAndExportMonthlyMetricForHR } from "@/views/examination/utils/exportMonthlyMetricForHR";
import { ElMessage, ElMessageBox, ElCheckbox } from "element-plus";
import { Download, Bell, CircleCheck, Warning } from "@element-plus/icons-vue";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { match } from "pinyin-pro";

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
// 注意：visibleRecords 是所有筛选后的数据（不受分页影响），导出和通知都用的是这个
const visibleRecords = ref<ApiRecordItem[]>([]);
const visibleUsernameSet = ref<Set<string> | null>(new Set());
let visibleUsernameSetPromise: Promise<Set<string> | null> | null = null;
const userList = ref<any[]>([]);
const userLoading = ref(false);
const total = ref(0);

// 从localStorage读取分页状态
const STORAGE_KEY = "monthly-indicators-pagination";
const savedPagination = localStorage.getItem(STORAGE_KEY);
const initialPagination = savedPagination
  ? JSON.parse(savedPagination)
  : { currentPage: 1, pageSize: 5 };
const currentPage = ref(initialPagination.currentPage);
const pageSize = ref(initialPagination.pageSize);
const ALL_PAGE_SIZE = 99999;
const DEVELOPER_USER_IDS = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1926449443739601629", // 杨世豪
  "1869635118983348225", // 肖嘉玲
  "1870023775338692610", // 任琪琳
  "1926449443739601538" // 王晓莹
];
const MANUAL_VISIBLE_USERNAME_MAP: Record<string, string[]> = {
  邓苏: ["王永蝶", "夏立明", "潘明旺", "缪欣瑶"],
  孙舒欣: ["孙舒欣"],
  方云: ["侯子洋", "王琳"],
  付阳: ["黄文豪"],
  范振吉: ["邓苏", "孙舒欣", "潘明旺"]
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
const tableCellStyle = ({
  row,
  columnIndex
}: {
  row: RecordItem;
  columnIndex: number;
}) => {
  // 目标值列(4)总是可以编辑，所以在手填数据行显示黄色背景，在自动计算行也可以有浅背景色
  // 完成值(5)、完成率(6)只在手填数据行显示黄色背景
  let bgColor = "#ffffff";
  if (isManualRow(row) && [3, 4, 5, 6].includes(columnIndex)) {
    bgColor = "#fff3cd";
  } else if (columnIndex === 4) {
    // 目标值列在自动计算数据行也显示一个浅灰色，表示可以编辑
    bgColor = "#f8f9fa";
  }
  return {
    backgroundColor: bgColor,
    "--el-table-cell-hover-bg-color": bgColor
  };
};

const queryUserSuggestions = (queryString: string, cb: any) => {
  let results = queryString
    ? userList.value.filter((user: any) => {
        const username = user.username || "";
        const lowerQuery = queryString.toLowerCase();

        // 直接匹配用户名
        if (username.toLowerCase().includes(lowerQuery)) {
          return true;
        }

        // 使用 pinyin-pro 的 match 函数进行拼音匹配
        try {
          const matchResult = match(username, lowerQuery);
          return matchResult && matchResult.length > 0;
        } catch (e) {
          console.error("拼音匹配错误:", e);
          return false;
        }
      })
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
      visibleRecords.value = filteredByPermission
        .map(record => {
          // 过滤符合dataType条件的metric
          let filteredMetrics = (record.metricTargetList || []).filter(
            metric => {
              if (metric.status === 0) return false;

              if (searchParams.value.dataType === "manual") {
                return metric.existSqlConfig === 0;
              } else if (
                searchParams.value.dataType === "manual_unfilled_achieved"
              ) {
                // 手填且完成值为空或0
                return (
                  metric.existSqlConfig === 0 &&
                  (metric.achieved == null ||
                    metric.achieved === "" ||
                    Number(metric.achieved) === 0)
                );
              } else if (
                searchParams.value.dataType === "manual_unfilled_target"
              ) {
                // 手填且目标值为空或0
                return (
                  metric.existSqlConfig === 0 &&
                  (metric.target == null ||
                    metric.target === "" ||
                    Number(metric.target) === 0)
                );
              } else if (searchParams.value.dataType === "auto") {
                return metric.existSqlConfig === 1;
              } else if (
                searchParams.value.dataType === "auto_unfilled_achieved"
              ) {
                // 自动计算且完成值为空或0
                return (
                  metric.existSqlConfig === 1 &&
                  (metric.achieved == null ||
                    metric.achieved === "" ||
                    Number(metric.achieved) === 0)
                );
              } else if (
                searchParams.value.dataType === "auto_unfilled_target"
              ) {
                // 自动计算且目标值为空或0
                return (
                  metric.existSqlConfig === 1 &&
                  (metric.target == null ||
                    metric.target === "" ||
                    Number(metric.target) === 0)
                );
              }
              return true; // 全部类型
            }
          );

          // 当选择手填类型时，完成值为空的数据放上面
          if (searchParams.value.dataType === "manual") {
            filteredMetrics.sort((a, b) => {
              const aEmpty =
                a.achieved == null || a.achieved === "" || a.achieved === 0;
              const bEmpty =
                b.achieved == null || b.achieved === "" || b.achieved === 0;
              if (aEmpty && !bEmpty) return -1;
              if (!aEmpty && bEmpty) return 1;
              return 0;
            });
          }

          return {
            ...record,
            metricTargetList: filteredMetrics
          };
        })
        .filter(record => (record.metricTargetList || []).length > 0); // 过滤掉没有有效指标的记录

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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      currentPage: currentPage.value,
      pageSize: pageSize.value
    })
  );
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

const confirmTodoNotify = async () => {
  if (!todoNotifyChecked.value) {
    ElMessage.warning("请先勾选确认发送钉钉待办");
    return;
  }
  if (!currentTodoRow.value?.id) return;

  try {
    todoNotifyLoading.value = true;
    todoNotifyDialogVisible.value = false;
    const res = (await notifyUserApi({ id: Number(currentTodoRow.value.id) })) as any;
    if (res?.code === 200 || res?.success) {
      ElMessage.success("通知成功");
    } else {
      ElMessage.error(res?.msg || "通知失败");
    }
  } catch (error) {
    console.error("通知用户失败", error);
    ElMessage.error("通知用户失败");
  } finally {
    todoNotifyLoading.value = false;
    currentTodoRow.value = null;
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
  // 目标值可以随时编辑，完成值只有手填数据才可以编辑
  if (field === "achieved" && !isManualRow(row)) {
    ElMessage.warning("只有手填数据的完成值才可以修改");
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
  // 目标值可以随时编辑，完成值只有手填数据才可以编辑
  if (field === "achieved" && !isManualRow(row)) {
    ElMessage.warning("只有手填数据的完成值才可以修改");
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

// 导出Excel功能 - 目标业绩表
// 导出当前年份1-12月的数据
const handleExport = async () => {
  if (!isDeveloper()) {
    ElMessage.warning("只有开发者可以导出");
    return;
  }

  try {
    exportLoading.value = true;
    // 获取当前年份
    const currentYear = dayjs(searchParams.value.startDate || new Date()).year();

    // 收集12个月的数据
    const allYearRecords: ApiRecordItem[] = [];

    // 循环请求12个月的数据
    for (let month = 1; month <= 12; month++) {
      const monthDate = dayjs(`${currentYear}-${month}-01`).format('YYYY-MM-DD');

      const res = (await getPmKpiMonthMetricTargetPage({
        username: searchParams.value.username || undefined,
        treePathName: searchParams.value.treePathName || undefined,
        startDate: monthDate,
        endDate: monthDate,
        pageNo: 1,
        pageSize: ALL_PAGE_SIZE
      })) as ApiResponse;

      if (res?.success && res?.data?.records?.length) {
        allYearRecords.push(...res.data.records);
      }
    }

    if (allYearRecords.length === 0) {
      ElMessage.warning("暂无数据可导出");
      return;
    }

    // 数据结构转换：按用户+指标分组，收集12个月的目标值
    interface TargetData {
      [month: string]: number | string;
    }

    interface RowData {
      department: string;
      assessmentGroup: string;
      targetName: string;
      username: string;
      monthlyTargets: TargetData;
      total: number;
    }

    const rowDataMap = new Map<string, RowData>();

    allYearRecords.forEach((record) => {
      const filteredMetrics = (record.metricTargetList || []).filter(
        metric => metric.status !== 0
      );

      filteredMetrics.forEach((metric) => {
        // 提取部门和考核组
        const treePathParts = (metric.treePathName || "").split(",").map(s => s.trim()).filter(Boolean);
        const department = treePathParts[1] || "";
        const assessmentGroup = treePathParts[treePathParts.length - 1] || "";

        // 唯一key：用户ID + 指标名称
        const key = `${record.userId}-${metric.targetName}`;

        // 获取月份（提取数字部分）
        const monthNum = dayjs(record.month).month() + 1; // 1-12

        if (!rowDataMap.has(key)) {
          rowDataMap.set(key, {
            department,
            assessmentGroup,
            targetName: metric.targetName || "",
            username: record.username || "",
            monthlyTargets: {},
            total: 0
          });
        }

        const rowData = rowDataMap.get(key)!;
        // 存储目标值
        rowData.monthlyTargets[monthNum.toString()] = metric.target ?? "";
      });
    });

    // 创建工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("目标业绩表");

    // 构建列配置
    const columns: any[] = [
      { key: "department", header: "部门", width: 20 },
      { key: "assessmentGroup", header: "考核组", width: 20 },
      { key: "targetName", header: "指标名称", width: 25 },
      { key: "username", header: "姓名", width: 12 }
    ];

    // 添加1-12月列
    for (let i = 1; i <= 12; i++) {
      columns.push({
        key: `month${i}`,
        header: `${i}月`,
        width: 12
      });
    }

    // 添加合计和备注列
    columns.push({ key: "total", header: "合计", width: 15 });
    columns.push({ key: "remark", header: "单位：万", width: 12 });

    worksheet.columns = columns;

    // 添加表头并设置样式
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
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
    });
    headerRow.height = 25;

    // 添加数据行
    let currentRow = 2;
    rowDataMap.forEach((rowData) => {
      // 计算合计
      let total = 0;
      const monthlyValues: (number | string)[] = [];
      for (let i = 1; i <= 12; i++) {
        const val = rowData.monthlyTargets[i.toString()];
        monthlyValues.push(val ?? "");
        if (val != null && val !== "" && !isNaN(Number(val))) {
          total += Number(val);
        }
      }

      const rowDataObj: any = {
        department: rowData.department,
        assessmentGroup: rowData.assessmentGroup,
        targetName: rowData.targetName,
        username: rowData.username
      };

      // 添加1-12月数据
      for (let i = 1; i <= 12; i++) {
        rowDataObj[`month${i}`] = monthlyValues[i - 1];
      }

      rowDataObj.total = total;
      rowDataObj.remark = ""; // 备注列留空

      const row = worksheet.addRow(rowDataObj);

      // 设置数据行样式
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };

        // 奇数行添加浅灰色背景
        if ((currentRow - 1) % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" }
          };
        }

        // 月份列和合计列右对齐
        if (colNumber > 4) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      });

      row.height = 20;
      currentRow++;
    });

    // 生成Excel文件
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const fileName = `目标业绩表_${currentYear}年_${dayjs().format("YYYYMMDDHHmmss")}.xlsx`;
    saveAs(blob, fileName);

    ElMessage.success("导出成功");
  } catch (error) {
    console.error("导出失败:", error);
    ElMessage.error("导出失败，请重试");
  } finally {
    exportLoading.value = false;
  }
};

const hrExportLoading = ref(false);
const exportLoading = ref(false);
const handleExportForHR = async () => {
  if (!isDeveloper()) {
    ElMessage.warning("只有开发者可以导出");
    return;
  }

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

const notifyConfirmLoading = ref(false);
const notifyConfirmDialogVisible = ref(false);
const confirmChecked = ref(false);
const todoNotifyDialogVisible = ref(false);
const todoNotifyChecked = ref(false);
const currentTodoRow = ref<RecordItem | null>(null);
const todoNotifyLoading = ref(false);

const handleNotifyUserConfirm = async () => {
  confirmChecked.value = false;
  notifyConfirmDialogVisible.value = true;
};

const handleNotifyUser = (row: RecordItem) => {
  currentTodoRow.value = row;
  todoNotifyChecked.value = false;
  todoNotifyDialogVisible.value = true;
};

const confirmNotify = async () => {
  if (!confirmChecked.value) {
    ElMessage.warning("请先勾选确认发送钉钉消息");
    return;
  }

  try {
    // 注意：通知的是 visibleRecords.value，即所有筛选后的数据，不受分页影响
    // 收集可见用户的 userId 和 month（去重）
    const userMonthSet = new Set<string>();
    const args: Array<{ userId: string; month: string }> = [];

    visibleRecords.value.forEach(record => {
      if (record.userId && record.month) {
        const key = `${record.userId}-${record.month}`;
        if (!userMonthSet.has(key)) {
          userMonthSet.add(key);
          args.push({
            userId: String(record.userId),
            month: record.month
          });
        }
      }
    });

    notifyConfirmLoading.value = true;
    notifyConfirmDialogVisible.value = false;
    const res = (await notifyUserConfirmApi({ args })) as any;
    if (res?.code === 200 || res?.success) {
      ElMessage.success("通知成功");
    } else {
      ElMessage.error(res?.msg || "通知失败");
    }
  } catch (error) {
    console.error("通知用户确认绩效失败:", error);
    ElMessage.error("通知用户确认绩效失败");
  } finally {
    notifyConfirmLoading.value = false;
  }
};

// 监听 startDate，确保始终有值
watch(
  () => searchParams.value.startDate,
  newVal => {
    if (!newVal) {
      searchParams.value.startDate = getDefaultMonth();
    }
  }
);

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
            :clearable="false"
          />
        </el-form-item>
        <el-form-item label="数据类型">
          <el-select
            v-model="searchParams.dataType"
            placeholder="请选择数据类型"
            clearable
            style="width: 220px"
          >
            <el-option label="手填类型" value="manual" />
            <el-option
              label="手填类型（未填写完成值）"
              value="manual_unfilled_achieved"
            />
            <el-option
              label="手填类型（未填写目标值）"
              value="manual_unfilled_target"
            />
            <el-option label="自动计算类型" value="auto" />
            <el-option
              label="自动计算类型（未填写完成值）"
              value="auto_unfilled_achieved"
            />
            <el-option
              label="自动计算类型（未填写目标值）"
              value="auto_unfilled_target"
            />
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
          <span class="tip-text"
            >黄色背景行为手填数据，浅灰色背景的目标值可随时编辑</span
          >
        </div>
        <div class="export-buttons">
          <template v-if="isDeveloper()">
            <el-button
              class="excel-export-btn"
              :loading="hrExportLoading"
              @click="handleExportForHR"
            >
              <el-icon><Download /></el-icon>
              人事导出
            </el-button>
            <el-tooltip content="导出选中月份所在年份1-12月的目标业绩表" placement="top">
              <el-button class="excel-export-btn" :loading="exportLoading" @click="handleExport">
                <el-icon><Download /></el-icon>
                导出目标业绩表
              </el-button>
            </el-tooltip>
          </template>
          <el-tooltip
            content="向当前可见用户发送钉钉消息，通知其确认绩效信息"
            placement="top"
          >
            <el-button
              type="primary"
              :loading="notifyConfirmLoading"
              @click="handleNotifyUserConfirm"
            >
              <el-icon><Bell /></el-icon>
              通知用户确认绩效信息
            </el-button>
          </el-tooltip>
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
              :title="'双击修改'"
              @dblclick="startEdit(row, 'target')"
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
              @dblclick="
                isManualRow(row) ? startEdit(row, 'achieved') : undefined
              "
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
        <el-table-column fixed="right" label="操作" width="280" align="center">
          <template #default="{ row }">
            <template v-if="row.groupIndex === 0">
              <div class="action-buttons">
                <el-button
                  type="success"
                  size="small"
                  :loading="isUpdating(row.userId || '')"
                  @click="handleUpdateMetricData(row)"
                >
                  更新指标数据
                </el-button>
                <el-tooltip content="提醒该负责人的填写人填写指标信息" placement="top">
                  <el-button
                    class="dingtalk-blue-btn"
                    size="small"
                    @click="handleNotifyUser(row)"
                  >
                    提醒填写
                  </el-button>
                </el-tooltip>
              </div>
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

    <!-- 通知确认对话框 -->
    <el-dialog
      v-model="notifyConfirmDialogVisible"
      title="确认通知"
      width="520px"
      :close-on-click-modal="false"
      class="notify-confirm-dialog"
    >
      <div class="notify-confirm-content">
        <div class="notify-icon">
          <el-icon :size="48" color="#409EFF"><Bell /></el-icon>
        </div>
        <div class="notify-info">
          <div class="notify-title">发送钉钉通知</div>
          <div class="notify-desc">即将向当前筛选条件下可见的用户发送绩效确认通知</div>
        </div>
      </div>
      <div class="notify-features">
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>向当前可见的所有用户发送钉钉消息</span>
        </div>
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>通知用户确认其绩效信息</span>
        </div>
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>仅通知当前筛选条件下可见的用户</span>
        </div>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="confirmChecked" size="large">我确认发送钉钉消息</el-checkbox>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="notifyConfirmDialogVisible = false">取消</el-button>
          <el-button type="primary" size="large" :loading="notifyConfirmLoading" :disabled="!confirmChecked" @click="confirmNotify">确定发送</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 发送钉钉待办确认对话框 -->
    <el-dialog
      v-model="todoNotifyDialogVisible"
      title="发送钉钉待办"
      width="520px"
      :close-on-click-modal="false"
      class="todo-notify-dialog"
    >
      <div class="notify-confirm-content">
        <div class="notify-icon">
          <el-icon :size="48" color="#0089FF"><Bell /></el-icon>
        </div>
        <div class="notify-info">
          <div class="notify-title">发送待办提醒</div>
          <div class="notify-desc">即将向「{{ currentTodoRow?.username }}」的填写人发送钉钉待办通知</div>
        </div>
      </div>
      <div class="notify-features">
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>提醒用户填写指标信息</span>
        </div>
        <div class="feature-item">
          <el-icon color="#E6A23C"><Warning /></el-icon>
          <span>24小时内只能发送一次</span>
        </div>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="todoNotifyChecked" size="large">我确认发送钉钉待办</el-checkbox>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="todoNotifyDialogVisible = false">取消</el-button>
          <el-button class="dingtalk-blue-btn" size="large" :loading="todoNotifyLoading" :disabled="!todoNotifyChecked" @click="confirmTodoNotify">确定发送</el-button>
        </div>
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

:deep(.notify-confirm-dialog .el-dialog__header),
:deep(.todo-notify-dialog .el-dialog__header) {
  text-align: center;
  padding-bottom: 8px;
}

:deep(.notify-confirm-dialog .el-dialog__title),
:deep(.todo-notify-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
}

:deep(.todo-notify-dialog .notify-confirm-content) {
  background: linear-gradient(135deg, #f0f9ff 0%, #e6f7ff 100%);
}

:deep(.todo-notify-dialog .notify-icon) {
  box-shadow: 0 4px 12px rgba(0, 137, 255, 0.15);
}

.notify-confirm-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 8px;
  margin-bottom: 20px;
}

.notify-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.notify-info {
  flex: 1;
}

.notify-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.notify-desc {
  font-size: 14px;
  color: #606266;
}

.notify-features {
  padding: 0 20px;
  margin-bottom: 24px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 14px;
  color: #606266;
}

.notify-checkbox {
  padding: 0 20px;
  margin-bottom: 8px;
}

:deep(.notify-checkbox .el-checkbox__label) {
  font-size: 15px;
  color: #303133;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 8px;
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

.dingtalk-blue-btn:disabled,
.dingtalk-blue-btn.is-disabled {
  background-color: #a0cfff !important;
  border-color: #a0cfff !important;
  color: #ffffff !important;
  cursor: not-allowed;
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

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
</style>
