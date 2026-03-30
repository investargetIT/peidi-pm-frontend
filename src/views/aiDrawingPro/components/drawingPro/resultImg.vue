<script setup lang="ts">
import imageUrl1 from "@/views/debug/assets/绘图1.png";
import imageUrl2 from "@/views/debug/assets/绘图2.jpg";
import { ref, onMounted, onUnmounted, nextTick, inject } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { snapdom } from "@zumer/snapdom";
import { saveToMaterialLibrary } from "../../utils/operationIogic/saveToMaterialLibrary";
import { loadImage } from "../../utils/imageLoader";
import { type ImageDataResult } from "../../utils/compressImage";
import type { PropType } from "vue";

const props = defineProps({
  errorMsg: {
    type: String,
    required: true
  }
});

const imageCacheManager = inject("imageCacheManager") as {
  processImageWithCache: (
    url: string,
    callback?: (result: ImageDataResult) => void
  ) => Promise<ImageDataResult>;
  checkImageCache: (url: string) => Promise<boolean>;
  getCompressedImage: (url: string) => Promise<string | null>;
  getOriginalImage: (url: string) => Promise<string | null>;
};

const CANVAS_SIZE = 700;
const exportSize = ref("800");

const showStatus = ref(true);
const resultConfig = ref<any>(null);
const resultData = ref<any>(null);
const resultImage = ref<any>(null);
const importedImages = ref<any[]>([]);

const selectedElementId = ref<string | null>(null);
const isDragging = ref(false);
const dragElement = ref<any>(null);
const dragOffset = ref({ x: 0, y: 0 });
const containerRect = ref(null);
const exportContainer = ref<HTMLElement | null>(null);

const materialLoadRequests = ref<Array<{ cancel: () => void }>>([]);

const initResultImg = async (
  config: any,
  data: any,
  base64Url: string,
  aiRefStatus?: Record<string, boolean>
) => {
  console.log("结果图片：", config, data, base64Url, aiRefStatus);
  resultConfig.value = JSON.parse(JSON.stringify(config));
  resultData.value = JSON.parse(JSON.stringify(data));
  resultImage.value = base64Url;
  importedImages.value = [];
  showStatus.value = true;

  await nextTick();
  importMaterialElements(aiRefStatus);
};

const selectElement = (event: MouseEvent, element: any) => {
  event.stopPropagation();

  // 先取消所有元素的选中状态
  resultConfig.value?.forEach((el: any) => {
    el.selected = false;
  });
  importedImages.value.forEach((el: any) => {
    el.selected = false;
  });

  // 再选中当前元素
  element.selected = true;
  selectedElementId.value = element.id;
};

const deselectAll = () => {
  resultConfig.value?.forEach((el: any) => {
    el.selected = false;
  });
  importedImages.value.forEach((el: any) => {
    el.selected = false;
  });
  selectedElementId.value = null;
};

const updateContainerRect = () => {
  const container = document.querySelector(".result-image-container");
  if (container) {
    containerRect.value = container.getBoundingClientRect();
  }
};

const startDrag = (event: MouseEvent, element: any) => {
  event.stopPropagation();
  isDragging.value = true;
  dragElement.value = element;

  // 先取消所有元素的选中状态，再选中当前拖动的元素
  resultConfig.value?.forEach((el: any) => {
    el.selected = false;
  });
  importedImages.value.forEach((el: any) => {
    el.selected = false;
  });
  element.selected = true;
  selectedElementId.value = element.id;

  updateContainerRect();

  if (containerRect.value) {
    const elementRect = {
      left: containerRect.value.left + element.rect.x * CANVAS_SIZE,
      top: containerRect.value.top + element.rect.y * CANVAS_SIZE
    };

    dragOffset.value = {
      x: event.clientX - elementRect.left,
      y: event.clientY - elementRect.top
    };
  }

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  event.preventDefault();
};

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragElement.value || !containerRect.value) return;

  const x = event.clientX - containerRect.value.left - dragOffset.value.x;
  const y = event.clientY - containerRect.value.top - dragOffset.value.y;

  dragElement.value.rect.x = x / CANVAS_SIZE;
  dragElement.value.rect.y = y / CANVAS_SIZE;
};

const handleMouseUp = () => {
  isDragging.value = false;
  dragElement.value = null;
  dragOffset.value = { x: 0, y: 0 };

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
};

const resizeImage = (event: MouseEvent, element: any, direction: string) => {
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = element.rect.width;
  const startHeight = element.rect.height;
  const startXPos = element.rect.x;
  const startYPos = element.rect.y;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;

    switch (direction) {
      case "se":
        element.rect.width = Math.max(0.1, startWidth + deltaX / CANVAS_SIZE);
        element.rect.height = Math.max(0.1, startHeight + deltaY / CANVAS_SIZE);
        break;
      case "sw":
        element.rect.width = Math.max(0.1, startWidth - deltaX / CANVAS_SIZE);
        element.rect.x = startXPos + deltaX / CANVAS_SIZE;
        element.rect.height = Math.max(0.1, startHeight + deltaY / CANVAS_SIZE);
        break;
      case "ne":
        element.rect.width = Math.max(0.1, startWidth + deltaX / CANVAS_SIZE);
        element.rect.y = startYPos + deltaY / CANVAS_SIZE;
        element.rect.height = Math.max(0.1, startHeight - deltaY / CANVAS_SIZE);
        break;
      case "nw":
        element.rect.width = Math.max(0.1, startWidth - deltaX / CANVAS_SIZE);
        element.rect.x = startXPos + deltaX / CANVAS_SIZE;
        element.rect.y = startYPos + deltaY / CANVAS_SIZE;
        element.rect.height = Math.max(0.1, startHeight - deltaY / CANVAS_SIZE);
        break;
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

const deleteImageElement = (event: MouseEvent, elementId: string) => {
  event.stopPropagation();
  const index = resultConfig.value?.findIndex((el: any) => el.id === elementId);
  if (index !== -1) {
    resultConfig.value.splice(index, 1);
  }
  selectedElementId.value = null;
};

const importMaterialElements = async (
  aiRefStatus?: Record<string, boolean>
) => {
  const status = aiRefStatus;

  if (!resultConfig.value || !resultData.value) {
    return;
  }

  importedImages.value = [];

  const imageConfigs = resultConfig.value.filter(
    (el: any) => el.type === "image"
  );

  // console.log("imageConfigs", imageConfigs);

  for (const config of imageConfigs) {
    const imageData = resultData.value[config.id];
    const isAiReferenced = status[config.id];

    // console.log("imageData", isAiReferenced);

    if (imageData && !isAiReferenced) {
      const newImageElement = {
        id: config.id,
        type: "image",
        rect: { ...config.rect },
        src: imageData,
        selected: false,
        name: config.name
      };

      importedImages.value.push(newImageElement);
    }
  }

  const successfulLoads = importedImages.value.length;
  const totalMaterials = imageConfigs.length;

  if (successfulLoads > 0) {
    ElMessage.success(`成功导入 ${successfulLoads} 个素材`);
  } else if (totalMaterials > 0) {
    ElMessage.info("没有找到可导入的素材");
  }
};

const importImage = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/jpg";

  input.onchange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          const img = new Image();
          img.onload = () => {
            const scale = 0.2;
            const newImageElement = {
              id: "img_" + Date.now(),
              type: "image",
              rect: {
                x: 50 / CANVAS_SIZE,
                y: 50 / CANVAS_SIZE,
                width: (Math.min(img.width, 200) / CANVAS_SIZE) * scale,
                height: (Math.min(img.height, 200) / CANVAS_SIZE) * scale
              },
              src: event.target.result,
              selected: false,
              name: file.name
            };

            // 添加到 importedImages 数组而不是 resultConfig
            importedImages.value.push(newImageElement);
            ElMessage.success("图片导入成功");
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        ElMessage.error("请选择图片文件");
      }
    }
  };

  input.click();
};

const handleSaveToMaterialLibraryClick = async () => {
  const message = ElMessage({
    message: "正在捕获图片，请稍后...",
    type: "info",
    duration: 0
  });

  if (!exportContainer.value) {
    ElMessage.error("图片容器未找到");
    message.close();
    return;
  }

  try {
    deselectAll();

    await nextTick();
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    const capture = await snapdom(exportContainer.value, {
      scale: Number(exportSize.value) / CANVAS_SIZE,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff"
    });

    const imgBase64 = await capture.toPng();

    message.close();

    ElMessageBox.confirm("是否保存结果至素材库？", "提示", {
      confirmButtonText: "是",
      cancelButtonText: "否",
      type: "warning"
    })
      .then(() => {
        saveToMaterialLibrary(imgBase64.src, "resultImage");
      })
      .catch(() => {});

    ElMessage.success("图片捕获成功");
  } catch (err) {
    console.error("Capture error:", err);
    message.close();
    ElMessage.error("图片捕获失败：" + err);
  }
};

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
    deselectAll();
    await nextTick();
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    const capture = await snapdom(exportContainer.value, {
      scale: Number(exportSize.value) / CANVAS_SIZE,
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

const handleResize = () => {
  updateContainerRect();
};

onMounted(() => {
  nextTick(() => {
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
  materialLoadRequests.value.forEach(request => request.cancel());
});

defineExpose({
  initResultImg
});
</script>

<template>
  <div v-if="showStatus">
    <div class="text-base font-bold mb-4 text-gray-800">演示生成结果图</div>
    <div class="text-red-500 text-sm" v-if="props.errorMsg">
      生成失败：{{ props.errorMsg }}
    </div>
    <div class="flex gap-12">
      <div
        class="relative result-image-container"
        :style="{
          width: `${CANVAS_SIZE}px`,
          height: `${CANVAS_SIZE}px`,
          overflow: 'hidden'
        }"
        ref="exportContainer"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @click="deselectAll"
      >
        <img
          v-if="resultImage"
          :src="resultImage"
          alt="图片"
          :style="{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px` }"
          class="shadow-md"
        />
        <div v-else>
          <div class="text-gray-500 text-sm">暂无图片</div>
        </div>

        <!-- <template v-for="item in resultConfig">
          <div
            :key="item.id"
            v-if="
              item?.type === 'image' && (resultData?.[item?.id] || item?.src)
            "
            :style="{
              left: `${item.rect.x * CANVAS_SIZE}px`,
              top: `${item.rect.y * CANVAS_SIZE}px`,
              width: `${item.rect.width * CANVAS_SIZE}px`,
              height: `${item.rect.height * CANVAS_SIZE}px`,
              cursor: item.dragging ? 'grabbing' : 'pointer'
            }"
            class="absolute image-element"
            :class="{ selected: item.selected }"
            @mousedown="e => startDrag(e, item)"
            @click="e => selectElement(e, item)"
          >
            <img
              :src="resultData[item.id] || item.src"
              :alt="'图片元素' + item.id"
              class="element-image"
            />

            <div class="element-controls" v-if="item.selected">
              <el-button
                size="small"
                type="danger"
                @click="e => deleteImageElement(e, item.id)"
                class="delete-btn"
              >
                删除
              </el-button>
            </div>

            <div
              class="resize-handle se"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'se')"
            ></div>
            <div
              class="resize-handle sw"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'sw')"
            ></div>
            <div
              class="resize-handle ne"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'ne')"
            ></div>
            <div
              class="resize-handle nw"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'nw')"
            ></div>
          </div>
        </template> -->

        <template v-for="item in importedImages" :key="item.id">
          <div
            :style="{
              left: `${item.rect.x * CANVAS_SIZE}px`,
              top: `${item.rect.y * CANVAS_SIZE}px`,
              width: `${item.rect.width * CANVAS_SIZE}px`,
              height: `${item.rect.height * CANVAS_SIZE}px`,
              cursor: item.dragging ? 'grabbing' : 'pointer'
            }"
            class="absolute image-element"
            :class="{ selected: item.selected }"
            @mousedown="e => startDrag(e, item)"
            @click="e => selectElement(e, item)"
          >
            <img :src="item.src" :alt="item.name" class="element-image" />

            <div class="element-controls" v-if="item.selected">
              <el-button
                size="small"
                type="danger"
                @click="e => deleteImageElement(e, item.id)"
                class="delete-btn"
              >
                删除
              </el-button>
            </div>

            <div
              class="resize-handle se"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'se')"
            ></div>
            <div
              class="resize-handle sw"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'sw')"
            ></div>
            <div
              class="resize-handle ne"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'ne')"
            ></div>
            <div
              class="resize-handle nw"
              v-if="item.selected"
              @mousedown="e => resizeImage(e, item, 'nw')"
            ></div>
          </div>
        </template>
      </div>

      <div>
        <div class="flex flex-col">
          <div>
            <el-button
              type="primary"
              @click="importImage"
              :disabled="!resultImage"
            >
              导入素材
            </el-button>
          </div>
          <span class="text-xs text-gray-500 mt-2">
            导入的素材将作为可拖动的元素添加到画布中
          </span>
        </div>

        <div class="mt-12 flex flex-col">
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
          <div class="mt-2">
            <el-button
              type="primary"
              :disabled="!resultImage"
              @click="exportAsPNG"
            >
              导出 PNG
            </el-button>
          </div>
        </div>

        <div class="mt-12">
          <div>
            <el-button
              type="primary"
              @click="handleSaveToMaterialLibraryClick"
              :disabled="!resultImage"
            >
              保存到素材库
            </el-button>
          </div>

          <span class="text-xs text-gray-500 mt-2">
            素材将保存到【素材库 - 结果图片】中
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.result-image-container {
  position: relative;
  overflow: hidden;
}

.image-element {
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  z-index: 10;
  transition: all 0.2s;
  background: transparent;
  will-change: transform;
  transform: translateZ(0);
}

.image-element.selected {
  border: 2px solid #409eff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.image-element:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.image-element.selected:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.image-element:active {
  cursor: grabbing;
}

.element-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  image-rendering: -webkit-optimize-contrast;
}

.element-controls {
  position: absolute;
  top: -30px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  opacity: 1;
  transition: opacity 0.2s;
}

.delete-btn {
  font-size: 12px;
  padding: 2px 8px;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #409eff;
  border: 1px solid white;
  border-radius: 50%;
}

.resize-handle.se {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

.resize-handle.sw {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-handle.ne {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-handle.nw {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}
</style>
