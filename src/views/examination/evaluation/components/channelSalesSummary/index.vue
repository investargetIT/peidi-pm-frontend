<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { getPmKpiShopExaminationGroupStatistics, type ShopExaminationGroupRes, type MonthData } from "@/api/evaluation";
import { processAndExportChannelSales, debugExcelTemplate } from "@/views/examination/utils/exportChannelSales";
import { ElMessage, ElTooltip } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import dayjs from "dayjs";

interface TableRecordItem {
  groupName: string;
  [key: string]: any;
}

const loading = ref(false);
const exportLoading = ref(false);
const groupData = ref<ShopExaminationGroupRes[]>([]);
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

// 调试Excel模板
const handleDebugExcel = async () => {
  try {
    await debugExcelTemplate();
    ElMessage.success("调试完成，请查看控制台");
  } catch (error) {
    console.error("调试失败:", error);
    ElMessage.error("调试失败，请查看控制台");
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
  (newVal) => {
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
            :clearable="false"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item>
          <el-tooltip
            content="导出各渠道销售收款及OBM总营收数据（需要先配置映射表）"
            placement="top"
          >
            <el-button
              style="background-color: #217346; border-color: #217346; color: #ffffff;"
              :loading="exportLoading"
              @click="handleExportChannelSales"
            >
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </el-tooltip>
        </el-form-item>
        <el-form-item>
          <el-button @click="handleDebugExcel">调试Excel模板</el-button>
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
