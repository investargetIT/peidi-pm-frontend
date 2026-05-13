<script setup lang="ts">
import { ref } from "vue";
import ReSegmented from "@/components/ReSegmented";
import Organization from "./components/organization/index.vue";
import TmallRevenue from "./components/tmallRevenue/index.vue";
import MonthlyIndicators from "./components/monthlyIndicators/index.vue";

const activeIndex = ref(0);

const options = [
  { label: "组织架构" },
  { label: "天猫收入" },
  { label: "月度指标" },
  { label: "标签4" },
  { label: "标签5" },
  { label: "标签6" },
  { label: "标签7" },
  { label: "标签8" },
  { label: "标签9" },
  { label: "标签10" }
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
        <p>内容4</p>
      </div>
      <div v-show="activeIndex === 4">
        <p>内容5</p>
      </div>
      <div v-show="activeIndex === 5">
        <p>内容6</p>
      </div>
      <div v-show="activeIndex === 6">
        <p>内容7</p>
      </div>
      <div v-show="activeIndex === 7">
        <p>内容8</p>
      </div>
      <div v-show="activeIndex === 8">
        <p>内容9</p>
      </div>
      <div v-show="activeIndex === 9">
        <p>内容10</p>
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
