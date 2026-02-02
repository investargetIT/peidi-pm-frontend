<script setup lang="ts">
import { inject, onMounted, provide, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import RiAddLine from "@iconify-icons/ri/add-line";
import { getClickRateTrend, getMaterialPage } from "@/api/aiDraw";
import { MATERIAL_LIBRARY_TABS } from "../../config/material";
import PictureCard from "./pictureCard.vue";
import DetailForm from "./detailForm.vue";
import ContactForm from "./contactForm.vue";
import ClickRateForm from "./clickRateForm.vue";
import dayjs from "dayjs";
import { type ClickRateTrendItem } from "../../type/material";

const initCreativeStudio = inject<Function>("initCreativeStudio");

const radio = ref(null);
const materialList = ref({});
const cardData = ref([]);
const detailFormRef = ref(null);
const contactFormRef = ref(null);
const clickRateFormRef = ref(null);

const updateCardData = () => {
  cardData.value = materialList.value[radio.value] || [];
  // console.log("cardData.value:", cardData.value);
};

const fetchMaterialPage = () => {
  getMaterialPage({
    pageNo: 1,
    pageSize: 9999
  })
    .then((res: any) => {
      if (res.code === 200) {
        const materialListTemp = {};
        res.data.records.forEach((item: any) => {
          const mtype = JSON.parse(item.type)?.mtype;
          if (mtype) {
            if (!materialListTemp[mtype]) {
              materialListTemp[mtype] = [item];
            } else {
              materialListTemp[mtype].push(item);
            }
          }
        });

        materialList.value = materialListTemp;

        if (!radio.value) {
          radio.value = MATERIAL_LIBRARY_TABS[0].name;
        } else {
          updateCardData();
        }
      } else {
        ElMessage.error("获取素材库失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("获取素材库失败:" + error.message);
    });
};

const clickRateTrend = ref({});
provide("clickRateTrend", clickRateTrend);
const fetchClickRateTrend = () => {
  const searchStrTemp = [
    {
      searchName: "date",
      searchType: "betweenStr",
      // 近7天（不包含当前天）
      searchValue: [
        dayjs().subtract(7, "day").format("YYYY-MM-DD"),
        dayjs().subtract(1, "day").format("YYYY-MM-DD")
      ]
        .map(date => dayjs(date).format("YYYY-MM-DD"))
        .join(",")
    }
  ];
  return getClickRateTrend({
    pageNo: 1,
    pageSize: 10e4,
    searchStr: JSON.stringify(searchStrTemp)
  })
    .then((res: any) => {
      if (res.code === 200) {
        const temp = {};
        const firstDay = dayjs().subtract(7, "day").format("YYYY-MM-DD");
        // console.log("天数差:", dayjs().diff(firstDay, "day"));
        // 数据清洗
        res.data.records.forEach((item: ClickRateTrendItem) => {
          const dayIndex = dayjs(item.date).diff(firstDay, "day");

          if (temp[item.unitId]) {
            // 确保索引在有效范围内
            if (dayIndex >= 0 && dayIndex < 7) {
              temp[item.unitId].clickCounts[dayIndex] = item.clickCount;
              temp[item.unitId].conversionRates[dayIndex] = item.conversionRate;
            }
          } else {
            temp[item.unitId] = {
              channel: item.channel,
              imageOss: item.imageOss,
              imageUrl: item.imageUrl,
              productName: item.productName,
              shopName: item.shopName,
              unitId: item.unitId,
              clickCounts: Array(7).fill(0),
              conversionRates: Array(7).fill(0)
            };
            // 设置当前数据点
            if (dayIndex >= 0 && dayIndex < 7) {
              temp[item.unitId].clickCounts[dayIndex] = item.clickCount;
              temp[item.unitId].conversionRates[dayIndex] = item.conversionRate;
            }
          }
        });

        // console.log("获取点击率趋势:", temp);
        clickRateTrend.value = temp;
      } else {
        ElMessage.error("获取点击率趋势失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("获取点击率趋势失败:" + error.message);
    });
};

onMounted(async () => {
  await fetchClickRateTrend();
  fetchMaterialPage();
});

watch(
  radio,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      updateCardData();
    }
  },
  { immediate: true }
);

const handleAddMaterial = () => {
  detailFormRef.value.initDetailForm();
};

const handleContact = (data: any) => {
  contactFormRef.value.initContactForm(data);
};

const handleClickRate = (data: any) => {
  clickRateFormRef.value.initClickRateForm(data);
};

const handleCreate = (data: any) => {
  // console.log("handleCreate:", data);
  if (!data?.objectName) {
    ElMessage.error("素材名称不能为空");
    return;
  }
  initCreativeStudio(data.objectName);
};

defineExpose({
  fetchMaterialPage
});
</script>

<template>
  <div>
    <div class="flex justify-between">
      <el-radio-group v-model="radio">
        <el-radio-button
          v-for="item in MATERIAL_LIBRARY_TABS"
          :key="item.name"
          :label="item.label"
          :value="item.name"
        >
          <div class="w-[100px] text-center">{{ item.label }}</div>
        </el-radio-button>
      </el-radio-group>

      <el-button type="primary" @click="handleAddMaterial">
        <template #icon>
          <IconifyIconOffline :icon="RiAddLine" />
        </template>
        添加素材</el-button
      >
    </div>

    <el-divider />

    <div>
      <el-space wrap :size="'large'">
        <PictureCard
          v-for="item in cardData"
          :key="item.id"
          :data="item"
          :fetchMaterialPage="fetchMaterialPage"
          :handleContact="handleContact"
          :handleCreate="handleCreate"
          :handleClickRate="handleClickRate"
        />
      </el-space>
    </div>

    <div>
      <DetailForm
        ref="detailFormRef"
        :materialList="materialList"
        :fetchMaterialPage="fetchMaterialPage"
        :selectedRadio="radio"
      />
    </div>

    <div>
      <ContactForm
        ref="contactFormRef"
        :materialList="materialList"
        :fetchMaterialPage="fetchMaterialPage"
      />
    </div>

    <div>
      <ClickRateForm
        ref="clickRateFormRef"
        :clickRateTrend="clickRateTrend"
        :fetchMaterialPage="fetchMaterialPage"
      />
    </div>
  </div>
</template>
