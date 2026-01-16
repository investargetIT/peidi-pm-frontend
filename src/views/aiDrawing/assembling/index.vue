<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick, inject } from "vue";
import { ElMessage } from "element-plus";
import DEFAULT_IMG from "../editDialog/imgs/default.png";
import { ExcelTableItem } from "../excelTable/type";
import { snapdom } from "@zumer/snapdom";

// 定义图片数据返回类型
interface ImageDataResult {
  originalBlob: string; // 原图base64数据
  compressedBlob: string; // 压缩图base64数据
}

// 注入顶层缓存管理函数
const imageCacheManager = inject("imageCacheManager") as {
  processImageWithCache: (
    imageUrl: string,
    callback?: (result: ImageDataResult) => void
  ) => Promise<ImageDataResult>;
  clearImageCache: (imageUrl: string) => Promise<boolean>;
  clearAllImageCache: () => Promise<boolean>;
  checkImageCache: (imageUrl: string) => Promise<boolean>;
  getCompressedImage: (imageUrl: string) => Promise<string | null>;
  getOriginalImage: (imageUrl: string) => Promise<string | null>;
};

const props = defineProps({
  templateImg: {
    type: String,
    required: true
  },
  templateRow: {
    type: Object as () => ExcelTableItem,
    required: true
  }
});

const assemblingVisible = ref(false);
// 模板图片base64
const templateImgBase64 = ref(DEFAULT_IMG);
const productImgBase64 = ref(DEFAULT_IMG);
const fullGiftImgsBase64 = ref<string[]>([]);

// 智能计算图片位置的函数
const getImagePosition = computed(() => {
  return (index: number) => {
    const totalImages = fullGiftImgsBase64.value.length;

    if (totalImages === 0) return { left: "0px" };

    // 容器宽度为260px，图片高度为150px，假设图片宽度约为100px
    const containerWidth = 260;
    const estimatedImageWidth = 100;

    if (totalImages === 1) {
      // 只有1张图：居中显示
      return { left: `${(containerWidth - estimatedImageWidth) / 2}px` };
    } else if (totalImages <= 4) {
      // 2-4张图：均匀分布
      const spacing =
        (containerWidth - estimatedImageWidth) / (totalImages - 1);
      return { left: `${index * spacing}px` };
    } else {
      // 5张图及以上：重叠分布，每张图偏移15px
      const overlapOffset = 35;
      return { left: `${index * overlapOffset}px` };
    }
  };
});

// 监听templateImg变化
watch(
  () => props.templateImg,
  () => {
    if (!assemblingVisible.value) return;
    templateImgBase64.value = DEFAULT_IMG;

    // 使用缓存管理函数加载底图
    imageCacheManager.processImageWithCache(props.templateImg, result => {
      templateImgBase64.value = result.originalBlob;
    });
  }
);

watch(
  () => props.templateRow,
  () => {
    if (!assemblingVisible.value) return;
    productImgBase64.value = DEFAULT_IMG;
    fullGiftImgsBase64.value = new Array(
      props.templateRow.fullGiftImages.length
    ).fill(DEFAULT_IMG);

    console.log("模板行数据:", props.templateRow);

    // 使用缓存管理函数加载产品图片
    if (
      props.templateRow.productImage &&
      props.templateRow.productImage.length > 0
    ) {
      imageCacheManager.processImageWithCache(
        props.templateRow.productImage[0],
        result => {
          productImgBase64.value = result.originalBlob;
        }
      );
    }

    // 批量加载赠品图片
    if (
      props.templateRow.fullGiftImages &&
      props.templateRow.fullGiftImages.length > 0
    ) {
      // 由于缓存管理器没有processImagesWithCache函数，改为逐个加载
      props.templateRow.fullGiftImages.forEach((imageUrl, index) => {
        imageCacheManager.processImageWithCache(imageUrl, result => {
          fullGiftImgsBase64.value[index] = result.originalBlob;
        });
      });
    }
  },
  {
    deep: true
  }
);

const exportContainer = ref(null);
const exportPNGLoading = ref(false);
// 导出为PNG
const exportAsPNG = () => {
  exportPNGLoading.value = true;
  handleCapture();
};
const handleCapture = async () => {
  const message = ElMessage({
    message: "正在捕获图片，请稍后...",
    type: "info",
    duration: 0
  });
  if (!exportContainer.value) {
    exportPNGLoading.value = false;
    return;
  }

  try {
    // 核心捕获逻辑
    const capture = await snapdom(exportContainer.value, {
      scale: 1,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff",
      embedFonts: true // 嵌入字体，确保文本样式正确
    });

    // 获取PNG图像
    const img = await capture.toPng();

    // 可选：自动下载
    await capture.download({
      //@ts-ignore
      format: "png",
      filename: "AI_Generated_Image"
    });
  } catch (err) {
    console.error("Capture error:", err);
  } finally {
    message.close();
    ElMessage.success("图片捕获成功");
    exportPNGLoading.value = false;
  }
};

defineExpose({
  open() {
    assemblingVisible.value = true;
  }
});
</script>

<template>
  <div>
    <el-dialog
      v-model="assemblingVisible"
      title=""
      width="1200"
      append-to-body
      :close-on-click-modal="false"
    >
      <div class="export-container" ref="exportContainer">
        <img
          :src="templateImgBase64"
          alt="模板图片"
          style="width: 100%; height: auto"
        />
        <div class="product-img-container">
          <img :src="productImgBase64" alt="产品图片" class="product-img" />
        </div>

        <div class="full-gift-img-container">
          <img
            v-for="(img, index) in fullGiftImgsBase64"
            :key="index"
            :src="img"
            alt="赠品图片"
            :style="getImagePosition(index)"
          />
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            type="primary"
            @click="exportAsPNG"
            :loading="exportPNGLoading"
          >
            导出PNG
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.export-container {
  display: flex; /* 添加flex布局 */
  align-items: flex-start; /* 顶部对齐 */
  position: relative;
}

.product-img-container {
  position: absolute;
  top: 420px;
  left: 390px;
  width: 750px;
  height: 500px;
  // background-color: red;
  display: flex;
  justify-content: center;
  align-items: end;

  .product-img {
    max-width: 100%;
    max-height: 100%;
  }
}

.full-gift-img-container {
  position: absolute;
  top: 645px;
  left: 100px;
  // background-color: red;
  width: 260px;
  height: 150px;
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    width: auto;
    height: 150px;
    position: absolute;
  }
}
</style>
