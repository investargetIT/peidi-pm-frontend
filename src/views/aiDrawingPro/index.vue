<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref, watch, nextTick } from "vue";

import { ElMessage } from "element-plus";

import { downloadFile } from "@/api/aiDraw";

import { useImageCache } from "./composables/useImageCache";

import Material from "./components/material/index.vue";
import Creative from "./components/creative/index.vue";
import DrawingPro from "./components/drawingPro/index.vue";
import NavBar from "./components/navBar/index.vue";

import { imageCache } from "./utils/imageCache/index";
import { processImageCompression } from "./utils/compressImage/index";
import { blobManager } from "./utils/blobManager";
import { requestQueueManager } from "./utils/requestQueue";

import "./style/reset.scss";
import "./style/element-plus.scss";

import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// 自定义缓存图片类型
export interface ImageCacheData {
  originalBlob: Blob;
  compressedBlob: Blob;
}

// 初始化图片缓存管理器
useImageCache();

const activeTab = ref("Material");
const materialTabRef = ref(null);
const drawingProTabRef = ref(null);
const creativeTabRef = ref(null);

//#region 变更Tabs逻辑
const initDrawingPro = (data: any) => {
  activeTab.value = "DrawingPro";
  drawingProTabRef.value?.initDrawingPro(data);
};
provide("initDrawingPro", initDrawingPro);

const initCreativeStudio = (url: string) => {
  activeTab.value = "Creative";
  nextTick(() => {
    creativeTabRef.value?.initCreativeStudio(url);
  });
  // creativeTabRef.value?.initCreativeStudio(url);
};
provide("initCreativeStudio", initCreativeStudio);
//#endregion

watch(activeTab, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    if (newVal === "Material") {
      materialTabRef.value?.fetchMaterialPage();
    }
    if (newVal === "DrawingPro") {
      drawingProTabRef.value?.clearTableCard();
    }

    // 切换tab时，更新URL参数
    router.push(`${route.path}?tab=${newVal}`);
  }
});

onMounted(() => {
  // 检查是否为首次登录进入
  if (route.query.firstLogin === "true") {
    // 执行需要的初始化操作
    // console.log("首次登录，执行初始化...");

    // 清除 URL 中的 firstLogin 参数，然后刷新页面
    const newQuery = { ...route.query };
    delete newQuery.firstLogin;

    // 使用 replace 清除参数后刷新
    router.replace({ query: newQuery }).then(() => {
      window.location.reload();
    });

    return;
  }

  // 从URL中解析问号后的tab参数
  const tab = route.query.tab as string;
  if (tab) {
    activeTab.value = tab;
  }
});

// 在组件卸载时清理所有 Blob URL
onUnmounted(() => {
  blobManager.releaseAll();
});
</script>

<template>
  <div>
    <el-tabs
      v-model="activeTab"
      type="border-card"
      class="peidi-el-tabs-modern-tabs"
    >
      <el-tab-pane label="素材库" name="Material" lazy>
        <Material ref="materialTabRef" />
      </el-tab-pane>
      <el-tab-pane label="模板编辑器" name="DrawingPro">
        <DrawingPro ref="drawingProTabRef" />
      </el-tab-pane>
      <el-tab-pane label="创意工作室" name="Creative" lazy>
        <Creative ref="creativeTabRef" />
      </el-tab-pane>
    </el-tabs>

    <!-- #region NavBar 用来实现TOKEN过期重登录 -->
    <div>
      <NavBar />
    </div>
    <!-- #endregion -->
  </div>
</template>
