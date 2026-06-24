<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import { getPmKpiShopExaminationGroupStatistics, type ShopExaminationGroupRes, type MonthData } from "@/api/evaluation";
import dayjs from "dayjs";

interface TableRecordItem {
  groupName: string;
  [key: string]: any;
}

const loading = ref(false);
const groupData = ref<ShopExaminationGroupRes[]>([]);
const selectedYear = ref<number>(dayjs().year());

// 获取所有月份列表
const allMonths = computed(() => {
  const months = new Set<string>();
  groupData.value.forEach(group => {
    group.monthData?.forEach(item => {
      if (item.month) {
        months.add(item.month);
      }
    });
  });
  return Array.from(months).sort();
});

const fetchData = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiShopExaminationGroupStatistics({
      year: selectedYear.value
    })) as any;

    if (res.success && res.data) {
      groupData.value = res.data;
    }
  } catch (error) {
    console.error("获取店铺考核分组统计数据失败", error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  fetchData();
};

const handleReset = () => {
  selectedYear.value = dayjs().year();
  fetchData();
};

// 格式化金额
const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// 将数据转换为表格格式
const tableData = computed<TableRecordItem[]>(() => {
  return groupData.value.map(group => {
    const record: TableRecordItem = {
      groupName: group.groupName || ""
    };

    // 为每个月份添加数据
    allMonths.value.forEach(month => {
      const monthData = group.monthData?.find(m => m.month === month);
      record[month] = monthData?.salesCollection;
    });

    return record;
  });
});

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="channel-sales-summary-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form inline size="default">
        <el-form-item label="年份">
          <el-date-picker
            v-model="selectedYear"
            type="year"
            placeholder="选择年份"
            value-format="YYYY"
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
        <el-table-column prop="groupName" label="分组名称" min-width="200" />

        <!-- 动态生成月份列 -->
        <el-table-column
          v-for="month in allMonths"
          :key="month"
          :prop="month"
          :label="month"
          width="180"
          align="right"
        >
          <template #default="{ row }">
            {{ formatCurrency(row[month]) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.channel-sales-summary-container {
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
