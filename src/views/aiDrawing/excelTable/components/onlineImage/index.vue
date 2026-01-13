<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { getDownloadUrl, downloadFile } from "@/api/aiDraw";

const props = defineProps({
  url: {
    type: String,
    required: true
  }
});

const imageUrl = ref("");

watch(
  () => props.url,
  newVal => {
    imageUrl.value = "";
    if (!newVal) {
      return;
    }

    getDownloadUrl({ objectName: newVal }).then((res: any) => {
      imageUrl.value = res.data;
    });
  },
  {
    immediate: true
  }
);

// 下载图片
const handleDownload = (src: string) => {
  // window.open(src, "_blank");
  // return;

  const message = ElMessage({
    message: "下载中...",
    duration: 0
  });
  const suffix = src.slice(src.lastIndexOf("."));
  const filename = Date.now() + suffix;

  downloadFile({ objectName: props.url }).then((res: any) => {
    const blob = res;
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    message.close();
    ElMessage.success("下载完成");
  });
};
</script>

<template>
  <el-image
    :src="imageUrl"
    fit="contain"
    class="w-[70px] h-[70px]"
    preview-teleported
    :previewSrcList="[imageUrl]"
  >
    <template
      #toolbar="{ actions, prev, next, reset, activeIndex, setActiveItem }"
    >
      <el-icon @click="actions('zoomOut')">
        <ZoomOut />
      </el-icon>
      <el-icon
        @click="
          actions('zoomIn', {
            enableTransition: false,
            zoomRate: 2
          })
        "
      >
        <ZoomIn />
      </el-icon>
      <el-icon @click="actions('anticlockwise')">
        <RefreshLeft />
      </el-icon>
      <el-icon @click="reset">
        <Refresh />
      </el-icon>
      <el-icon @click="handleDownload(props.url)">
        <Download />
      </el-icon>
    </template>
  </el-image>
</template>
