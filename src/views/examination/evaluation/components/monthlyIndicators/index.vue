<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { getPmKpiMonthMetricTargetPage } from "@/api/evaluation";
import dayjs from "dayjs";

interface RecordItem {
  id: number;
  username: string;
  month: string;
  targetName: string;
  target: number;
  achieved: number;
  nodeId: number;
  nodeName: string;
  treePath: string;
  treePathName: string;
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

const loading = ref(false);
const tableData = ref<RecordItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// 搜索条件
const searchParams = ref({
  username: "",
  treePathName: "",
  startDate: "",
  endDate: ""
});

const fetchData = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiMonthMetricTargetPage({
      username: searchParams.value.username || undefined,
      treePathName: searchParams.value.treePathName || undefined,
      startDate: searchParams.value.startDate || undefined,
      endDate: searchParams.value.endDate || undefined,
      pageNo: currentPage.value,
      pageSize: pageSize.value
    })) as ApiResponse;
    if (res.success && res.data) {
      tableData.value = res.data.records;
      total.value = res.data.total;
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
    startDate: "",
    endDate: ""
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

// 计算完成率
const getCompletionRate = (target: number, achieved: number) => {
  if (!target || target === 0) return "-";
  const rate = (achieved / target) * 100;
  return rate.toFixed(2) + "%";
};

// 根据完成率返回样式
const getRateClass = (target: number, achieved: number) => {
  if (!target || target === 0) return "";
  const rate = achieved / target;
  if (rate >= 1) return "rate-excellent";
  if (rate >= 0.8) return "rate-good";
  return "rate-poor";
};

// 格式化月份
const formatMonth = (dateStr: string) => {
  if (!dateStr) return "-";
  return dayjs(dateStr).format("YYYY-MM");
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="monthly-indicators-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form :model="searchParams" inline size="default">
        <el-form-item label="负责人">
          <el-input
            v-model="searchParams.username"
            placeholder="请输入负责人"
            clearable
            style="width: 200px"
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
        <el-form-item label="开始月份">
          <el-date-picker
            v-model="searchParams.startDate"
            type="month"
            placeholder="选择开始月份"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="结束月份">
          <el-date-picker
            v-model="searchParams.endDate"
            type="month"
            placeholder="选择结束月份"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="month" label="月份" width="120" align="center">
          <template #default="{ row }">
            {{ formatMonth(row.month) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="username"
          label="负责人"
          width="100"
          align="center"
        />
        <el-table-column prop="nodeName" label="岗位" min-width="140" />
        <el-table-column
          prop="treePathName"
          label="组织路径"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          prop="targetName"
          label="指标名称"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          prop="target"
          label="目标值"
          width="140"
          align="right"
        />
        <el-table-column
          prop="achieved"
          label="实际值"
          width="140"
          align="right"
        />
        <el-table-column label="完成率" width="140" align="center">
          <template #default="{ row }">
            <span :class="getRateClass(row.target, row.achieved)">
              {{ getCompletionRate(row.target, row.achieved) }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.monthly-indicators-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
