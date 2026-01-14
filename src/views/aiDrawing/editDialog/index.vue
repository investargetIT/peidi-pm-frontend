<script lang="ts" setup>
import { onMounted, ref, reactive, nextTick, onUnmounted, watch } from "vue";
import { ElMessage } from "element-plus";
import TEMP_IMG from "./imgs/temp.png";
import DEFAULT_IMG from "./imgs/default.png";
import html2canvas from "html2canvas";
import { snapdom } from "@zumer/snapdom";
import { downloadFile } from "@/api/aiDraw";

const props = defineProps({
  templateImg: {
    type: String,
    required: true
  }
});

const exportContainer = ref(null);
const templateImgBase64 = ref(DEFAULT_IMG); // 存储转换后的base64图片
const exportPNGLoading = ref<boolean>(false);

// 检查是否是URL并转换为base64
const processTemplateImage = async () => {
  if (!props.templateImg) return;

  const message = ElMessage.info({
    message: "正在加载模板图片...",
    duration: 0
  });
  try {
    const res: any = await downloadFile({ objectName: props.templateImg });
    const reader = new FileReader();
    reader.onloadend = () => {
      templateImgBase64.value = reader.result as string;
      message.close();
      ElMessage.success("模板图片加载成功");
    };
    reader.readAsDataURL(res);
  } catch (error) {
    console.error("图片转换失败:", error);
    message.close();
    ElMessage.error("模板图片加载失败，请检查URL是否正确");
  }
};

// 监听templateImg变化
watch(
  () => props.templateImg,
  () => {
    templateImgBase64.value = DEFAULT_IMG;
    processTemplateImage();
  }
);

const capture = () => {
  if (exportContainer.value) {
    html2canvas(exportContainer.value).then(canvas => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "图片下载.png";
      link.click();
    });
  }
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
      scale: 1.5,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff"
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

const dialogVisible = ref(false);
const currentImage = ref(TEMP_IMG);
const isDragging = ref(false);
const dragElement = ref(null);
const selectedElementId = ref(null); // 当前选中的元素ID
const dragOffset = ref({ x: 0, y: 0 }); // 拖动时的鼠标偏移量
const containerRect = ref(null); // 缓存容器位置信息

// 图片元素数据
const imageElements = reactive([]);

const handleClose = (done: () => void) => {
  done();
};

// 导入图片功能 - 生成图片元素
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
          // 创建新的图片元素
          const img = new Image();
          img.onload = () => {
            const newImageElement = {
              id: Date.now(),
              x: 50,
              y: 50,
              width: Math.min(img.width, 200), // 限制最大宽度
              height: Math.min(img.height, 200), // 限制最大高度
              src: event.target.result,
              dragging: false,
              originalWidth: img.width,
              originalHeight: img.height,
              selected: false
            };
            imageElements.push(newImageElement);
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

// 选中图片元素
const selectElement = (event: MouseEvent, element: any) => {
  event.stopPropagation();
  // 取消所有元素的选中状态
  imageElements.forEach(el => {
    el.selected = false;
  });
  // 设置当前元素为选中状态
  element.selected = true;
  selectedElementId.value = element.id;
};

// 取消选中
const deselectAll = () => {
  imageElements.forEach(el => {
    el.selected = false;
  });
  selectedElementId.value = null;
};

// 更新容器位置信息
const updateContainerRect = () => {
  const container = document.querySelector(".image-container");
  if (container) {
    containerRect.value = container.getBoundingClientRect();
  }
};

// 开始拖动
const startDrag = (event: MouseEvent, element: any) => {
  isDragging.value = true;
  element.dragging = true;
  dragElement.value = element;

  // 更新容器位置信息
  updateContainerRect();

  if (containerRect.value) {
    const elementRect = {
      left: containerRect.value.left + element.x,
      top: containerRect.value.top + element.y
    };
    dragOffset.value = {
      x: event.clientX - elementRect.left,
      y: event.clientY - elementRect.top
    };
  }

  // 拖动时选中元素
  selectElement(event, element);

  // 使用原生事件监听器，避免Vue的事件系统
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  event.preventDefault();
};

// 鼠标移动处理函数（使用requestAnimationFrame优化性能）
let animationFrameId = null;
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragElement.value || !containerRect.value) return;

  // 使用requestAnimationFrame避免频繁更新
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  animationFrameId = requestAnimationFrame(() => {
    const x = event.clientX - containerRect.value.left - dragOffset.value.x;
    const y = event.clientY - containerRect.value.top - dragOffset.value.y;

    // 限制在容器范围内
    dragElement.value.x = Math.max(
      0,
      Math.min(containerRect.value.width - dragElement.value.width, x)
    );
    dragElement.value.y = Math.max(
      0,
      Math.min(containerRect.value.height - dragElement.value.height, y)
    );
  });
};

// 鼠标抬起处理函数
const handleMouseUp = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (dragElement.value) {
    dragElement.value.dragging = false;
  }
  isDragging.value = false;
  dragElement.value = null;
  dragOffset.value = { x: 0, y: 0 };

  // 移除事件监听器
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
};

// 结束拖动（备用方法）
const endDrag = () => {
  handleMouseUp();
};

// 删除图片元素
const deleteImageElement = (event: MouseEvent, id: number) => {
  event.stopPropagation();
  const index = imageElements.findIndex(element => element.id === id);
  if (index !== -1) {
    imageElements.splice(index, 1);
    if (selectedElementId.value === id) {
      selectedElementId.value = null;
    }
  }
};

// 调整图片大小
const resizeImage = (event: MouseEvent, element: any, direction: string) => {
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const startWidth = element.width;
  const startHeight = element.height;
  const startXPos = element.x;
  const startYPos = element.y;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;

    switch (direction) {
      case "se":
        element.width = Math.max(50, startWidth + deltaX);
        element.height = Math.max(50, startHeight + deltaY);
        break;
      case "sw":
        element.width = Math.max(50, startWidth - deltaX);
        element.height = Math.max(50, startHeight + deltaY);
        element.x = startXPos + deltaX;
        break;
      case "ne":
        element.width = Math.max(50, startWidth + deltaX);
        element.height = Math.max(50, startHeight - deltaY);
        element.y = startYPos + deltaY;
        break;
      case "nw":
        element.width = Math.max(50, startWidth - deltaX);
        element.height = Math.max(50, startHeight - deltaY);
        element.x = startXPos + deltaX;
        element.y = startYPos + deltaY;
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

// 导出为PNG
const exportAsPNG = () => {
  // capture();

  exportPNGLoading.value = true;
  deselectAll();

  nextTick(() => {
    setTimeout(() => {
      handleCapture();
    }, 1000);
  });
};

// 窗口大小变化时更新容器位置
const handleResize = () => {
  updateContainerRect();
};

onMounted(() => {
  processTemplateImage();
  nextTick(() => {
    updateContainerRect();
    window.addEventListener("resize", handleResize);
  });
});

// 组件卸载时清理
onUnmounted(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
});

const handleOpen = () => {
  dialogVisible.value = true;
  // 清空图片元素
  imageElements.length = 0;
};

defineExpose({
  open: () => {
    handleOpen();
  }
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="编辑图片"
      width="1200"
      :before-close="handleClose"
      append-to-body
    >
      <div class="editor-container">
        <div class="toolbar">
          <el-button type="primary" @click="importImage">导入素材</el-button>
          <span class="tip">导入的素材将作为可拖动的元素添加到画布中</span>
        </div>

        <div
          class="image-container"
          @mouseup="endDrag"
          @mouseleave="endDrag"
          @click="deselectAll"
          ref="exportContainer"
        >
          <img
            :src="templateImgBase64"
            alt="编辑图片"
            class="background-image"
          />

          <!-- 图片元素 -->
          <div
            v-for="element in imageElements"
            :key="element.id"
            class="image-element"
            :class="{ selected: element.selected }"
            :style="{
              left: element.x + 'px',
              top: element.y + 'px',
              width: element.width + 'px',
              height: element.height + 'px',
              cursor: element.dragging ? 'grabbing' : 'pointer'
            }"
            @mousedown="e => startDrag(e, element)"
            @click="e => selectElement(e, element)"
          >
            <img
              :src="element.src"
              :alt="'图片元素' + element.id"
              class="element-image"
            />
            <div class="element-controls" v-if="element.selected">
              <el-button
                size="small"
                type="danger"
                @click="e => deleteImageElement(e, element.id)"
                class="delete-btn"
              >
                删除
              </el-button>
            </div>
            <!-- 调整大小手柄 -->
            <div
              class="resize-handle se"
              v-if="element.selected"
              @mousedown="e => resizeImage(e, element, 'se')"
            ></div>
            <div
              class="resize-handle sw"
              v-if="element.selected"
              @mousedown="e => resizeImage(e, element, 'sw')"
            ></div>
            <div
              class="resize-handle ne"
              v-if="element.selected"
              @mousedown="e => resizeImage(e, element, 'ne')"
            ></div>
            <div
              class="resize-handle nw"
              v-if="element.selected"
              @mousedown="e => resizeImage(e, element, 'nw')"
            ></div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>

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

<style langs="scss" scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  /* height: 600px; */
}

.toolbar {
  padding: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.tip {
  color: #666;
  font-size: 12px;
}

.image-container {
  position: relative;
  flex: 1;
  /* border: 1px solid #ddd; */
  overflow: hidden;
  background-color: transparent;
  cursor: default;
  display: flex; /* 添加flex布局 */
  align-items: flex-start; /* 顶部对齐 */
}

.background-image {
  width: 100%;
  /* height: 100%; */
  object-fit: contain;
}

.image-element {
  position: absolute;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  z-index: 10;
  transition: all 0.2s;
  background: transparent;
  /* 优化渲染性能 */
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
  /* 优化图片渲染 */
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
