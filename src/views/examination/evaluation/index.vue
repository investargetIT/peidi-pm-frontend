<script setup lang="ts">
import { ref, watch } from "vue";
import ReSegmented from "@/components/ReSegmented";
import Organization from "./components/organization/index.vue";
import TmallRevenue from "./components/tmallRevenue/index.vue";
import MonthlyIndicators from "./components/monthlyIndicators/index.vue";
import KpiMetricUser from "./components/kpiMetricUser/index.vue";

const STORAGE_KEY = "evaluation-active-index";

const getStoredIndex = (): number => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const index = Number(stored);
    if (!isNaN(index) && index >= 0 && index <= 3) {
      return index;
    }
  }
  return 0;
};

const activeIndex = ref(getStoredIndex());

const options = [
  { label: "组织架构" },
  { label: "天猫收入" },
  { label: "月度指标" },
  { label: "KPI指标用户" }
];

watch(activeIndex, val => {
  sessionStorage.setItem(STORAGE_KEY, String(val));
});

const handleChange = (value: number) => {
  console.log("当前选中:", value);
  sessionStorage.setItem(STORAGE_KEY, String(value));
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
      <div v-if="activeIndex === 0">
        <Organization />
      </div>
      <div v-if="activeIndex === 1">
        <TmallRevenue />
      </div>
      <div v-if="activeIndex === 2">
        <MonthlyIndicators />
      </div>
      <div v-if="activeIndex === 3">
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
