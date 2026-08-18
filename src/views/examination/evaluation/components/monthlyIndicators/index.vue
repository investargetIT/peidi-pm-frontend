<script lang="ts" setup>
import { ref, onMounted, nextTick, watch, h, computed } from "vue";
import {
  getPmKpiMonthMetricTargetPage,
  updatePmKpiMonthMetricTargetApi,
  execSqlByUserId,
  execSqlByMonth,
  getDingAllDepartmentUsersApi,
  getUserListApi,
  notifyUserApi,
  notifyUserConfirmApi,
  updateEditStatusApi
} from "@/api/evaluation";
import {
  processAndExportMonthlyMetricForHR,
  calculateMonthlyMetricData
} from "@/views/examination/utils/exportMonthlyMetricForHR";
import { exportTargetPerformance } from "@/views/examination/utils/exportTargetPerformance";
import { ElMessage, ElMessageBox, ElCheckbox } from "element-plus";
import {
  Download,
  Bell,
  CircleCheck,
  Warning,
  InfoFilled
} from "@element-plus/icons-vue";
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
  isEdit?: number;
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

// 检测是否为移动端
const isMobile = ref(window.innerWidth <= 768);

// 触摸时间记录，用于检测双击
let lastTouchTime = 0;
let lastTouchTarget = "";

// 监听窗口大小变化
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth <= 768;
  });
}

// 处理触摸/点击事件 - 手机端单击，桌面端双击
const handleEditTouch = (
  row: RecordItem,
  field: "target" | "achieved",
  event: Event
) => {
  if (isMobile.value) {
    // 手机端直接单击编辑
    startEdit(row, field);
  } else {
    // 桌面端需要双击
    // 这里保持原来的 @dblclick 处理
  }
};

// 处理单元格点击，兼容触摸和鼠标
const handleCellClick = (row: RecordItem, field: "target" | "achieved") => {
  if (isMobile.value) {
    // 手机端需要二次确认
    const fieldName = field === "target" ? "目标值" : "完成值";
    const currentValue = row[field] ?? "-";

    ElMessageBox.confirm(
      `<div style="text-align: center;">
        <p style="margin-bottom: 8px; font-size: 14px;">即将编辑：</p>
        <p style="font-weight: 600; color: #409eff; font-size: 15px;">
          ${row.username} - ${fieldName}
        </p>
        <p style="margin-top: 8px; color: #909399; font-size: 13px;">
          当前值：${formatNumber(currentValue)}
        </p>
      </div>`,
      "确认编辑",
      {
        confirmButtonText: "进入编辑",
        cancelButtonText: "取消",
        type: "info",
        dangerouslyUseHTMLString: true,
        center: true,
        customClass: "edit-confirm-dialog"
      }
    )
      .then(() => {
        startEdit(row, field);
      })
      .catch(() => {
        // 用户取消，不做任何操作
      });
  }
};
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
// 核心开发人员（更高权限）
const CORE_DEVELOPER_USER_IDS = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1926449443739601629" // 杨世豪
];
const DEVELOPER_USER_IDS = [
  ...CORE_DEVELOPER_USER_IDS,
  "1869635118983348225", // 肖嘉玲
  "1870023775338692610", // 任琪琳
  "1926449443739601538" // 王晓莹
];
const MANUAL_VISIBLE_USERNAME_MAP: Record<string, string[]> = {
  邓苏: ["邓苏", "王永蝶", "夏立明", "潘明旺", "缪欣瑶"],
  孙舒欣: ["孙舒欣"],
  方云: ["侯子洋", "王琳", "张洪亮", "黄向前"],
  付阳: ["黄文豪"],
  范振吉: ["邓苏", "孙舒欣", "潘明旺"],
  黄向前: ["李源泰"]
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

// 判断是否可以编辑：isEdit为0时绝对不能编辑
const canEditRow = (row: RecordItem): boolean => {
  return row.isEdit !== 0;
};

// 判断当前月份是否被锁定（只要有一条数据isEdit=0就表示整个月份被锁）
const isMonthLocked = computed(() => {
  return tableData.value.some(row => row.isEdit === 0);
});

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
  // 黄色背景只和isManualRow关联，不受isEdit影响
  // 浅灰色背景(目标值可编辑)受isEdit影响
  let bgColor = "#ffffff";
  if (isManualRow(row) && [3, 4, 5, 6].includes(columnIndex)) {
    bgColor = "#fff3cd";
  } else if (columnIndex === 4 && canEditRow(row)) {
    // 目标值列在自动计算数据行也显示一个浅灰色，表示可以编辑，但只有在isEdit不为0时才显示
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

const isCoreDeveloper = () =>
  getCurrentUserIds().some(userId => CORE_DEVELOPER_USER_IDS.includes(userId));

// 判断当前用户是否是黄向前，并且选择的月份是2026-09或2026-10
const showHuangNotice = computed(() => {
  const isHuang = getCurrentUsername() === "黄向前";
  const selectedMonth = searchParams.value.startDate;
  const isTargetMonth =
    selectedMonth === "2026-09-01" || selectedMonth === "2026-10-01";
  return isHuang && isTargetMonth;
});

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
    const res = (await notifyUserApi([Number(currentTodoRow.value.id)])) as any;
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
  // 如果isEdit为0，绝对不能编辑
  if (!canEditRow(row)) {
    ElMessage.warning("当前数据已锁定，不可编辑");
    return;
  }
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

  // 使用更可靠的选择器
  const inputWrapper = document.querySelector(
    `.editable-cell-input-${row.id}-${field}`
  );
  const input = inputWrapper?.querySelector("input") as HTMLInputElement | null;

  // 确保 input 存在后再聚焦
  if (input) {
    // 延迟一点时间确保 DOM 完全渲染
    setTimeout(() => {
      input.focus();
      input.select();
      // 手机端滚动到可见区域
      if (isMobile.value) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }
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
  // 如果isEdit为0，绝对不能编辑
  if (!canEditRow(row)) {
    ElMessage.warning("当前数据已锁定，不可编辑");
    cancelEdit();
    return;
  }
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
    const currentYear = dayjs(
      searchParams.value.startDate || new Date()
    ).year();

    // 收集12个月的数据
    const allYearRecords: ApiRecordItem[] = [];

    // 循环请求12个月的数据
    for (let month = 1; month <= 12; month++) {
      const monthDate = dayjs(`${currentYear}-${month}-01`).format(
        "YYYY-MM-DD"
      );

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
      monthlyAchieved: TargetData;
      total: number;
    }

    const rowDataMap = new Map<string, RowData>();

    allYearRecords.forEach(record => {
      const filteredMetrics = (record.metricTargetList || []).filter(
        metric => metric.status !== 0
      );

      filteredMetrics.forEach(metric => {
        // 提取部门和考核组
        const treePathParts = (metric.treePathName || "")
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
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
            monthlyAchieved: {},
            total: 0
          });
        }

        const rowData = rowDataMap.get(key)!;
        // 存储目标值 / 完成值
        rowData.monthlyTargets[monthNum.toString()] = metric.target ?? "";
        rowData.monthlyAchieved[monthNum.toString()] = metric.achieved ?? "";
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

    // 添加1-12月列（每个月拆成"目标"和"完成"两列）
    for (let i = 1; i <= 12; i++) {
      columns.push({
        key: `month${i}Target`,
        header: `${i}月目标`,
        width: 12
      });
      columns.push({
        key: `month${i}Achieved`,
        header: `${i}月完成`,
        width: 12
      });
    }

    // 添加合计和备注列（合计拆成目标合计 / 完成合计）
    columns.push({ key: "totalTarget", header: "合计目标", width: 15 });
    columns.push({ key: "totalAchieved", header: "合计完成", width: 15 });
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
    rowDataMap.forEach(rowData => {
      // 计算合计（目标合计 / 完成合计）
      let totalTarget = 0;
      let totalAchieved = 0;

      const rowDataObj: any = {
        department: rowData.department,
        assessmentGroup: rowData.assessmentGroup,
        targetName: rowData.targetName,
        username: rowData.username
      };

      // 添加1-12月目标 / 完成数据
      for (let i = 1; i <= 12; i++) {
        const targetVal = rowData.monthlyTargets[i.toString()];
        const achievedVal = rowData.monthlyAchieved[i.toString()];

        rowDataObj[`month${i}Target`] = targetVal ?? "";
        rowDataObj[`month${i}Achieved`] = achievedVal ?? "";

        if (targetVal != null && targetVal !== "" && !isNaN(Number(targetVal))) {
          totalTarget += Number(targetVal);
        }
        if (achievedVal != null && achievedVal !== "" && !isNaN(Number(achievedVal))) {
          totalAchieved += Number(achievedVal);
        }
      }

      rowDataObj.totalTarget = totalTarget;
      rowDataObj.totalAchieved = totalAchieved;
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
const targetPerformanceExportLoading = ref(false);

// 人事导出 - 月份选择弹窗
const hrExportDialogVisible = ref(false);
const hrExportSelectedMonth = ref<string>("");
const hrExportConfirmChecked = ref(false);

const openHrExportDialog = () => {
  if (!isDeveloper()) {
    ElMessage.warning("只有开发者可以导出");
    return;
  }
  // 默认选中当前月
  hrExportSelectedMonth.value = dayjs().startOf("month").format("YYYY-MM-DD");
  hrExportConfirmChecked.value = false;
  hrExportDialogVisible.value = true;
};

const handleExportForHR = async () => {
  // 改为打开月份选择弹窗
  openHrExportDialog();
};

const confirmHrExport = async () => {
  if (!hrExportConfirmChecked.value) {
    ElMessage.warning("请先勾选确认");
    return;
  }
  if (!hrExportSelectedMonth.value) {
    ElMessage.warning("请选择导出月份");
    return;
  }

  try {
    hrExportLoading.value = true;
    hrExportDialogVisible.value = false;

    const selectedDate = dayjs(hrExportSelectedMonth.value);
    const year = selectedDate.year();
    const month = selectedDate.month() + 1;

    await processAndExportMonthlyMetricForHR(
      undefined,
      undefined,
      year,
      month
    );
    ElMessage.success(`人事导出成功（${year}年${month}月）`);
  } catch (error) {
    console.error("人事导出失败:", error);
    // 显示详细错误信息
    const errorMsg =
      error instanceof Error ? error.message : "人事导出失败，请查看控制台日志";

    if (errorMsg.includes("上月数据中存在手填类型数据不符合要求")) {
      // 如果是我们的检查错误，使用简洁的展示方式
      const match = errorMsg.match(/发现 (\d+) 条/);
      const count = match ? match[1] : "若干";
      ElMessageBox.alert(
        `发现 ${count} 条上月手填数据不符合要求，请先补填完整后再导出。`,
        "导出检查失败",
        {
          confirmButtonText: "知道了",
          type: "error"
        }
      );
    } else {
      ElMessage.error(errorMsg);
    }
  } finally {
    hrExportLoading.value = false;
  }
};

const cancelHrExport = () => {
  hrExportDialogVisible.value = false;
  hrExportConfirmChecked.value = false;
};

const handleExportTargetPerformance = async () => {
  if (!isDeveloper()) {
    ElMessage.warning("只有开发者可以导出");
    return;
  }

  try {
    targetPerformanceExportLoading.value = true;
    const result = await exportTargetPerformance();
    ElMessage.success(
      `导出目标绩效结果表成功，共填充 ${result.filledCount} 行` +
        (result.unmatchedCount > 0
          ? `，${result.unmatchedCount} 行未匹配（详见控制台）`
          : "")
    );
  } catch (error) {
    console.error("导出目标绩效结果表失败:", error);
    const errorMsg =
      error instanceof Error ? error.message : "导出失败，请重试";
    ElMessage.error(errorMsg);
  } finally {
    targetPerformanceExportLoading.value = false;
  }
};

const notifyConfirmLoading = ref(false);
const notifyConfirmDialogVisible = ref(false);
const confirmChecked = ref(false);
const todoNotifyDialogVisible = ref(false);
const todoNotifyChecked = ref(false);
const currentTodoRow = ref<RecordItem | null>(null);
const todoNotifyLoading = ref(false);

// 表格状态设置功能相关（加锁/解锁）
const tableStatusDialogVisible = ref(false);
const tableStatusChecked = ref(false);
const tableStatusLoading = ref(false);
const tableStatusMonth = ref(getDefaultMonth());
const tableStatusAction = ref<"lock" | "unlock">("unlock");

// 批量通知相关
const batchTodoNotifyDialogVisible = ref(false);
const batchTodoNotifyChecked = ref(false);
const batchTodoNotifyLoading = ref(false);

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
    notifyConfirmLoading.value = true;
    notifyConfirmDialogVisible.value = false;

    // 调用 calculateMonthlyMetricData 获取数组
    console.log("🔄 调用 calculateMonthlyMetricData 获取数据...");
    const metricDataArray = await calculateMonthlyMetricData();
    console.log("✅ 获取到的计算数据：", metricDataArray);

    // 构建新的数组，确保有 month 字段
    // 传上个月，比如当前是2026-07，就传2026-06-01
    const lastMonth = dayjs()
      .subtract(1, "month")
      .startOf("month")
      .format("YYYY-MM-DD");
    console.log("📅 使用的月份（上个月）：", lastMonth);

    const args = metricDataArray.map(item => {
      return {
        userId: String(item.userId), // 确保 userId 是字符串
        month: lastMonth, // 添加 month 字段（上个月）
        // 保留其他原有字段也一起传过去
        ...item
      };
    });

    console.log("📤 传给 notifyUserConfirmApi 的参数：", { args });

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

// 打开表格状态设置对话框
const handleTableStatus = (action: "lock" | "unlock") => {
  tableStatusAction.value = action;
  tableStatusChecked.value = false;
  tableStatusMonth.value = getDefaultMonth();
  tableStatusDialogVisible.value = true;
};

// 确认设置表格状态
const confirmTableStatus = async () => {
  if (!tableStatusChecked.value) {
    ElMessage.warning("请先勾选确认");
    return;
  }

  try {
    tableStatusLoading.value = true;
    tableStatusDialogVisible.value = false;

    const isEdit = tableStatusAction.value === "unlock" ? 1 : 0;
    const res = (await updateEditStatusApi({
      isEdit,
      month: tableStatusMonth.value
    })) as any;

    if (res?.code === 200 || res?.success) {
      ElMessage.success(
        tableStatusAction.value === "unlock" ? "解锁成功" : "加锁成功"
      );
      fetchData(); // 重新获取数据以更新锁定状态
    } else {
      ElMessage.error(
        res?.msg ||
          (tableStatusAction.value === "unlock" ? "解锁失败" : "加锁失败")
      );
    }
  } catch (error) {
    console.error("设置表格状态失败:", error);
    ElMessage.error(
      tableStatusAction.value === "unlock" ? "解锁失败" : "加锁失败"
    );
  } finally {
    tableStatusLoading.value = false;
  }
};

// 批量通知填写
const handleBatchTodoNotify = () => {
  if (!visibleRecords.value || visibleRecords.value.length === 0) {
    ElMessage.warning("当前筛选条件下没有数据");
    return;
  }
  batchTodoNotifyDialogVisible.value = true;
};

const confirmBatchTodoNotify = async () => {
  if (!batchTodoNotifyChecked.value) {
    ElMessage.warning("请先勾选确认发送钉钉待办");
    return;
  }

  try {
    // 收集所有唯一的记录id
    const idSet = new Set<number>();
    visibleRecords.value.forEach(record => {
      if (record.metricTargetList) {
        record.metricTargetList.forEach(metric => {
          if (metric.id && metric.status !== 0) {
            idSet.add(Number(metric.id));
          }
        });
      }
    });

    if (idSet.size === 0) {
      ElMessage.warning("没有可通知的记录");
      return;
    }

    batchTodoNotifyLoading.value = true;
    batchTodoNotifyDialogVisible.value = false;
    const res = (await notifyUserApi(Array.from(idSet))) as any;
    if (res?.code === 200 || res?.success) {
      ElMessage.success("批量通知成功");
    } else {
      ElMessage.error(res?.msg || "批量通知失败");
    }
  } catch (error) {
    console.error("批量通知用户失败:", error);
    ElMessage.error("批量通知用户失败");
  } finally {
    batchTodoNotifyLoading.value = false;
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
      <div class="section-title">搜索筛选</div>
      <el-card shadow="never" class="search-card">
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
              class="data-type-select"
              style="width: 280px !important"
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
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- 操作栏区域 -->
    <div class="action-bar-section">
      <div class="section-title">快捷操作</div>
      <el-card shadow="never" class="action-card">
        <div class="action-bar">
          <el-button
            type="success"
            :loading="batchUpdating"
            @click="handleBatchUpdateMetricData"
          >
            批量更新指标数据
          </el-button>
          <el-tooltip
            content="向当前筛选条件下的所有用户发送钉钉待办提醒填写"
            placement="top"
          >
            <el-button
              class="dingtalk-blue-btn"
              :loading="batchTodoNotifyLoading"
              @click="handleBatchTodoNotify"
            >
              批量提醒填写
            </el-button>
          </el-tooltip>
          <template v-if="isCoreDeveloper()">
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
            <el-tooltip content="锁定指定月份的表格填写权限" placement="top">
              <el-button
                type="danger"
                :loading="tableStatusLoading && tableStatusAction === 'lock'"
                @click="handleTableStatus('lock')"
              >
                <el-icon><Warning /></el-icon>
                表格填写加锁
              </el-button>
            </el-tooltip>
            <el-tooltip content="解锁指定月份的表格填写权限" placement="top">
              <el-button
                type="warning"
                :loading="tableStatusLoading && tableStatusAction === 'unlock'"
                @click="handleTableStatus('unlock')"
              >
                <el-icon><CircleCheck /></el-icon>
                表格填写解锁
              </el-button>
            </el-tooltip>
          </template>
          <template v-if="isDeveloper()">
            <el-button
              class="excel-export-btn"
              :loading="hrExportLoading"
              @click="handleExportForHR"
            >
              <el-icon><Download /></el-icon>
              人事导出
            </el-button>
            <el-tooltip
              content="导出选中月份所在年份1-12月的目标业绩表"
              placement="top"
            >
              <el-button
                class="excel-export-btn"
                :loading="exportLoading"
                @click="handleExport"
              >
                <el-icon><Download /></el-icon>
                导出目标业绩表
              </el-button>
            </el-tooltip>
            <el-tooltip
              content="读取季度GMV目标模板，按姓名和指标名称匹配填充目标值后导出"
              placement="top"
            >
              <el-button
                class="excel-export-btn"
                :loading="targetPerformanceExportLoading"
                @click="handleExportTargetPerformance"
              >
                <el-icon><Download /></el-icon>
                导出目标绩效结果表
              </el-button>
            </el-tooltip>
          </template>
        </div>
      </el-card>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <div class="section-title">数据列表</div>
      <el-card shadow="never" class="table-card">
        <div class="table-tip">
          <el-tag size="small" type="warning" effect="light">提示</el-tag>
          <span class="tip-text"
            >黄色背景行为手填数据，浅灰色背景的目标值可随时编辑</span
          >
        </div>
        <!-- 黄向前的特殊通知 -->
        <div v-if="showHuangNotice" class="huang-notice">
          <el-icon color="#409eff" style="margin-right: 8px; font-size: 18px"
            ><InfoFilled
          /></el-icon>
          <span class="huang-notice-text"
            >请注意修改双十一期间李源泰的短视频出单量达成率指标目标值</span
          >
        </div>
        <div v-if="isMonthLocked" class="table-lock-tip">
          <el-icon color="#f56c6c" style="margin-right: 5px"
            ><Warning
          /></el-icon>
          <span class="lock-tip-text">当前月份数据已锁定，不可修改</span>
        </div>
        <div class="table-wrapper">
          <el-table
            v-loading="loading"
            :data="tableData"
            border
            stripe
            class="monthly-table"
            :span-method="objectSpanMethod"
            :cell-style="tableCellStyle"
          >
            <el-table-column label="序号" width="60" align="center">
              <template #default="{ $index }">
                {{ getGroupIndex($index) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="month"
              label="月份"
              width="120"
              align="center"
            >
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
            <el-table-column
              prop="target"
              label="目标值（元）"
              width="160"
              align="right"
            >
              <template #default="{ row }">
                <el-input
                  v-if="isEditing(row, 'target')"
                  v-model="editingValue"
                  :class="`editable-cell-input editable-cell-input-${row.id}-target`"
                  style="width: 120px"
                  @blur="confirmEdit(row, 'target')"
                  @keydown="handleEditKeydown($event, row, 'target')"
                />
                <span
                  v-else
                  v-loading="isSaving(row, 'target')"
                  class="editable-cell"
                  :class="{ 'editable-cell-disabled': !canEditRow(row) }"
                  :title="
                    canEditRow(row)
                      ? isMobile
                        ? '点击进入编辑（需确认）'
                        : '双击修改'
                      : '已锁定，不可编辑'
                  "
                  @dblclick="
                    !isMobile && canEditRow(row)
                      ? startEdit(row, 'target')
                      : undefined
                  "
                  @click="
                    isMobile && canEditRow(row)
                      ? handleCellClick(row, 'target')
                      : undefined
                  "
                >
                  {{ formatNumber(row.target) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column
              prop="achieved"
              label="完成值（元）"
              width="160"
              align="right"
            >
              <template #default="{ row }">
                <el-input
                  v-if="isEditing(row, 'achieved')"
                  v-model="editingValue"
                  :class="`editable-cell-input editable-cell-input-${row.id}-achieved`"
                  style="width: 120px"
                  @blur="confirmEdit(row, 'achieved')"
                  @keydown="handleEditKeydown($event, row, 'achieved')"
                />
                <span
                  v-else
                  v-loading="isSaving(row, 'achieved')"
                  class="editable-cell"
                  :class="{
                    'editable-cell-disabled':
                      !canEditRow(row) || !isManualRow(row)
                  }"
                  :title="
                    !canEditRow(row)
                      ? '已锁定，不可编辑'
                      : isManualRow(row)
                        ? isMobile
                          ? '点击进入编辑（需确认）'
                          : '双击修改'
                        : '不可编辑'
                  "
                  @dblclick="
                    !isMobile && canEditRow(row) && isManualRow(row)
                      ? startEdit(row, 'achieved')
                      : undefined
                  "
                  @click="
                    isMobile && canEditRow(row) && isManualRow(row)
                      ? handleCellClick(row, 'achieved')
                      : undefined
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
            <el-table-column
              :fixed="isMobile ? false : 'right'"
              label="操作"
              :width="isMobile ? 180 : 280"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.groupIndex === 0">
                  <div class="action-buttons">
                    <el-button
                      type="success"
                      size="small"
                      :loading="isUpdating(row.userId || '')"
                      @click="handleUpdateMetricData(row)"
                    >
                      <template v-if="isMobile">更新</template>
                      <template v-else>更新指标数据</template>
                    </el-button>
                    <el-tooltip
                      content="提醒该负责人的填写人填写指标信息"
                      placement="top"
                    >
                      <el-button
                        class="dingtalk-blue-btn"
                        size="small"
                        @click="handleNotifyUser(row)"
                      >
                        <template v-if="isMobile">提醒</template>
                        <template v-else>提醒填写</template>
                      </el-button>
                    </el-tooltip>
                  </div>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>

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
      </el-card>
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
          <div class="notify-desc">
            向上个月所有考核用户发送钉钉消息<br />
            通知用户确认其上个月绩效
          </div>
        </div>
      </div>
      <div class="notify-features">
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>向上个月所有考核用户发送钉钉消息</span>
        </div>
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>通知用户确认其上个月绩效</span>
        </div>
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>包含所有考核用户，不受筛选条件限制</span>
        </div>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="confirmChecked" size="large"
          >我确认发送钉钉消息</el-checkbox
        >
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="notifyConfirmDialogVisible = false"
            >取消</el-button
          >
          <el-button
            type="primary"
            size="large"
            :loading="notifyConfirmLoading"
            :disabled="!confirmChecked"
            @click="confirmNotify"
            >确定发送</el-button
          >
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
          <div class="notify-desc">
            即将向「{{ currentTodoRow?.username }}」的填写人发送钉钉待办通知
          </div>
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
        <el-checkbox v-model="todoNotifyChecked" size="large"
          >我确认发送钉钉待办</el-checkbox
        >
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="todoNotifyDialogVisible = false"
            >取消</el-button
          >
          <el-button
            class="dingtalk-blue-btn"
            size="large"
            :loading="todoNotifyLoading"
            :disabled="!todoNotifyChecked"
            @click="confirmTodoNotify"
            >确定发送</el-button
          >
        </div>
      </template>
    </el-dialog>

    <!-- 批量发送钉钉待办确认对话框 -->
    <el-dialog
      v-model="batchTodoNotifyDialogVisible"
      title="批量发送钉钉待办"
      width="520px"
      :close-on-click-modal="false"
      class="todo-notify-dialog"
    >
      <div class="notify-confirm-content">
        <div class="notify-icon">
          <el-icon :size="48" color="#0089FF"><Bell /></el-icon>
        </div>
        <div class="notify-info">
          <div class="notify-title">批量发送待办提醒</div>
          <div class="notify-desc" style="color: red">
            即将向当前筛选条件下的所有用户发送钉钉待办通知
          </div>
        </div>
      </div>
      <div class="notify-features">
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>批量提醒用户填写指标信息</span>
        </div>
        <div class="feature-item">
          <el-icon color="#E6A23C"><Warning /></el-icon>
          <span>24小时内只能发送一次</span>
        </div>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="batchTodoNotifyChecked" size="large"
          >我确认发送钉钉待办</el-checkbox
        >
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="batchTodoNotifyDialogVisible = false"
            >取消</el-button
          >
          <el-button
            class="dingtalk-blue-btn"
            size="large"
            :loading="batchTodoNotifyLoading"
            :disabled="!batchTodoNotifyChecked"
            @click="confirmBatchTodoNotify"
            >确定发送</el-button
          >
        </div>
      </template>
    </el-dialog>

    <!-- 人事导出 - 月份选择对话框 -->
    <el-dialog
      v-model="hrExportDialogVisible"
      title="人事导出"
      width="420px"
      :close-on-click-modal="false"
      class="hr-export-dialog"
    >
      <div class="unlock-month-select">
        <el-form-item label="导出月份">
          <el-date-picker
            v-model="hrExportSelectedMonth"
            type="month"
            placeholder="选择月份（默认当前月）"
            value-format="YYYY-MM-DD"
            format="YYYY 年 MM 月"
            style="width: 100%"
          />
        </el-form-item>
        <div class="hr-export-tip">
          ⚠ 非必要请勿修改月份，默认即为当前月<br />
          &nbsp;&nbsp;&nbsp;&nbsp;例如：考核 7 月，请选择 8 月（系统将自动取 7 月数据）
        </div>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="hrExportConfirmChecked" size="large">
          我已确认要导出该月份的指标数据
        </el-checkbox>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="cancelHrExport">取消</el-button>
          <el-button
            type="primary"
            size="large"
            :loading="hrExportLoading"
            :disabled="!hrExportConfirmChecked || !hrExportSelectedMonth"
            @click="confirmHrExport"
          >
            导出
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 表格填写状态设置对话框 -->
    <el-dialog
      v-model="tableStatusDialogVisible"
      :title="tableStatusAction === 'unlock' ? '表格填写解锁' : '表格填写加锁'"
      width="520px"
      :close-on-click-modal="false"
      :class="tableStatusAction === 'unlock' ? 'unlock-dialog' : 'lock-dialog'"
    >
      <div
        class="notify-confirm-content"
        :class="tableStatusAction === 'unlock' ? 'unlock-bg' : 'lock-bg'"
      >
        <div class="notify-icon">
          <el-icon
            :size="48"
            :color="tableStatusAction === 'unlock' ? '#E6A23C' : '#F56C6C'"
          >
            <CircleCheck v-if="tableStatusAction === 'unlock'" />
            <Warning v-else />
          </el-icon>
        </div>
        <div class="notify-info">
          <div class="notify-title">
            {{
              tableStatusAction === "unlock" ? "表格填写解锁" : "表格填写加锁"
            }}
          </div>
          <div class="notify-desc">
            {{
              tableStatusAction === "unlock"
                ? "即将解锁指定月份的表格填写权限"
                : "即将锁定指定月份的表格填写权限"
            }}
          </div>
        </div>
      </div>
      <div class="notify-features">
        <div class="feature-item">
          <el-icon color="#67C23A"><CircleCheck /></el-icon>
          <span>{{
            tableStatusAction === "unlock"
              ? "解锁后，用户可以编辑该月份的指标数据"
              : "加锁后，用户无法编辑该月份的指标数据"
          }}</span>
        </div>
        <div class="feature-item">
          <el-icon color="#E6A23C"><Warning /></el-icon>
          <span>{{
            tableStatusAction === "unlock"
              ? "请谨慎操作，解锁后数据可能被修改"
              : "加锁后可以保护数据不被意外修改"
          }}</span>
        </div>
      </div>
      <div class="unlock-month-select">
        <el-form-item label="选择月份">
          <el-date-picker
            v-model="tableStatusMonth"
            type="month"
            placeholder="选择月份"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
      </div>
      <div class="notify-checkbox">
        <el-checkbox v-model="tableStatusChecked" size="large">
          我确认{{
            tableStatusAction === "unlock" ? "解锁" : "锁定"
          }}该月份的表格填写权限
        </el-checkbox>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" @click="tableStatusDialogVisible = false">
            取消
          </el-button>
          <el-button
            :type="tableStatusAction === 'unlock' ? 'warning' : 'danger'"
            size="large"
            :loading="tableStatusLoading"
            :disabled="!tableStatusChecked"
            @click="confirmTableStatus"
          >
            确定{{ tableStatusAction === "unlock" ? "解锁" : "加锁" }}
          </el-button>
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

/* 对话框样式 */
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

:deep(.unlock-dialog .el-dialog__header),
:deep(.lock-dialog .el-dialog__header) {
  text-align: center;
  padding-bottom: 8px;
}

:deep(.unlock-dialog .el-dialog__title),
:deep(.lock-dialog .el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
}

:deep(.unlock-dialog .notify-confirm-content) {
  background: linear-gradient(135deg, #fff7e6 0%, #fff3cd 100%);
}

:deep(.lock-dialog .notify-confirm-content) {
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
}

:deep(.unlock-dialog .notify-icon) {
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.15);
}

:deep(.lock-dialog .notify-icon) {
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.15);
}

.unlock-month-select {
  padding: 0 20px;
  margin-bottom: 16px;
}

.hr-export-tip {
  font-size: 12px;
  color: #e6a23c;
  line-height: 1.8;
  margin-top: 6px;
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

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: "";
  width: 4px;
  height: 16px;
  background: #409eff;
  border-radius: 2px;
}

.action-bar-section {
  margin-bottom: 20px;
}

.action-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  justify-content: flex-end;

  @media (max-width: 768px) {
    justify-content: flex-start;
  }
}

.table-section {
  margin-bottom: 20px;
}

.table-section .table-tip {
  margin-bottom: 12px;
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

.table-lock-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #fef0f0;
  border: 1px solid #f56c6c;
  border-radius: 4px;
  margin-bottom: 12px;
}

.lock-tip-text {
  font-size: 14px;
  color: #f56c6c;
  font-weight: 500;
}

/* 黄向前的特殊通知样式 */
.huang-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: #ecf5ff;
  border: 1px solid #409eff;
  border-radius: 4px;
  margin-bottom: 12px;
}

.huang-notice-text {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
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
  margin-bottom: 20px;
}

/* 数据类型选择框样式优化 */
.search-section :deep(.data-type-select) {
  width: 280px !important;

  /* 增大字体以便看清 */
  :deep(.el-input__wrapper),
  :deep(.el-select__selected-item),
  :deep(.el-select__placeholder) {
    font-size: 15px !important;
  }
}

.search-card,
.action-card,
.table-card {
  border-radius: 8px;
}

.search-section :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.search-section :deep(.el-form-item) {
  margin-bottom: 0;

  /* 对于最后一个表单项（包含按钮组），使用 gap 来控制间距 */
  &:last-child {
    display: flex;
    gap: 8px;
  }
}

.search-section :deep(.el-form-item:last-child) {
  margin-left: auto;

  @media (max-width: 768px) {
    margin-left: 0;
    width: 100%;
    display: flex;
    gap: 8px;

    .el-button {
      flex: 1;
    }
  }
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
  transition: all 0.2s ease;
  user-select: none;

  /* 手机端优化 */
  @media (max-width: 768px) {
    min-height: 36px;
    padding: 6px 10px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 70px;
    touch-action: manipulation;
  }
}

.editable-cell:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);

  /* 手机端移除 hover 效果，增强点击效果 */
  @media (max-width: 768px) {
    background: transparent;
    color: inherit;
  }
}

.editable-cell:active {
  /* 手机端点击效果 */
  @media (max-width: 768px) {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
    transform: scale(0.98);
  }
}

.editable-cell-disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.editable-cell-disabled:hover {
  background: transparent;
  color: inherit;
}

/* 手机端输入框优化 */
@media (max-width: 768px) {
  :deep(.editable-cell-input) {
    .el-input {
      width: 100% !important;
    }

    .el-input__wrapper {
      padding: 6px 10px;
    }

    .el-input__inner {
      font-size: 16px !important; /* 防止 iOS 缩放 */
      text-align: right;
    }
  }
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

/* 编辑确认对话框样式优化 */
:deep(.edit-confirm-dialog) {
  .el-dialog__header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 16px 20px;
    margin: 0;

    .el-dialog__title {
      color: white;
      font-weight: 600;
    }

    .el-dialog__headerbtn {
      top: 16px;
      right: 16px;

      .el-dialog__close {
        color: white;
        font-size: 20px;

        &:hover {
          color: #f0f0f0;
        }
      }
    }
  }

  .el-dialog__body {
    padding: 24px 20px;
  }

  .el-dialog__footer {
    padding: 16px 20px 20px;
    display: flex;
    justify-content: center;
    gap: 12px;

    .el-button {
      padding: 10px 24px;
      font-size: 14px;
    }
  }

  /* 手机端对话框优化 */
  @media (max-width: 768px) {
    width: 85% !important;
    margin: 10vh auto !important;

    .el-dialog__body {
      padding: 20px 16px;
    }

    .el-dialog__footer {
      flex-direction: column;

      .el-button {
        width: 100%;
        margin-left: 0 !important;
      }
    }
  }
}

/* 响应式样式 */
@media (max-width: 768px) {
  .monthly-indicators-container {
    gap: 12px;
  }

  .section-title {
    font-size: 14px;
    margin-bottom: 10px;
  }

  .search-card,
  .action-card,
  .table-card {
    :deep(.el-card__body) {
      padding: 12px;
    }
  }

  .search-section :deep(.el-form) {
    gap: 10px;

    :deep(.el-form-item) {
      width: 100%;
      margin-bottom: 8px;
    }

    :deep(.el-form-item:last-child) {
      margin-left: 0;
      margin-top: 4px;

      .el-button {
        flex: 1;
      }
    }
  }

  .search-section :deep(.el-autocomplete),
  .search-section :deep(.el-input),
  .search-section :deep(.el-date-picker),
  .search-section :deep(.el-select:not(.data-type-select)) {
    width: 100% !important;
  }

  /* 移动端数据类型选择框专门优化 */
  .search-section :deep(.data-type-select) {
    width: 100% !important;

    /* 更大的高度 */
    :deep(.el-input__wrapper) {
      min-height: 48px !important;
      padding: 8px 15px !important;
    }

    /* 更大的字体 */
    :deep(.el-input__wrapper),
    :deep(.el-select__selected-item),
    :deep(.el-select__placeholder),
    :deep(.el-select__input) {
      font-size: 16px !important;
      line-height: 1.6 !important;
    }
  }

  .action-bar {
    justify-content: flex-start;

    .el-button {
      margin-left: 0 !important;
      flex: 1 1 calc(50% - 6px);
      min-width: calc(50% - 6px);
      font-size: 13px;
    }
  }

  .table-tip,
  .table-lock-tip {
    flex-wrap: wrap;
    font-size: 12px;
    padding: 8px 10px;
  }

  .tip-text,
  .lock-tip-text {
    font-size: 12px;
  }

  /* 表格响应式 */
  .table-card {
    :deep(.el-card__body) {
      padding: 8px;
    }
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 表格列在移动端不固定操作列 */
  :deep(.el-table) {
    .el-table__fixed-right {
      display: none;
    }
  }

  /* 对话框响应式 */
  :deep(.el-dialog) {
    width: 90% !important;
    margin: 5vh auto !important;
  }

  .notify-confirm-content {
    flex-direction: column;
    text-align: center;
    padding: 16px;
  }

  .notify-icon {
    width: 56px;
    height: 56px;
  }

  .notify-features {
    padding: 0 12px;
  }

  .notify-checkbox {
    padding: 0 12px;
  }

  .dialog-footer {
    flex-direction: column;
    padding: 0 12px 12px;
    gap: 10px;

    .el-button {
      width: 100%;
      margin-left: 0 !important;
    }
  }

  .pagination-section {
    justify-content: center;
    overflow-x: auto;

    :deep(.el-pagination) {
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;

      .el-pager,
      .btn-prev,
      .btn-next {
        flex-shrink: 0;
      }
    }
  }

  /* 表格操作按钮 */
  .action-buttons {
    flex-direction: column;
    width: 100%;

    .el-button {
      width: 100%;
      margin: 2px 0;
    }
  }
}
</style>
