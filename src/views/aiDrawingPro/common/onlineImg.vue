<script setup lang="ts">
import { ref, watch, inject } from "vue";
import { ElMessage } from "element-plus";
import { getDownloadUrl, downloadFile } from "@/api/aiDraw";
import { type ImageDataResult } from "../utils/compressImage";
import { blobManager } from "../utils/blobManager";

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: "120px"
  }
});

// 注入顶层缓存管理函数
const imageCacheManager = inject("imageCacheManager") as {
  processImageWithCache: (
    url: string,
    callback?: (result: ImageDataResult) => void
  ) => Promise<ImageDataResult>;
  checkImageCache: (url: string) => Promise<boolean>;
  getCompressedImage: (url: string) => Promise<string | null>;
  getOriginalImage: (url: string) => Promise<string | null>;
};

const compressedImageUrl = ref("");
const originalImageUrl = ref("");
const loading = ref(true); // 添加加载状态

// 使用缓存处理图片加载
watch(
  () => props.url,
  async newVal => {
    compressedImageUrl.value = "";
    originalImageUrl.value = "";
    loading.value = true; // 开始加载时显示骨架屏

    if (!newVal) {
      loading.value = false;
      return;
    }

    try {
      // 使用缓存管理函数处理图片
      const isCached = await imageCacheManager.checkImageCache(newVal);

      if (isCached) {
        // 从缓存获取压缩图用于显示
        const compressedImage =
          await imageCacheManager.getCompressedImage(newVal);
        if (compressedImage) {
          compressedImageUrl.value = compressedImage;
        }

        // 从缓存获取原图用于预览
        const originalImage = await imageCacheManager.getOriginalImage(newVal);
        if (originalImage) {
          originalImageUrl.value = originalImage;
        }

        loading.value = false; // 缓存加载完成，隐藏骨架屏
      } else {
        // 缓存中不存在，异步处理图片并缓存
        imageCacheManager.processImageWithCache(newVal);
      }

      // 如果缓存中不存在，获取下载URL用于预览
      if (!isCached) {
        const response: any = await getDownloadUrl({ objectName: newVal });
        if (response.data && response.success) {
          compressedImageUrl.value = response.data;
          originalImageUrl.value = response.data;
          loading.value = false; // 图片加载完成，隐藏骨架屏
        }
      }
    } catch (error) {
      console.error("图片加载失败:", error);
      ElMessage.error("图片加载失败");
      loading.value = false; // 加载失败也要隐藏骨架屏
    }
  },
  {
    immediate: true
  }
);

// 下载图片
const handleDownload = async (src: string) => {
  const message = ElMessage({
    message: "下载中...",
    duration: 0
  });
  const suffix = src.slice(src.lastIndexOf("."));
  const filename = Date.now() + suffix;

  try {
    // 优先从缓存获取原图
    const cachedOriginalImage = await imageCacheManager.getOriginalImage(
      props.url
    );

    if (cachedOriginalImage) {
      // 从缓存下载
      const blob = blobManager.base64ToBlob(cachedOriginalImage);
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
    } else {
      // 缓存中没有，从服务器下载
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
    }
  } catch (error) {
    message.close();
    ElMessage.error("下载失败");
    console.error("下载失败:", error);
  }
};
</script>

<template>
  <el-skeleton
    :style="{ width: props.size, height: props.size }"
    :loading="loading"
    animated
  >
    <template #template>
      <el-skeleton-item
        variant="image"
        :style="{ width: props.size, height: props.size }"
      />
    </template>
    <template #default>
      <el-image
        :src="compressedImageUrl"
        fit="contain"
        preview-teleported
        :previewSrcList="[originalImageUrl]"
        :style="{ width: props.size, height: props.size }"
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
  </el-skeleton>
</template>
