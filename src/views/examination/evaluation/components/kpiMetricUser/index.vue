<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getPmKpiMetricUserPage,
  deletePmKpiMetricUserApi,
  getUserListApi,
  getPmExecSqlListApi,
  generateKpiMonthMetricTargetByUserId
} from "@/api/evaluation";
import DetailDialog from "./components/detailDialog.vue";
import RiAddLine from "@iconify-icons/ri/add-line";
import RiEditLine from "@iconify-icons/ri/edit-line";
import RiDeleteBinLine from "@iconify-icons/ri/delete-bin-line";
import RiCalendarEventLine from "@iconify-icons/ri/calendar-event-line";

interface SqlExecItem {
  type: string;
  sqlExecId: number | string | null;
}

interface OtherConfig {
  calculationType?: number;
  notifyUserList?: number[];
}

interface MetricItem {
  id: number;
  metricConfigId: number;
  metricType: number;
  targetName: string;
  metricId: string;
  kpiDepict: string;
  rate: string;
  nodeId: number;
  nodeName: string;
  status?: number;
  sqlExecConfig?: string | SqlExecItem[];
  otherConfig?: string | null;
  existSqlConfig?: number;
}

interface RecordItem {
  userId: number;
  jobNum: string;
  username: string;
  nodeId: number;
  nodeName: string;
  metricList: MetricItem[];
}

interface FlatRow {
  userId: number;
  jobNum: string;
  username: string;
  nodeId: number;
  nodeName: string;
  rowSpan: number;
  isFirst: boolean;
  userIndex: number;
  metric: MetricItem | null;
  notifyUserList?: number[];
}

interface ApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: RecordItem[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
}

interface UserItem {
  id: number;
  username: string;
  jobNum?: string;
}

const loading = ref(false);
const tableData = ref<RecordItem[]>([]);
const total = ref(0);
const PAGE_SIZE_STORAGE_KEY = "kpi-metric-user-page-size";
const PAGE_STORAGE_KEY = "kpi-metric-user-current-page";

// 从本地存储读取配置
const savedPageSize = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
const savedCurrentPage = localStorage.getItem(PAGE_STORAGE_KEY);

const currentPage = ref(savedCurrentPage ? Number(savedCurrentPage) : 1);
const pageSize = ref(savedPageSize ? Number(savedPageSize) : 10);

const dialogVisible = ref(false);
const dialogMode = ref<"add" | "edit">("edit");
const currentEditRecord = ref<RecordItem | null>(null);
const userLoading = ref(false);
const userList = ref<UserItem[]>([]);
const sqlLoading = ref(false);
const achievedSqlList = ref<{ id?: string; name?: string }[]>([]);
const finishingRateSqlList = ref<{ id?: string; name?: string }[]>([]);

// 生成指标数据对话框
const generateDialogVisible = ref(false);
const generateLoading = ref(false);
const generateMonths = ref<string[]>([]);
const selectedMonth = ref<string>('');
const currentGenerateUser = ref<FlatRow | null>(null);

// 添加月份
const addMonth = () => {
  if (!selectedMonth.value) {
    ElMessage.warning('请先选择月份');
    return;
  }
  if (!generateMonths.value.includes(selectedMonth.value)) {
    generateMonths.value.push(selectedMonth.value);
    generateMonths.value.sort();
  } else {
    ElMessage.warning('该月份已选择');
  }
  selectedMonth.value = '';
};

// 删除月份
const removeMonth = (month: string) => {
  const index = generateMonths.value.indexOf(month);
  if (index > -1) {
    generateMonths.value.splice(index, 1);
  }
};

// 解析otherConfig字符串为对象
const parseOtherConfig = (otherConfig?: string | null): OtherConfig => {
  if (!otherConfig || otherConfig.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(otherConfig);
    return parsed || {};
  } catch (error) {
    console.error("解析otherConfig失败", error);
    return {};
  }
};

// 获取计算类型文本
const getCalculationTypeText = (calculationType?: number): string => {
  if (calculationType === 1) return "混合模式";
  if (calculationType === 2) return "累计模式";
  if (calculationType === 3) return "当月模式";
  return "";
};

// 获取计算类型对应的TAG类型
const getCalculationTypeTag = (calculationType?: number): "primary" | "success" | "warning" | "info" | "danger" => {
  if (calculationType === 1) return "primary";    // 蓝色
  if (calculationType === 2) return "success";    // 绿色
  if (calculationType === 3) return "warning";    // 橙色
  return "info";
};

// 从用户的指标列表中获取统一的通知人列表（从第一条获取）
const getNotifyUserListFromRecord = (record?: any): number[] => {
  if (!record) return [];
  const metrics = record.metricList || [];
  if (!metrics.length) return [];
  const firstMetric = metrics.find((m: any) => m.otherConfig) || metrics[0];
  if (!firstMetric) return [];
  const config = parseOtherConfig(firstMetric.otherConfig);
  return config.notifyUserList || [];
};

// 获取通知人名称列表
const getNotifyUserNames = (notifyUserList?: number[]): string => {
  if (!notifyUserList || !notifyUserList.length || !userList.value) return "";
  return notifyUserList
    .map(id => {
      const user = userList.value.find(u => u.id === id);
      return user?.username || "";
    })
    .filter(Boolean)
    .join(", ");
};

// 拍平数据用于表格展示（同一用户多条指标合并显示）
const flatTableData = computed<FlatRow[]>(() => {
  const result: FlatRow[] = [];
  let visibleUserIndex = 0;

  tableData.value.forEach(record => {
    // 关闭状态的指标不展示；若用户下没有开启的指标，则该用户整组不展示
    const metrics = (record.metricList || []).filter(metric => metric.status !== 0);
    if (!metrics.length) return;

    // 获取该用户的统一通知人列表
    const notifyList = getNotifyUserListFromRecord(record);

    visibleUserIndex += 1;
    metrics.forEach((metric, index) => {
      result.push({
        userId: record.userId,
        jobNum: record.jobNum,
        username: record.username,
        nodeId: record.nodeId,
        nodeName: record.nodeName,
        rowSpan: metrics.length,
        isFirst: index === 0,
        userIndex: visibleUserIndex,
        metric,
        notifyUserList: notifyList
      });
    });
  });
  return result;
});

// 合并单元格规则：序号、工号、用户名、考核组、通知人、操作 按用户合并；计算类型不合并
const spanMethod = ({
  row,
  columnIndex
}: {
  row: FlatRow;
  columnIndex: number;
}) => {
  if ([0, 1, 2, 3, 10, 11].includes(columnIndex)) {
    if (row.isFirst) {
      return { rowspan: row.rowSpan, colspan: 1 };
    }
    return { rowspan: 0, colspan: 0 };
  }
  return { rowspan: 1, colspan: 1 };
};

// 搜索条件
const searchParams = ref({
  username: ""
});

const queryUserSuggestions = (queryString: string, cb: any) => {
  let results = queryString
    ? userList.value.filter((user: any) =>
        user.username.toLowerCase().includes(queryString.toLowerCase())
      )
    : userList.value;
  cb(results.map((user: any) => ({ value: user.username })));
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiMetricUserPage({
      username: searchParams.value.username || undefined,
      pageNo: currentPage.value,
      pageSize: pageSize.value
    })) as ApiResponse;
    if (res.success && res.data) {
      tableData.value = res.data.records;
      total.value = res.data.total;
    }
  } catch (error) {
    console.error("获取KPI指标用户数据失败", error);
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
    username: ""
  };
  currentPage.value = 1;
  fetchData();
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchData();
};

const handleEdit = (row: FlatRow) => {
  const record = tableData.value.find(r => r.userId === row.userId);
  if (record) {
    dialogMode.value = "edit";
    currentEditRecord.value = {
      ...record,
      metricList: record.metricList.map(m => ({ ...m }))
    };
    dialogVisible.value = true;
    fetchUserList();
    fetchSqlLists();
  }
};

const fetchUserList = async () => {
  if (userList.value.length || userLoading.value) return;
  userLoading.value = true;
  try {
    const res = (await getUserListApi({ name: "" })) as any;
    if (res?.success && Array.isArray(res.data)) {
      userList.value = res.data.sort((a: UserItem, b: UserItem) =>
        (a.username || "").localeCompare(b.username || "", "zh-CN")
      );
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
  } finally {
    userLoading.value = false;
  }
};

const fetchSqlLists = async () => {
  if (achievedSqlList.value.length && finishingRateSqlList.value.length) return;
  sqlLoading.value = true;
  try {
    const [achievedRes, finishingRateRes] = await Promise.all([
      getPmExecSqlListApi({ type: "1" }) as any,
      getPmExecSqlListApi({ type: "2" }) as any
    ]);
    if (achievedRes?.code === 200 || achievedRes?.success) {
      achievedSqlList.value = (achievedRes.data || []).map((item: any) => ({
        id: String(item.id),
        name: item.name
      }));
    }
    if (finishingRateRes?.code === 200 || finishingRateRes?.success) {
      finishingRateSqlList.value = (finishingRateRes.data || []).map((item: any) => ({
        id: String(item.id),
        name: item.name
      }));
    }
  } catch (error) {
    console.error("获取SQL列表失败", error);
  } finally {
    sqlLoading.value = false;
  }
};

const handleAdd = async () => {
  dialogMode.value = "add";
  currentEditRecord.value = null;
  dialogVisible.value = true;
  fetchUserList();
  fetchSqlLists();
};

// 监听页码和每页条数变化，保存到本地存储
watch(currentPage, (newPage) => {
  localStorage.setItem(PAGE_STORAGE_KEY, String(newPage));
});

watch(pageSize, (newSize) => {
  localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(newSize));
});

const handleDialogSuccess = () => {
  fetchData();
};

const parseSqlExecConfig = (sqlExecConfig?: string | SqlExecItem[]): SqlExecItem[] => {
  if (!sqlExecConfig || sqlExecConfig === "0") {
    return [
      { type: "achieved", sqlExecId: null },
      { type: "finishingRate", sqlExecId: null }
    ];
  }
  if (Array.isArray(sqlExecConfig)) {
    return sqlExecConfig.map(item => ({
      ...item,
      sqlExecId: item.sqlExecId != null ? String(item.sqlExecId) : null
    }));
  }
  try {
    const parsed = JSON.parse(sqlExecConfig);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        ...item,
        sqlExecId: item.sqlExecId != null ? String(item.sqlExecId) : null
      }));
    }
  } catch {}
  return [
    { type: "achieved", sqlExecId: null },
    { type: "finishingRate", sqlExecId: null }
  ];
};

const getSqlExecIdByType = (
  sqlExecConfig: SqlExecItem[] | string | null | undefined,
  type: string
): number | string | null => {
  const config = parseSqlExecConfig(sqlExecConfig);
  const item = config.find(i => i.type === type);
  return item?.sqlExecId ?? null;
};

const getSqlExecNameById = (list: { id?: string; name?: string }[], id: number | string | null): string => {
  if (!id) return "";
  const stringId = String(id);
  const item = list.find(i => i.id === stringId);
  return item?.name || "";
};

// 判断是否为手填数据：existSqlConfig为0就是手填，1是服务端计算
const isManualRow = (row: FlatRow): boolean => {
  if (!row.metric) return false;
  // existSqlConfig为0就是手填
  return row.metric.existSqlConfig === 0;
};

// 表格单元格样式
const tableCellStyle = ({ row, columnIndex }: { row: FlatRow; columnIndex: number }) => {
  // 前4列（序号、工号、用户名、考核组）、通知人、操作列保持白色
  if (columnIndex < 4 || [10, 11].includes(columnIndex)) {
    return {
      backgroundColor: '#ffffff',
      '--el-table-cell-hover-bg-color': '#ffffff'
    };
  }
  // 其他列根据是否手填数据设置颜色
  const bgColor = isManualRow(row) ? '#fff3cd' : '#ffffff';
  return {
    backgroundColor: bgColor,
    '--el-table-cell-hover-bg-color': bgColor
  };
};

const handleDelete = (row: FlatRow) => {
  ElMessageBox.confirm(`确定删除用户「${row.username}」的全部指标数据？`, "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(async () => {
    try {
      const res = (await deletePmKpiMetricUserApi({
        userId: row.userId
      })) as ApiResponse;
      if (res?.code === 200) {
        ElMessage.success("删除成功");
        fetchData();
      } else {
        ElMessage.error(res?.msg || "删除失败");
      }
    } catch (error) {
      console.error("删除失败", error);
      ElMessage.error("删除失败");
    }
  }).catch(() => {});
};

const handleOpenGenerateDialog = (row: FlatRow) => {
  currentGenerateUser.value = row;
  generateMonths.value = [];
  generateDialogVisible.value = true;
};

const handleGenerate = () => {
  if (!currentGenerateUser.value) return;
  if (generateMonths.value.length === 0) {
    ElMessage.warning("请选择至少一个月份");
    return;
  }

  ElMessageBox.confirm(
    `确定为用户「${currentGenerateUser.value.username}」生成${generateMonths.value.join('、')}的指标数据？`,
    "生成确认",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "info"
    }
  ).then(async () => {
    generateLoading.value = true;
    try {
      const res = await generateKpiMonthMetricTargetByUserId({
        userId: currentGenerateUser.value.userId,
        months: generateMonths.value
      }) as any;
      if (res?.code === 200 || res?.success) {
        ElMessage.success("生成成功");
        generateDialogVisible.value = false;
        fetchData();
      } else {
        ElMessage.error(res?.msg || "生成失败");
      }
    } catch (error) {
      console.error("生成失败", error);
      ElMessage.error("生成失败");
    } finally {
      generateLoading.value = false;
    }
  }).catch(() => {});
};

onMounted(() => {
  fetchData();
  fetchUserList();
  fetchSqlLists();
});
</script>

<template>
  <div class="kpi-metric-user-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form :model="searchParams" inline size="default">
        <el-form-item label="用户名">
          <el-autocomplete
            v-model="searchParams.username"
            :fetch-suggestions="queryUserSuggestions"
            placeholder="请输入用户名"
            clearable
            style="width: 200px"
            :trigger-on-focus="true"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-button type="primary" @click="handleAdd">
        <template #icon>
          <IconifyIconOffline :icon="RiAddLine" />
        </template>
        新增
      </el-button>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <div class="table-tip">
        <el-tag size="small" type="warning" effect="light">提示</el-tag>
        <span class="tip-text">黄色背景行为手填数据</span>
      </div>
      <div class="calculation-type-tip">
        <el-tag size="small" type="info" effect="light">计算类型说明</el-tag>
        <div class="type-item"><span class="type-name">混合模式：</span><span class="type-desc">目标值使用累计值（从年初到当前月的总和），完成值使用当月值（仅统计上个月的完成值）</span></div>
        <div class="type-item"><span class="type-name">累计模式：</span><span class="type-desc">目标值和完成值都使用累计值（从年初到当前月的总和）</span></div>
        <div class="type-item"><span class="type-name">当月模式：</span><span class="type-desc">目标值和完成值都使用当月值（仅统计上个月的数据）</span></div>
      </div>
      <el-table
        v-loading="loading"
        :data="flatTableData"
        :span-method="spanMethod"
        :cell-style="tableCellStyle"
        :highlight-current-row="false"
        border
        style="width: 100%"
      >
        <el-table-column label="序号" width="60" align="center">
          <template #default="{ row }">
            {{ row.isFirst ? row.userIndex : "" }}
          </template>
        </el-table-column>
        <el-table-column
          prop="jobNum"
          label="工号"
          width="120"
          align="center"
        />
        <el-table-column
          prop="username"
          label="用户名"
          width="100"
          align="center"
        />
        <el-table-column
          prop="nodeName"
          label="考核组"
          width="160"
          align="center"
        />
        <el-table-column label="指标编号" width="180" align="center">
          <template #default="{ row }">
            {{ row.metric?.metricId }}
          </template>
        </el-table-column>
        <el-table-column label="指标类型" width="120" align="center">
          <template #default="{ row }">
            <template v-if="row.metric">
              {{
                row.metric.metricType === 1
                  ? "定量考核"
                  : row.metric.metricType
              }}
            </template>
          </template>
        </el-table-column>
        <el-table-column label="考核指标" min-width="180">
          <template #default="{ row }">
            {{ row.metric?.targetName }}
          </template>
        </el-table-column>
        <el-table-column label="实际值" width="160">
          <template #default="{ row }">
            {{ getSqlExecNameById(achievedSqlList, getSqlExecIdByType(row.metric?.sqlExecConfig, 'achieved')) }}
          </template>
        </el-table-column>
        <el-table-column label="达成率" width="160">
          <template #default="{ row }">
            {{ getSqlExecNameById(finishingRateSqlList, getSqlExecIdByType(row.metric?.sqlExecConfig, 'finishingRate')) }}
          </template>
        </el-table-column>
        <el-table-column label="计算类型" width="120" align="center">
          <template #default="{ row }">
            {{ getCalculationTypeText(parseOtherConfig(row.metric?.otherConfig).calculationType) }}
          </template>
        </el-table-column>
        <el-table-column label="通知人" min-width="180">
          <template #default="{ row }">
            <template v-if="row.isFirst">
              {{ getNotifyUserNames(row.notifyUserList) }}
            </template>
          </template>
        </el-table-column>
        <el-table-column fixed="right" label="操作" width="180" align="center">
          <template #default="{ row }">
            <template v-if="row.isFirst">
              <el-tooltip content="编辑" placement="top">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="handleEdit(row)"
                >
                  <template #icon>
                    <IconifyIconOffline :icon="RiEditLine" />
                  </template>
                </el-button>
              </el-tooltip>
              <el-tooltip content="生成指标数据" placement="top">
                <el-button
                  link
                  type="success"
                  size="small"
                  @click="handleOpenGenerateDialog(row)"
                >
                  <template #icon>
                    <IconifyIconOffline :icon="RiCalendarEventLine" />
                  </template>
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="handleDelete(row)"
                >
                  <template #icon>
                    <IconifyIconOffline :icon="RiDeleteBinLine" />
                  </template>
                </el-button>
              </el-tooltip>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[2, 10, 20, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <DetailDialog
      v-model="dialogVisible"
      :mode="dialogMode"
      :record-data="currentEditRecord"
      :user-list="userList"
      :user-loading="userLoading"
      :achieved-sql-list="achievedSqlList"
      :finishing-rate-sql-list="finishingRateSqlList"
      @success="handleDialogSuccess"
    />

    <!-- 生成指标数据对话框 -->
    <el-dialog
      v-model="generateDialogVisible"
      title="生成指标数据"
      width="450px"
    >
      <el-form :model="{}" label-position="top">
        <el-form-item label="选择用户">
          <el-input
            :value="currentGenerateUser?.username"
            disabled
            placeholder="选择用户"
          />
        </el-form-item>
        <el-form-item label="添加月份">
          <div class="month-selector">
            <el-date-picker
              v-model="selectedMonth"
              type="month"
              placeholder="选择月份"
              format="YYYY-MM"
              value-format="YYYY-MM"
              style="flex: 1"
            />
            <el-button type="primary" @click="addMonth" style="margin-left: 8px">
              添加
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="已选月份">
          <div class="selected-months">
            <el-tag
              v-for="month in generateMonths"
              :key="month"
              closable
              @close="removeMonth(month)"
              style="margin: 4px"
            >
              {{ month }}
            </el-tag>
            <span v-if="generateMonths.length === 0" style="color: #909399">暂无选择</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="generateDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="generateLoading"
            @click="handleGenerate"
          >
            确定生成
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.kpi-metric-user-container {
  width: 100%;
  gap: 16px;
}

/* 最彻底的方式：强制所有单元格保持背景色，不受 hover 影响 */
:deep(.el-table__cell),
:deep(.el-table__cell:hover),
:deep(.el-table__body tr:hover > td),
:deep(.el-table--enable-row-hover .el-table__body tr:hover > td) {
  background-clip: padding-box;
  transition: none !important;
}

/* 覆盖 Element Plus 的所有 hover 变量 */
:deep(.el-table) {
  --el-table-row-hover-bg-color: transparent !important;
  --el-table-cell-hover-bg-color: transparent !important;
  --el-table-tr-bg-color: transparent !important;
  --el-table-bg-color: transparent !important;
}

.search-section {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
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

.table-section {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.table-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
}

.tip-text {
  font-size: 14px;
  color: #e6a23c;
}

.calculation-type-tip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.type-name {
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
}

.type-desc {
  font-size: 12px;
  color: #606266;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.month-selector {
  display: flex;
  align-items: center;
}

.selected-months {
  min-height: 32px;
  padding: 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
}
</style>
