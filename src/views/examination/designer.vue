<script setup lang="ts">
import { getDesignerExaminationRecordResult } from "@/api/pmApi";
import dayjs from "dayjs";
import { ElMessage } from "element-plus";
import { onMounted, ref, watch } from "vue";
import { exportToExcel } from "./utils/export";
import { Upload } from "@element-plus/icons-vue";

const tableList = ref([]);

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
    end: dayjs(selectedMonth.value).endOf("month").format("YYYY-MM-DD"),
    // 月开始时间
    start: dayjs(selectedMonth.value).startOf("month").format("YYYY-MM-DD")
  })
    .then((res: any) => {
      if (res.code === 200) {
        // console.log(res);
        // 筛选掉 null 值
        tableList.value = res.data.filter(item => item !== null) || [];
      } else {
        ElMessage.error("获取设计师考核记录结果失败：" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("获取设计师考核记录结果失败：" + err?.message);
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
      { prop: "name", label: "设计师姓名", width: 20 },
      { prop: "cnt", label: "考核结果", width: 15 }
    ];

    await exportToExcel(tableList.value, columns, "设计师考核记录", "考核记录");

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
    }
  },
  { immediate: true }
);
</script>

<template>
  <div>
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
      <el-table-column label="设计师姓名" prop="name" />
      <el-table-column label="考核结果" prop="cnt" />
    </el-table>
  </div>
</template>
