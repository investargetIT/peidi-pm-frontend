<script setup lang="ts">
import { ref } from "vue";
import ReSegmented from "@/components/ReSegmented";
import Organization from "./components/organization/index.vue";
import TmallRevenue from "./components/tmallRevenue/index.vue";
import MonthlyIndicators from "./components/monthlyIndicators/index.vue";
import KpiMetricUser from "./components/kpiMetricUser/index.vue";

const activeIndex = ref(0);

const options = [
  { label: "组织架构" },
  { label: "天猫收入" },
  { label: "月度指标" },
  { label: "KPI指标用户" }
];

const handleChange = (value: number) => {
  console.log("当前选中:", value);
};
</script>

<template>
  <div class="evaluation-container">
    <!-- 使用 ReSegmented 组件 -->
    <ReSegmented
      v-model="activeIndex"
      :options="options"
      block
      @change="handleChange"
    />

    <!-- 内容区域 -->
    <div class="content-area">
      <div v-show="activeIndex === 0">
        <Organization />
      </div>
      <div v-show="activeIndex === 1">
        <TmallRevenue />
      </div>
      <div v-show="activeIndex === 2">
        <MonthlyIndicators />
      </div>
      <div v-show="activeIndex === 3">
        <KpiMetricUser />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-container {
  // 您的外层自定义样式
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}

.content-area {
  margin-top: 20px;
  min-height: 300px;
}
</style>
