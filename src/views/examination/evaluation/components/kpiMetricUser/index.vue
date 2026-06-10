<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getPmKpiMetricUserPage,
  deletePmKpiMetricUserApi,
  getUserListApi,
  getPmExecSqlListApi
} from "@/api/evaluation";
import DetailDialog from "./components/detailDialog.vue";
import RiAddLine from "@iconify-icons/ri/add-line";
import RiEditLine from "@iconify-icons/ri/edit-line";
import RiDeleteBinLine from "@iconify-icons/ri/delete-bin-line";

interface SqlExecItem {
  type: string;
  sqlExecId: number | string | null;
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
const currentPage = ref(1);
const pageSize = ref(5);

const dialogVisible = ref(false);
const dialogMode = ref<"add" | "edit">("edit");
const currentEditRecord = ref<RecordItem | null>(null);
const userLoading = ref(false);
const userList = ref<UserItem[]>([]);
const sqlLoading = ref(false);
const achievedSqlList = ref<{ id?: string; name?: string }[]>([]);
const finishingRateSqlList = ref<{ id?: string; name?: string }[]>([]);

// 拍平数据用于表格展示（同一用户多条指标合并显示）
const flatTableData = computed<FlatRow[]>(() => {
  const result: FlatRow[] = [];
  let visibleUserIndex = 0;

  tableData.value.forEach(record => {
    // 关闭状态的指标不展示；若用户下没有开启的指标，则该用户整组不展示
    const metrics = (record.metricList || []).filter(metric => metric.status !== 0);
    if (!metrics.length) return;

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
        metric
      });
    });
  });
  return result;
});

// 合并单元格规则：序号、工号、用户名、考核组、操作 按用户合并
const spanMethod = ({
  row,
  columnIndex
}: {
  row: FlatRow;
  columnIndex: number;
}) => {
  if ([0, 1, 2, 3, 9].includes(columnIndex)) {
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

onMounted(() => {
  fetchData();
  fetchSqlLists();
});
</script>

<template>
  <div class="kpi-metric-user-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form :model="searchParams" inline size="default">
        <el-form-item label="用户名">
          <el-input
            v-model="searchParams.username"
            placeholder="请输入用户名"
            clearable
            style="width: 200px"
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
      <el-table
        v-loading="loading"
        :data="flatTableData"
        :span-method="spanMethod"
        border
        stripe
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
        <el-table-column fixed="right" label="操作" width="120" align="center">
          <template #default="{ row }">
            <template v-if="row.isFirst">
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
            </template>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20]"
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
  </div>
</template>

<style scoped>
.kpi-metric-user-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
