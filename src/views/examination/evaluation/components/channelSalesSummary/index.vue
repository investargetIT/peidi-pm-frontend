<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import {
  getPmKpiShopExaminationGroupStatistics,
  type ShopExaminationGroupRes,
  type MonthData
} from "@/api/evaluation";
import { processAndExportChannelSales } from "@/views/examination/utils/exportChannelSales";
import { ElMessage, ElTooltip } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import dayjs from "dayjs";

interface TableRecordItem {
  groupName: string;
  dataType: string;
  rowKey: string;
  [key: string]: any;
}

const loading = ref(false);
const exportLoading = ref(false);
const groupData = ref<ShopExaminationGroupRes[]>([]);

// 检测是否为移动端
const isMobile = ref(window.innerWidth <= 768);

// 监听窗口大小变化
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768;
  });
}
const selectedYear = ref<string | number>(String(dayjs().year()));

// 导出各渠道销售数据
const handleExportChannelSales = async () => {
  try {
    exportLoading.value = true;
    const result = await processAndExportChannelSales(
      undefined,
      undefined,
      Number(selectedYear.value)
    );
    ElMessage.success(result.message || "各渠道销售数据导出成功");
  } catch (error) {
    console.error("各渠道销售数据导出失败:", error);
    ElMessage.error("导出失败，请查看控制台");
  } finally {
    exportLoading.value = false;
  }
};

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
      year: Number(selectedYear.value)
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
  selectedYear.value = String(dayjs().year());
  fetchData();
};

// 监听 selectedYear，确保始终有值
watch(
  () => selectedYear.value,
  newVal => {
    if (!newVal) {
      selectedYear.value = String(dayjs().year());
    }
  }
);

// 格式化金额
const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// 计算需要合并的行
const getSpanMethod = ({ row, column, rowIndex, columnIndex }: any) => {
  if (columnIndex === 0) {
    // 第一列（序号）需要合并
    const dataType = row.dataType;
    if (dataType === "含税收入") {
      // 含税收入行占2行
      return {
        rowspan: 2,
        colspan: 1
      };
    } else {
      // 销售收款行不显示（被合并）
      return {
        rowspan: 0,
        colspan: 0
      };
    }
  }
  if (columnIndex === 1) {
    // 第二列（分组名称）需要合并
    const dataType = row.dataType;
    if (dataType === "含税收入") {
      // 含税收入行占2行
      return {
        rowspan: 2,
        colspan: 1
      };
    } else {
      // 销售收款行不显示（被合并）
      return {
        rowspan: 0,
        colspan: 0
      };
    }
  }
  // 其他列正常显示
  return {
    rowspan: 1,
    colspan: 1
  };
};

// 将数据转换为表格格式（每个渠道两行：含税收入、销售收款）
const tableData = computed<TableRecordItem[]>(() => {
  const result: TableRecordItem[] = [];

  groupData.value.forEach(group => {
    const groupName = group.groupName || "";

    // 第一行：含税收入
    const taxedIncomeRow: TableRecordItem = {
      groupName,
      dataType: "含税收入",
      rowKey: `${groupName}-taxedIncome`
    };

    // 第二行：销售收款
    const salesCollectionRow: TableRecordItem = {
      groupName,
      dataType: "销售收款",
      rowKey: `${groupName}-salesCollection`
    };

    // 为每个月份添加数据
    allMonths.value.forEach(month => {
      const monthData = group.monthData?.find(m => m.month === month);
      taxedIncomeRow[month] = monthData?.taxedIncome;
      salesCollectionRow[month] = monthData?.salesCollection;
    });

    result.push(taxedIncomeRow, salesCollectionRow);
  });

  return result;
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
            :clearable="false"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item>
          <el-tooltip
            content="导出各渠道销售收款及OBM总营收数据"
            placement="top"
          >
            <el-button
              style="
                background-color: #217346;
                border-color: #217346;
                color: #ffffff;
              "
              :loading="exportLoading"
              @click="handleExportChannelSales"
            >
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </el-tooltip>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <div class="table-wrapper">
        <el-table
          v-loading="loading"
          :data="tableData"
          :span-method="getSpanMethod"
          border
          stripe
          class="channel-table"
          :row-key="'rowKey'"
        >
          <el-table-column label="序号" width="60" align="center">
            <template #default="{ $index }">
              {{ Math.floor($index / 2) + 1 }}
            </template>
          </el-table-column>
          <el-table-column prop="groupName" label="分组名称" min-width="200" />
          <el-table-column prop="dataType" label="数据类型" width="120" />

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

  /* 清除所有按钮的左边距 */
  :deep(.el-button) {
    margin-left: 0 !important;
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

/* 确保所有按钮在移动端都没有左边距 */
@media (max-width: 768px) {
  .search-section {
    :deep(.el-button) {
      margin-left: 0 !important;
    }
  }
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

/* 响应式样式 */
@media (max-width: 768px) {
  .search-section {
    padding: 12px;
  }

  .search-section :deep(.el-form) {
    flex-direction: column;
    align-items: stretch;
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

  .search-section :deep(.el-date-picker),
  .search-section :deep(.el-button) {
    width: 100% !important;
  }

  .table-section {
    padding: 12px;
  }

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
