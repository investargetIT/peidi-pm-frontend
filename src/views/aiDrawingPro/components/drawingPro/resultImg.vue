<script setup lang="ts">
import imageUrl1 from "@/views/debug/assets/绘图1.png";
import imageUrl2 from "@/views/debug/assets/绘图2.jpg";
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { snapdom } from "@zumer/snapdom";
import { saveToMaterialLibrary } from "../../utils/operationIogic/saveToMaterialLibrary";
import { c } from "node_modules/vite/dist/node/types.d-aGj9QkWt";

const CANVAS_SIZE = 500;

const showStatus = ref(false);
const resultConfig = ref<any>(null);
const resultData = ref<any>(null);
const resultImage = ref<any>(null);

const selectedElementId = ref<string | null>(null);
const isDragging = ref(false);
const dragElement = ref<any>(null);
const dragOffset = ref({ x: 0, y: 0 });
const containerRect = ref(null);

const initResultImg = (config: any, data: any, base64Url: string) => {
  console.log("结果图片：", config, data);
  resultConfig.value = JSON.parse(JSON.stringify(config));
  resultData.value = JSON.parse(JSON.stringify(data));
  resultImage.value = base64Url;
  showStatus.value = true;
};

const selectElement = (event: MouseEvent, element: any) => {
  event.stopPropagation();
  resultConfig.value?.forEach((el: any) => {
    el.selected = false;
  });
  element.selected = true;
  selectedElementId.value = element.id;
};

const deselectAll = () => {
  resultConfig.value?.forEach((el: any) => {
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

  selectElement(event, element);

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  event.preventDefault();
};

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragElement.value || !containerRect.value) return;

  const x = event.clientX - containerRect.value.left - dragOffset.value.x;
  const y = event.clientY - containerRect.value.top - dragOffset.value.y;

  // 转换为归一化坐标并限制在 0-1 范围内
  const normalizedX = Math.max(
    0,
    Math.min(x / CANVAS_SIZE, 1 - dragElement.value.rect.width)
  );
  const normalizedY = Math.max(
    0,
    Math.min(y / CANVAS_SIZE, 1 - dragElement.value.rect.height)
  );

  dragElement.value.rect.x = normalizedX;
  dragElement.value.rect.y = normalizedY;
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
        element.rect.width = Math.max(
          0.1,
          Math.min(startWidth + deltaX / CANVAS_SIZE, 1 - element.rect.x)
        );
        element.rect.height = Math.max(
          0.1,
          Math.min(startHeight + deltaY / CANVAS_SIZE, 1 - element.rect.y)
        );
        break;
      case "sw":
        const newWidthSW = Math.max(
          0.1,
          Math.min(
            startWidth - deltaX / CANVAS_SIZE,
            element.rect.x + element.rect.width
          )
        );
        element.rect.x = Math.max(0, startXPos + deltaX / CANVAS_SIZE);
        element.rect.width = newWidthSW;
        element.rect.height = Math.max(
          0.1,
          Math.min(startHeight + deltaY / CANVAS_SIZE, 1 - element.rect.y)
        );
        break;
      case "ne":
        element.rect.width = Math.max(
          0.1,
          Math.min(startWidth + deltaX / CANVAS_SIZE, 1 - element.rect.x)
        );
        const newYNE = Math.max(0, startYPos + deltaY / CANVAS_SIZE);
        element.rect.y = newYNE;
        element.rect.height = Math.max(
          0.1,
          Math.min(
            startHeight - deltaY / CANVAS_SIZE,
            element.rect.y + element.rect.height
          )
        );
        break;
      case "nw":
        const newWidthNW = Math.max(
          0.1,
          Math.min(
            startWidth - deltaX / CANVAS_SIZE,
            element.rect.x + element.rect.width
          )
        );
        element.rect.x = Math.max(0, startXPos + deltaX / CANVAS_SIZE);
        element.rect.width = newWidthNW;
        const newYNW = Math.max(0, startYPos + deltaY / CANVAS_SIZE);
        element.rect.y = newYNW;
        element.rect.height = Math.max(
          0.1,
          Math.min(
            startHeight - deltaY / CANVAS_SIZE,
            element.rect.y + element.rect.height
          )
        );
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

onMounted(() => {
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
});

const handleResize = () => {};

const exportContainer = ref<HTMLElement | null>(null);

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

    const capture = await snapdom(exportContainer.value, {
      scale: 1,
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

defineExpose({
  initResultImg
});
</script>

<template>
  <div v-if="showStatus">
    <div class="text-base text-[#0a0a0a] mb-2">结果图片</div>
    <div
      class="relative result-image-container"
      :style="{
        width: `${CANVAS_SIZE}px`,
        height: `${CANVAS_SIZE}px`,
        overflow: 'hidden'
      }"
      ref="exportContainer"
      @click="deselectAll"
    >
      <img
        :src="resultImage"
        alt="图片"
        :style="{ width: `${CANVAS_SIZE}px`, height: `${CANVAS_SIZE}px` }"
        class="shadow-md"
      />

      <template v-for="item in resultConfig">
        <div
          :key="item.id"
          v-if="item?.type === 'image' && resultData?.[item?.id]"
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
            :src="resultData[item.id]"
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
      </template>
    </div>

    <div>
      <el-button
        type="primary"
        size="small"
        @click="handleSaveToMaterialLibraryClick"
      >
        保存到素材库
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
