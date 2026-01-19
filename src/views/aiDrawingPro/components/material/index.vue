<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import RiAddLine from "@iconify-icons/ri/add-line";
import { getMaterialPage } from "@/api/aiDraw";
import { MATERIAL_LIBRARY_TABS } from "../../config/material";
import PictureCard from "./pictureCard.vue";
import DetailForm from "./detailForm.vue";
import ContactForm from "./contactForm.vue";

const radio = ref();
const materialList = ref({});
const cardData = ref([]);
const detailFormRef = ref(null);
const contactFormRef = ref(null);

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

onMounted(() => {
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

const updateCardData = () => {
  cardData.value = materialList.value[radio.value] || [];
  // console.log("cardData.value:", cardData.value);
};

const handleAddMaterial = () => {
  detailFormRef.value.initDetailForm();
};

const handleContact = (data: any) => {
  contactFormRef.value.initContactForm(data);
};
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
  </div>
</template>
