<script setup lang="ts">
import {
  getDesignerExaminationRecordResult,
  getActiveDesignersWithRequests
} from "@/api/pmApi";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import { computed, onMounted, ref, watch } from "vue";
import { exportToExcel } from "./utils/export";
import { Upload } from "@element-plus/icons-vue";

// const tableList = ref([]);
const tableList = computed(() => [
  ...designerExaminationData.value,
  ...activeDesignersData.value
]);
const designerExaminationData = ref([]);
const activeDesignersData = ref([]); // 新添加的用于存储活跃设计师数据

const selectedMonth = ref(dayjs().subtract(1, "month").format("YYYY-MM"));
// 禁用当月之后的每个月
const disabledDate = time => {
  // 获取当月的第一天
  const currentMonth = dayjs().startOf("month");
  // 如果选择的日期在当月之后，则禁用
  return dayjs(time).isAfter(currentMonth, "month");
};

//#region 请求相关
const fetchData = () => {
  getDesignerExaminationRecordResult({
    // 月结束时间
    end: dayjs(selectedMonth.value)
      .endOf("month")
      .format("YYYY-MM-DD 23:59:59"),
    // 月开始时间
    start: dayjs(selectedMonth.value)
      .startOf("month")
      .format("YYYY-MM-DD 00:00:00")
  })
    .then((res: any) => {
      if (res.code === 200) {
        // console.log("设计考核记录结果:", res.data);
        designerExaminationData.value = (res.data || []).map(item => {
          const taskList = item.taskList || [];
          const totalCnt = taskList.length;
          // 有endTime就算完成
          const completeCnt = taskList.filter(task => {
            return task.endTime;
          }).length;
          const completeRate =
            totalCnt > 0
              ? Math.round((completeCnt / totalCnt) * 100) + "%"
              : "100%";

          return {
            name: item.userName,
            cnt: totalCnt,
            completeCnt: completeCnt,
            completeRate: completeRate
          };
        });
      } else {
        ElMessage.error("获取设计考核记录结果失败：" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("获取设计考核记录结果失败：" + err?.message);
    });
};

const fetchActiveDesigners = () => {
  getActiveDesignersWithRequests({
    startDate: dayjs(selectedMonth.value)
      .startOf("month")
      .format("YYYY-MM-DD 00:00:00"),
    endDate: dayjs(selectedMonth.value)
      .endOf("month")
      .format("YYYY-MM-DD 23:59:59")
  })
    .then((res: any) => {
      if (res.code === 200) {
        console.log("活跃设计师数据:", res.data);
        activeDesignersData.value = (res.data || []).map(item => {
          const monthStart = dayjs(selectedMonth.value).startOf("month");
          const monthEnd = dayjs(selectedMonth.value).endOf("month");

          const filteredRequests = (item.requests || []).filter(request => {
            // 筛选掉状态为CLOSE的
            if (request.status === "CLOSE") return false;

            // 如果没有endAt，保留（未完成的任务）
            if (!request.endAt) return true;

            // 有endAt的，只保留在当前月份的
            const endAtDate = dayjs(request.endAt);
            return (
              endAtDate.isAfter(monthStart) && endAtDate.isBefore(monthEnd)
            );
          });
          // 按id去重
          const requestMap = new Map();
          filteredRequests.forEach(request => {
            if (request.id !== undefined && request.id !== null) {
              requestMap.set(request.id, request);
            }
          });
          const requests = Array.from(requestMap.values());
          const totalCnt = requests.length;
          // 有endAt就算完成
          const completeCnt = requests.filter(request => {
            return request.endAt;
          }).length;
          const completeRate =
            totalCnt > 0
              ? Math.round((completeCnt / totalCnt) * 100) + "%"
              : "100%";

          return {
            name: item.userName,
            cnt: totalCnt,
            completeCnt: completeCnt,
            completeRate: completeRate
          };
        });
      } else {
        ElMessage.error("获取活跃设计师数据失败：" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("获取活跃设计师数据失败：" + err?.message);
    });
};
//#endregion

//#region 导出功能
const handleExport = async () => {
  if (!tableList.value || tableList.value.length === 0) {
    ElMessage.warning("暂无数据可导出");
    return;
  }

  try {
    const columns = [
      { prop: "name", label: "姓名", width: 20 },
      { prop: "cnt", label: "任务数", width: 15 },
      { prop: "completeCnt", label: "完成数", width: 15 },
      { prop: "completeRate", label: "完成度", width: 15 }
    ];

    await exportToExcel(
      tableList.value,
      columns,
      "设计考核记录 " + selectedMonth.value,
      "考核记录"
    );

    ElMessage.success("导出成功");
  } catch (error) {
    ElMessage.error("导出失败：" + error);
  }
};
//#endregion

watch(
  selectedMonth,
  (newMonth, oldMonth) => {
    if (newMonth) {
      fetchData();
      fetchActiveDesigners();
    }
  },
  { immediate: true }
);
</script>

<style lang="scss" scoped>
.designer-container {
  width: 100%;
}

.rules-notice {
  background-color: #ecf5ff;
  border-left: 4px solid #409eff;
  color: #409eff;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;

  @media (max-width: 768px) {
    padding: 12px;
    margin-bottom: 12px;
  }
}

.notice-title {
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 15px;

  @media (max-width: 768px) {
    font-size: 14px;
  }
}

.notice-content {
  font-size: 14px;
  line-height: 1.6;

  p {
    margin: 4px 0;
  }

  @media (max-width: 768px) {
    font-size: 13px;
  }
}

.controls-bar {
  margin: 12px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;

  /* 清除按钮边距 */
  :deep(.el-button) {
    margin-left: 0 !important;
  }

  @media (max-width: 768px) {
    margin: 10px 0;
    flex-direction: column;
    align-items: stretch;
  }
}

.month-picker {
  @media (max-width: 768px) {
    width: 100%;
  }
}

.export-btn {
  @media (max-width: 768px) {
    width: 100%;
  }
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  @media (max-width: 768px) {
    border-radius: 4px;
  }
}

.designer-table {
  width: 100%;
  min-width: 400px;
}
</style>

<template>
  <div>
    <!-- 规则说明 -->
    <div
      class="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-4 rounded"
    >
      <div class="font-bold mb-2">📋 统计规则说明：</div>
      <div class="text-sm space-y-1">
        <!-- <p>1. 逾期也算完成</p> -->
         <p>1. PM系统当月任务数按截止日期算</p>
         <p>2. 设计师系统以“确认完成日期”而非“需求截止日期”计入当月绩效。任务在哪个月确认完成，就算作哪个月的绩效（例如：截止日期为6月的任务，若在5月确认完成，则计入5月绩效）。</p>
      </div>
    </div>
    <div class="mt-[12px] mb-[12px] flex justify-between items-center">
      <!-- 月份选择器 -->
      <el-date-picker
        v-model="selectedMonth"
        type="month"
        placeholder="选择月份"
        :clearable="false"
        :disabled-date="disabledDate"
      />
      <el-button type="primary" @click="handleExport" :icon="Upload">
        <i class="el-icon-download"></i>
        导出数据
      </el-button>
    </div>
    <el-table :data="tableList" border style="width: 100%">
      <el-table-column label="姓名" prop="name" />
      <el-table-column label="任务数" prop="cnt" />
      <el-table-column label="完成数" prop="completeCnt" />
      <el-table-column label="完成度" prop="completeRate" />
    </el-table>
  </div>
</template>
