<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { getPmKpiMonthMetricTargetPage } from "@/api/evaluation";
import dayjs from "dayjs";

interface MetricTargetItem {
  id: number | string;
  month: string;
  targetName: string;
  target: number;
  achieved: number;
  nodeId: number | string;
  nodeName: string;
  treePath: string;
  treePathName: string;
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
      // 新格式：records 中每项包含 user 信息 + metricTargetList
      // 展开 metricTargetList，并标记 rowSpan 用于合并单元格
      const flatRecords: RecordItem[] = [];
      for (const record of res.data.records) {
        const userInfo = {
          userId: record.userId,
          jobNum: record.jobNum,
          username: record.username,
          month: record.month
        };
        if (record.metricTargetList && record.metricTargetList.length > 0) {
          for (let i = 0; i < record.metricTargetList.length; i++) {
            const metric = record.metricTargetList[i];
            flatRecords.push({
              ...userInfo,
              ...metric,
              rowSpan: i === 0 ? record.metricTargetList.length : 0,
              groupIndex: i
            });
          }
        }
      }
      tableData.value = flatRecords;
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

// 合并单元格
const objectSpanMethod = ({
  row,
  columnIndex
}: {
  row: RecordItem;
  columnIndex: number;
}) => {
  // 合并公共信息列：序号(0)、月份(1)、负责人(2)
  if (columnIndex <= 2) {
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
        :span-method="objectSpanMethod"
      >
        <el-table-column label="序号" width="60" align="center">
          <template #default="{ $index }">
            {{ getGroupIndex($index) }}
          </template>
        </el-table-column>
        <el-table-column prop="month" label="月份" width="120" align="center">
          <template #default="{ row }">
            {{ row.groupIndex === 0 ? formatMonth(row.month) : '' }}
          </template>
        </el-table-column>
        <el-table-column
          prop="username"
          label="负责人"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            {{ row.groupIndex === 0 ? row.username : '' }}
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
