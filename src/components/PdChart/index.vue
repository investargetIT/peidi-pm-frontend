<script setup lang="ts">
import * as echarts from "echarts";
import "echarts-wordcloud";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

// props
const props = defineProps({
  // name用于图表的初始化
  name: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ""
  },
  text: {
    type: String,
    default: ""
  },
  option: {
    type: Object,
    default: () => ({})
  },
  style: {
    type: Object,
    default: () => ({ width: "700px" })
  },
  shadow: {
    // 枚举类型
    type: String as PropType<"always" | "never" | "hover">,
    default: "never"
  },
  // 是否计算高度
  calcHeight: {
    type: Number,
    default: 100
  }
});

const chartId = props.name + new Date().getTime();
// 注意，不能用ref 不然会导致tooltip失效等问题
let myChart: echarts.ECharts | null = null;
// 存储ResizeObserver实例
let resizeObserver: ResizeObserver | null = null;
// 存储容器元素引用
const chartContainerRef = ref<HTMLElement | null>(null);

onMounted(() => {
  const chartDom = document.getElementById(chartId);
  if (!chartDom) return;

  myChart = echarts.init(chartDom);
  props.option && myChart.setOption(props.option, true);

  // 创建ResizeObserver监听容器尺寸变化
  resizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const { width } = entry.contentRect;
      if (myChart && width > 0) {
        // 当宽度变化时，重新调整图表大小
        myChart.resize();
      }
    }
  });

  // 获取图表容器并开始观察
  const container = chartDom.parentElement;
  if (container) {
    chartContainerRef.value = container;
    resizeObserver.observe(container);
  }
});

// 监听option变化，实现响应式更新
watch(
  () => props.option,
  newOption => {
    if (myChart && newOption) {
      myChart.setOption(newOption, true);
    }
  },
  { deep: true }
);

// 组件销毁时清理图表实例
onUnmounted(() => {
  if (myChart) {
    myChart.dispose();
    myChart = null;
  }

  // 停止观察并清理ResizeObserver
  if (resizeObserver && chartContainerRef.value) {
    resizeObserver.unobserve(chartContainerRef.value);
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

// 计算属性 来计算图表的最低高度
const chartMinHeight = computed(() => {
  if (!props.style.height) return "450px";
  return (
    props.style.height.replace("px", "") - props.calcHeight + "px" || "450px"
  );
});
</script>

<template>
  <el-card :shadow="shadow" :style="style">
    <div class="text-[16px] font-bold text-[#09090B]">{{ title }}</div>
    <div class="text-[14px] text-[#71717a]">{{ text }}</div>
    <!-- 自定义内容插槽 -->
    <slot name="custom-content" />
    <!-- 图表容器 id用时间戳拼接 -->
    <!-- 最低高度用card高度减去标题和文本的高度 style.height可以带px 需要截取px前的数字 -->
    <div
      :id="chartId"
      :style="{
        minHeight: chartMinHeight
      }"
    />
  </el-card>
</template>
