<script setup lang="ts">
import { ref, watch } from "vue";
import { downloadFile } from "@/api/aiDraw";
import { ElMessage } from "element-plus";
import { snapdom } from "@zumer/snapdom";
import { nextTick } from "vue";
import { blobManager } from "../utils/blobManager";

const props = defineProps({
  url: {
    type: String,
    default: ""
  },
  size: {
    type: String,
    default: "120px"
  }
});

const imageUrl = ref("");
const isLoading = ref(false);
const exportSize = ref("800");
const exportContainer = ref<HTMLElement | null>(null);

// 监听 url 变化并请求图片
watch(
  () => props.url,
  async newVal => {
    if (!newVal) {
      imageUrl.value = "";
      return;
    }

    isLoading.value = true;

    try {
      const response: any = await downloadFile({ objectName: newVal });
      if (response) {
        imageUrl.value = URL.createObjectURL(response);
      } else {
        imageUrl.value = "";
      }
    } catch (error) {
      console.error("图片加载失败:", error);
      ElMessage.error("图片加载失败");
      imageUrl.value = "";
    } finally {
      isLoading.value = false;
    }
  },
  { immediate: true }
);

//#region 图片预览
const previewVisible = ref(false);
const previewImageUrl = ref("");
const previewLoading = ref(false);

const handlePreview = async () => {
  previewVisible.value = true;
  // 拼接得到 original url
  // 把_thumbnail 替换为_original
  const originalUrl = props.url.replace("_thumbnail", "_original");

  // 请求图片
  previewLoading.value = true;

  try {
    const response: any = await downloadFile({
      objectName: originalUrl
    });
    if (response) {
      // 将 Blob 转换为 Base64
      const reader = new FileReader();
      reader.onloadend = () => {
        previewImageUrl.value = reader.result as string;
      };
      reader.onerror = () => {
        previewImageUrl.value = "";
        ElMessage.error("图片转换失败");
      };
      reader.readAsDataURL(response);
    } else {
      previewImageUrl.value = "";
    }
  } catch (error) {
    console.error("图片加载失败:", error);
    ElMessage.error("图片加载失败");
    previewImageUrl.value = "";
  } finally {
    previewLoading.value = false;
  }
};
//#endregion

const exportAsPNG = async () => {
  const message = ElMessage({
    message: "正在导出图片，请稍后...",
    type: "info",
    duration: 0
  });

  if (!exportContainer.value) {
    ElMessage.error("图片容器未找到");
    message.close();
    return;
  }

  try {
    await nextTick();

    const capture = await snapdom(exportContainer.value, {
      scale: Number(exportSize.value) / 2048,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff"
    });

    await capture.download({
      type: "png",
      filename: `AI_Generated_Image_${exportSize.value}.png`
    });

    message.close();
    ElMessage.success("图片导出成功");
  } catch (err) {
    console.error("Export error:", err);
    message.close();
    ElMessage.error("图片导出失败：" + err);
  }
};
</script>

<template>
  <div>
    <div v-loading="isLoading">
      <div>
        <el-image
          :src="imageUrl"
          fit="contain"
          preview-teleported
          :style="{ width: props.size, height: props.size }"
          @click="handlePreview"
          style="cursor: pointer"
        >
        </el-image>
      </div>
    </div>

    <el-dialog v-model="previewVisible" title="图片预览">
      <div class="flex items-center justify-end mb-4">
        <el-select
          v-model="exportSize"
          placeholder="请选择导出尺寸"
          style="width: 160px; margin-right: 10px"
        >
          <el-option label="800*800" value="800"></el-option>
          <el-option label="1400*1400" value="1400"></el-option>
          <el-option label="2048*2048" value="2048"></el-option>
          <el-option label="4096*4096" value="4096"></el-option>
        </el-select>
        <div>
          <el-button type="primary" @click="exportAsPNG"> 导出 PNG </el-button>
        </div>
      </div>
      <div class="inline-block">
        <img
          ref="exportContainer"
          w-full
          :src="previewImageUrl"
          alt="图片预览"
          v-loading="previewLoading"
        />
      </div>
    </el-dialog>
  </div>
</template>
