<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick } from "vue";
import { ElMessage } from "element-plus";
import { downloadFile } from "@/api/aiDraw";
import DEFAULT_IMG from "../editDialog/imgs/default.png";
import { ExcelTableItem } from "../excelTable/type";
import { snapdom } from "@zumer/snapdom";

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

// 检查是否是URL并转换为base64
async function processTemplateImage(
  img: string,
  callback: (base64: string) => void,
  title: string = "底图"
) {
  if (!img) return;

  const message = ElMessage.info({
    message: `正在加载${title}...`,
    duration: 0
  });
  try {
    const res: any = await downloadFile({ objectName: img });
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
      message.close();
      ElMessage.success(`${title}加载成功`);
    };
    reader.readAsDataURL(res);
  } catch (error) {
    console.error("图片转换失败:", error);
    message.close();
    ElMessage.error(`${title}加载失败，请检查URL是否正确`);
  }
}

// 监听templateImg变化
watch(
  () => props.templateImg,
  () => {
    if (!assemblingVisible.value) return;
    templateImgBase64.value = DEFAULT_IMG;
    processTemplateImage(
      props.templateImg,
      base64 => {
        templateImgBase64.value = base64;
      },
      "底图"
    );
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

    processTemplateImage(
      props.templateRow.productImage[0],
      base64 => {
        productImgBase64.value = base64;
      },
      "产品图片"
    );

    props.templateRow.fullGiftImages.forEach((item, index) => {
      processTemplateImage(
        item,
        base64 => {
          fullGiftImgsBase64.value[index] = base64;
        },
        `赠品图片${index + 1}`
      );
    });
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
}

.product-img-container {
  position: absolute;
  top: 459px;
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
  top: 670px;
  left: 106px;
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
