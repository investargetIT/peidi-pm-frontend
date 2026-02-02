<script setup lang="ts">
import { inject, Ref, ref, watch } from "vue";
import ChartCard from "@/components/PdChart/index.vue";
import { generateID } from "../../utils/general";

const props = defineProps({
  sourceData: {
    type: Object,
    required: true
  }
});

const clickRateTrend = inject<Ref>("clickRateTrend");

const clickRateInfo = ref(null);

const channelDistributionByTotalAmountCards = ref({
  name: "channelDistributionByTotalAmountCards" + generateID(),
  title: "",
  text: "",
  option: {
    tooltip: {
      trigger: "axis",
      formatter: function (params) {
        let html = params[0].axisValue + "<br/>";
        params.forEach(item => {
          html +=
            item.marker + item.seriesName + "：" + (item.value + "%") + "<br/>";
        });
        return html;
      }
    },
    grid: {
      left: "0%", // 减少左侧留白
      right: "0%", // 减少右侧留白
      top: "50px", // 减少顶部留白
      bottom: "20px" // 减少底部留白
    },
    xAxis: {
      type: "category",
      axisTick: {
        show: false
      },
      axisLine: {
        show: false
      },
      axisLabel: {
        textStyle: {
          fontSize: 10 // 设置 X 轴文字大小为 10
        }
      },
      splitLine: {
        show: false
      },
      data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    },
    yAxis: {
      type: "value",
      axisTick: {
        show: false // 不显示坐标轴刻度线
      },
      axisLine: {
        show: false // 不显示坐标轴线
      },
      axisLabel: {
        show: false // 不显示坐标轴上的文字
      },
      splitLine: {
        show: false // 不显示网格线
      }
    },
    series: [
      {
        name: "点击率",
        data: [0, 0, 0, 0, 0, 0, 0],
        type: "line",
        smooth: true,
        markPoint: {
          data: [
            {
              type: "max",
              itemStyle: {
                color: "rgb(34, 197, 94)" // 绿色表示最高点
              },
              symbolSize: 48
            },
            {
              type: "min",
              itemStyle: {
                color: "rgb(239, 68, 68)" // 红色表示最低点
              },
              symbolSize: 48
            }
          ],
          label: {
            color: "#fff", // 标记点文字颜色
            fontSize: 10, // 设置标记点文字大小为 10
            formatter: function (params) {
              return params.value + "%";
            }
          }
        }
      }
    ]
  },
  style: {
    width: "100%",
    borderRadius: "10px",
    border: 0,
    height: "150px"
  },
  calcHeight: 25
});

watch(
  () => props.sourceData,
  newVal => {
    if (newVal) {
      const clickRateInfoTemp = JSON.parse(newVal.type)?.clickRateInfo;
      if (clickRateInfoTemp) {
        clickRateInfo.value = clickRateInfoTemp;
        // console.log("点击率图表:", clickRateInfo.value, clickRateTrend.value);

        if (
          clickRateTrend.value[clickRateInfoTemp.unitId] &&
          clickRateTrend.value[clickRateInfoTemp.unitId].clickCounts.length
        ) {
          channelDistributionByTotalAmountCards.value.option.series[0].data =
            clickRateTrend.value[clickRateInfoTemp.unitId].clickCounts.map(
              item => (item * 100).toFixed(1)
            );
        } else {
          channelDistributionByTotalAmountCards.value.option.series[0].data = [
            0, 0, 0, 0, 0, 0, 0
          ];
        }
      }
    }
  },
  {
    immediate: true
  }
);
</script>

<template>
  <div v-if="clickRateInfo" class="h-[150px]">
    <ChartCard
      :name="channelDistributionByTotalAmountCards.name"
      :title="channelDistributionByTotalAmountCards.title"
      :text="channelDistributionByTotalAmountCards.text"
      :option="channelDistributionByTotalAmountCards.option"
      :style="channelDistributionByTotalAmountCards?.style"
      :calcHeight="channelDistributionByTotalAmountCards?.calcHeight"
    >
      <template #custom-content>
        <p class="text-[12px] text-[#71717a]">点击率趋势</p>
      </template>
    </ChartCard>
  </div>

  <div v-else class="h-[150px]">
    <p class="text-[12px] text-[#EF4444]">
      没有绑定主图，请先点击下方点击率，绑定后查看点击率趋势
    </p>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-card__body) {
  padding: 0;
}
</style>
