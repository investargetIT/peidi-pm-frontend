<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { getPmKpiMetricUserPage, getUserListApi } from "@/api/evaluation";

interface RecordItem {
  id: number;
  userId: number;
  jobNum: string;
  metricConfigId: number;
  username: string;
  metricType: number;
  targetName: string;
  metricId: string;
  kpiDepict: string;
  rate: string;
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

onMounted(() => {
  fetchData();
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
          prop="metricId"
          label="指标ID"
          width="180"
          align="center"
        />
        <el-table-column
          prop="metricType"
          label="指标类型"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ row.metricType === 1 ? "定量考核" : row.metricType }}
          </template>
        </el-table-column>
        <el-table-column prop="targetName" label="指标名称" min-width="180" />
        <el-table-column
          prop="kpiDepict"
          label="KPI描述"
          min-width="250"
          show-overflow-tooltip
        />
        <el-table-column
          prop="rate"
          label="系数规则"
          min-width="250"
          show-overflow-tooltip
        />
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
</style>
