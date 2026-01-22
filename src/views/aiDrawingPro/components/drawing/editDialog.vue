<script lang="ts" setup>
import {
  onMounted,
  ref,
  reactive,
  nextTick,
  onUnmounted,
  watch,
  inject
} from "vue";
import { ElMessage } from "element-plus";
import DEFAULT_IMG from "../../assests/images/default.png";
import { snapdom } from "@zumer/snapdom";
import { loadImage } from "../../utils/imageLoader";
import { type ImageDataResult } from "../../utils/compressImage";
import { type ExcelTableItem } from "../../type/drawing";

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

// 选中的行数据和索引
const selectedRow = ref<ExcelTableItem>({} as ExcelTableItem);
const selectedIndex = ref<number | string>("");

const exportContainer = ref(null);
const templateImgBase64 = ref(DEFAULT_IMG); // 存储转换后的base64图片
const exportPNGLoading = ref<boolean>(false);

// 用于存储当前加载请求的取消函数
let currentLoadRequest: { cancel: () => void } | null = null;
// 用于存储素材加载请求的取消函数数组
const materialLoadRequests = ref<Array<{ cancel: () => void }>>([]);

// 检查是否是URL并转换为base64 - 优先使用缓存
const processTemplateImage = async () => {
  const resultImage = selectedRow.value?.resultImages?.[selectedIndex.value];
  if (!resultImage) return;

  // 取消之前的加载请求（如果存在）
  if (currentLoadRequest) {
    currentLoadRequest.cancel();
    currentLoadRequest = null;
  }

  try {
    // 使用新的可取消的loadImage函数
    const loadRequest = loadImage(resultImage, imageCacheManager, {
      loadingMessage: "正在加载底图...",
      successMessage: "底图加载成功",
      errorMessage: "底图加载失败，请检查URL是否正确"
    });

    currentLoadRequest = loadRequest;
    templateImgBase64.value = await loadRequest.promise;
    currentLoadRequest = null; // 加载完成后清除引用

    await importMaterialElements();
  } catch (error) {
    // 如果是取消错误，不显示错误消息
    if (error.message !== "请求已取消") {
      console.error("底图加载失败:", error);
    }
    currentLoadRequest = null;
  }
};

// 导入指定素材功能
const importMaterialElements = async () => {
  // 清空现有元素
  imageElements.length = 0;
  // 清空之前的素材加载请求
  materialLoadRequests.value.forEach(request => request.cancel());
  materialLoadRequests.value = [];

  // 定义素材列表和对应的初始位置和尺寸
  const materials = [
    {
      field: "productImage",
      name: "产品图片",
      position: { x: 231, y: 221 }, // 左上角
      size: { width: 416, height: 356 } // 产品图片较大
    },
    {
      field: "fullGiftImages",
      name: "全场满赠图片",
      position: { x: 6, y: 269 }, // 右上角
      size: { width: 243, height: 218 } // 赠品图片中等大小
    },
    {
      field: "campaignLogoImage",
      name: "活动LOGO",
      position: { x: 64, y: -21 }, // 左下角
      size: { width: 231, height: 160 } // LOGO较小
    },
    // {
    //   field: "brandLogoImage",
    //   name: "品牌LOGO",
    //   position: { x: 67, y: 6 }, // 右下角
    //   size: { width: 95, height: 95 } // LOGO较小
    // },
    {
      field: "shopLogoImage",
      name: "店铺LOGO",
      position: { x: 468, y: -5 }, // 中心位置
      size: { width: 200, height: 200 } // 店铺LOGO中等大小
    }
  ];

  // 使用Promise.all来等待所有图片加载完成
  const loadPromises = materials.map(async material => {
    const images = selectedRow.value?.[material.field];
    if (images && Array.isArray(images) && images.length > 0) {
      // 只取第一张图片
      const imageUrl = images[0];
      if (imageUrl) {
        try {
          // 使用loadImage函数加载图片
          const loadRequest = loadImage(imageUrl, imageCacheManager, {
            loadingMessage: `正在加载${material.name}...`,
            errorMessage: `${material.name}加载失败`
          });

          // 存储加载请求以便后续取消
          materialLoadRequests.value.push(loadRequest);

          const base64Data = await loadRequest.promise;

          // 如果请求已被取消，直接返回
          if (materialLoadRequests.value.length === 0) {
            return { success: false, material: material.name, error: "操作已取消" };
          }

          // 返回一个Promise，等待图片加载完成
          return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const newImageElement = {
                id: Date.now() + Math.random(), // 使用更随机的ID
                x: material.position.x,
                y: material.position.y,
                width: material.size.width,
                height: material.size.height,
                src: base64Data,
                dragging: false,
                originalWidth: img.width,
                originalHeight: img.height,
                selected: false,
                name: material.name
              };
              imageElements.push(newImageElement);
              resolve({ success: true, material: material.name });
            };
            img.onerror = () => {
              resolve({
                success: false,
                material: material.name,
                error: "图片加载失败"
              });
            };
            img.src = base64Data;
          });
        } catch (error) {
          // 如果是取消错误，不显示警告
          if (error.message !== "请求已取消") {
            console.warn(`加载 ${material.name} 失败:`, error);
          }
          return {
            success: false,
            material: material.name,
            error: error.message
          };
        }
      }
    }
    return { success: false, material: material.name, error: "素材为空" };
  });

  try {
    // 等待所有图片加载完成
    const results = await Promise.all(loadPromises);

    // 统计成功和失败的素材数量
    const successfulLoads = results.filter(
      (result: any) => result.success
    ).length;
    const failedLoads = results.filter((result: any) => !result.success).length;
    const totalMaterials = materials.length;

    // 根据加载结果显示相应的消息
    if (successfulLoads === 0) {
      ElMessage.warning("没有找到可导入的素材");
    } else if (successfulLoads === totalMaterials) {
      ElMessage.success(`成功导入 ${successfulLoads} 个素材`);
    } else {
      ElMessage.info(
        `成功导入 ${successfulLoads} 个素材，${failedLoads} 个素材加载失败或为空`
      );
    }
  } catch (error) {
    // 如果是取消错误，不显示错误消息
    if (error.message !== "请求已取消") {
      console.error("导入素材时发生错误:", error);
      ElMessage.error("导入素材时发生错误");
    }
  }
};

const dialogVisible = ref(false);
const isDragging = ref(false);
const dragElement = ref(null);
const selectedElementId = ref(null); // 当前选中的元素ID
const dragOffset = ref({ x: 0, y: 0 }); // 拖动时的鼠标偏移量
const containerRect = ref(null); // 缓存容器位置信息

// 图片元素数据
const imageElements = reactive([]);

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

    // 移除位置限制，允许元素移动到画布之外
    dragElement.value.x = x;
    dragElement.value.y = y;
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

// 窗口大小变化时更新容器位置
const handleResize = () => {
  updateContainerRect();
};

// 导出为PNG
const exportAsPNG = () => {
  exportPNGLoading.value = true;
  deselectAll();

  nextTick(() => {
    handleCapture();
    // setTimeout(() => {}, 1000);
  });
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
      scale: 4096 / 668,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff"
    });

    // 获取PNG图像
    const img = await capture.toPng();

    // 可选：自动下载
    await capture.download({
      //@ts-ignore
      format: "png",
      filename: `${selectedRow.value.productName || "AI_Generated_Image"}.png`
    });
  } catch (err) {
    console.error("Capture error:", err);
  } finally {
    message.close();
    ElMessage.success("图片捕获成功");
    exportPNGLoading.value = false;
  }
};

onMounted(() => {
  // processTemplateImage();
  nextTick(() => {
    // updateContainerRect();
    window.addEventListener("resize", handleResize);
  });
});

const handleOpen = (row: ExcelTableItem, index: number | string) => {
  dialogVisible.value = true;
  // 清空图片元素
  imageElements.length = 0;
  templateImgBase64.value = DEFAULT_IMG;

  nextTick(() => {
    // 更新选中的行数据和索引
    selectedRow.value = row;
    selectedIndex.value = index;
    processTemplateImage();
    updateContainerRect();
  });
};

const handleClose = (done: () => void) => {
  // 取消当前的图片加载请求
  if (currentLoadRequest) {
    currentLoadRequest.cancel();
    currentLoadRequest = null;
  }

  // 清空图片元素
  imageElements.length = 0;
  // 重置模板图片
  templateImgBase64.value = DEFAULT_IMG;

  // 关闭弹窗
  done();
};

// 组件卸载时清理
onUnmounted(() => {
  // 取消当前的图片加载请求
  if (currentLoadRequest) {
    currentLoadRequest.cancel();
    currentLoadRequest = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
});

defineExpose({
  open: (row: ExcelTableItem, index: number | string) => {
    handleOpen(row, index);
  }
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="编辑图片"
      width="700"
      :before-close="handleClose"
      append-to-body
      :close-on-click-modal="false"
      align-center
    >
      <div class="editor-container">
        <div class="toolbar">
          <div>
            <el-button type="primary" @click="importImage">导入素材</el-button>
            <span class="tip">导入的素材将作为可拖动的元素添加到画布中</span>
          </div>

          <el-button
            type="primary"
            @click="exportAsPNG"
            :loading="exportPNGLoading"
          >
            导出PNG
          </el-button>
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
  justify-content: space-between;
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
</style>