<script setup lang="ts">
import { onMounted, ref, reactive, nextTick, onUnmounted, inject } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import DEFAULT_IMG from "../../assests/images/default.png";
import { snapdom } from "@zumer/snapdom";
import { blobManager } from "../../utils/blobManager";
import { saveToMaterialLibrary } from "../../utils/operationIogic/saveToMaterialLibrary";
import {
  compositeImage,
  downloadCompositeImage,
  generateCompositeElements
} from "../../utils/compositeImage";

interface ResultImageItem {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  dragging: boolean;
  originalWidth: number;
  originalHeight: number;
  selected: boolean;
  name?: string;
}

const imageCacheManager = inject("imageCacheManager") as {
  processImageWithCache: (
    url: string,
    callback?: (result: any) => void
  ) => Promise<any>;
  checkImageCache: (url: string) => Promise<boolean>;
  getCompressedImage: (url: string) => Promise<string | null>;
  getOriginalImage: (url: string) => Promise<string | null>;
};

const dialogVisible = ref(false);
const isDragging = ref(false);
const dragElement = ref(null);
const selectedElementId = ref(null);
const dragOffset = ref({ x: 0, y: 0 });
const containerRect = ref(null);
const exportContainer = ref(null);
const exportPNGLoading = ref(false);
const exportSize = ref("800");

const currentLoadRequest = ref<{ cancel: () => void } | null>(null);
const materialLoadRequests = ref<Array<{ cancel: () => void }>>([]);

const templateImgBase64 = ref(DEFAULT_IMG);
const imageElements = reactive<ResultImageItem[]>([]);

let animationFrameId = null;

const isBase64Image = (str: string): boolean => {
  if (!str || typeof str !== "string") return false;
  return str.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(str);
};

const importMaterialElements = async () => {
  imageElements.length = 0;
  materialLoadRequests.value.forEach(request => request.cancel());
  materialLoadRequests.value = [];

  const rowData = selectedRowData.value;
  const imageConfig = selectedImageConfig.value;

  // console.log("importMaterialElements", { rowData, imageConfig });

  if (!rowData || !imageConfig || imageConfig.length === 0) {
    ElMessage.info("没有找到配置信息");
    return;
  }

  const loadPromises: Promise<any>[] = [];

  const imageConfigs = imageConfig.filter((item: any) => item.type === "image");

  for (const config of imageConfigs) {
    const imageKey = `${config.id}_image`;
    const aiRefKey = `${config.id}_aiRef`;

    const imageData = rowData[imageKey];
    const isAiReferenced = rowData[aiRefKey] === true;

    // console.log(`处理图片配置：${config.name}`, {
    //   imageKey,
    //   imageData,
    //   isAiReferenced,
    //   aiRefValue: rowData[aiRefKey]
    // });

    if (imageData && !isAiReferenced) {
      const promise = (async () => {
        let base64Data: string | null = null;

        if (isBase64Image(imageData)) {
          base64Data = imageData;
        } else {
          try {
            const loadRequest =
              imageCacheManager.processImageWithCache(imageData);
            materialLoadRequests.value.push({ cancel: () => {} });

            const blob = await loadRequest;
            // console.log(`加载 ${config.name} 成功:`, blob);
            base64Data = await blobManager.blobToBase64(blob?.originalBlob);
          } catch (error) {
            if (error.message !== "请求已取消") {
              console.warn(`加载 ${config.name} 失败:`, error);
            }
            return {
              success: false,
              field: imageKey,
              name: config.name,
              error: error.message
            };
          }
        }

        if (base64Data) {
          return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
              const newImageElement: ResultImageItem = {
                id: Date.now() + Math.random(),
                x: config.rect?.x * 700 || 50 + imageElements.length * 20,
                y: config.rect?.y * 700 || 50 + imageElements.length * 20,
                width: config.rect?.width * 700 || Math.min(img.width, 200),
                height: config.rect?.height * 700 || Math.min(img.height, 200),
                src: base64Data!,
                dragging: false,
                originalWidth: img.width,
                originalHeight: img.height,
                selected: false,
                name: config.name
              };
              imageElements.push(newImageElement);
              resolve({ success: true, field: imageKey, name: config.name });
            };
            img.onerror = () => {
              resolve({
                success: false,
                field: imageKey,
                name: config.name,
                error: "图片加载失败"
              });
            };
            img.src = base64Data!;
          });
        }

        return {
          success: false,
          field: imageKey,
          name: config.name,
          error: "无法获取图片"
        };
      })();

      loadPromises.push(promise);
    }
  }

  if (loadPromises.length === 0) {
    ElMessage.info("没有找到可导入的素材");
    return;
  }

  try {
    const results = await Promise.all(loadPromises);
    const successfulLoads = results.filter(
      (result: any) => result.success
    ).length;
    const failedLoads = results.filter((result: any) => !result.success).length;

    if (successfulLoads > 0) {
      ElMessage.success(`成功导入 ${successfulLoads} 个素材`);
    } else if (failedLoads > 0) {
      ElMessage.warning(`所有素材加载失败`);
    }
  } catch (error) {
    if (error.message !== "操作已取消") {
      console.error("导入素材时发生错误:", error);
      ElMessage.error("导入素材时发生错误");
    }
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
            const newImageElement: ResultImageItem = {
              id: Date.now(),
              x: 50,
              y: 50,
              width: Math.min(img.width, 200),
              height: Math.min(img.height, 200),
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

const selectElement = (event: MouseEvent, element: ResultImageItem) => {
  event.stopPropagation();
  imageElements.forEach(el => {
    el.selected = false;
  });
  element.selected = true;
  selectedElementId.value = element.id;
};

const deselectAll = () => {
  imageElements.forEach(el => {
    el.selected = false;
  });
  selectedElementId.value = null;
};

const updateContainerRect = () => {
  const container = document.querySelector(".image-container");
  if (container) {
    containerRect.value = container.getBoundingClientRect();
  }
};

const startDrag = (event: MouseEvent, element: ResultImageItem) => {
  isDragging.value = true;
  element.dragging = true;
  dragElement.value = element;

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

  selectElement(event, element);

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  event.preventDefault();
};

animationFrameId = null;
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragElement.value || !containerRect.value) return;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  animationFrameId = requestAnimationFrame(() => {
    const x = event.clientX - containerRect.value.left - dragOffset.value.x;
    const y = event.clientY - containerRect.value.top - dragOffset.value.y;

    dragElement.value.x = x;
    dragElement.value.y = y;
  });
};

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

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
};

const endDrag = () => {
  handleMouseUp();
};

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

const resizeImage = (
  event: MouseEvent,
  element: ResultImageItem,
  direction: string
) => {
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

const handleResize = () => {
  updateContainerRect();
};

const exportAsPNG = () => {
  exportPNGLoading.value = true;
  deselectAll();

  nextTick(async () => {
    // 等待一秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    handleCapture();
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
    const capture = await snapdom(exportContainer.value, {
      scale: Number(exportSize.value) / 668,
      dpr: window.devicePixelRatio,
      backgroundColor: "#ffffff"
    });

    // const img = await capture.toPng();

    // ElMessageBox.confirm("是否保存结果至素材库？", "提示", {
    //   confirmButtonText: "是",
    //   cancelButtonText: "否",
    //   type: "warning"
    // })
    //   .then(() => {
    //     saveToMaterialLibrary(img.src, "resultImage", {
    //       fromProduct: selectedRowData.value?.productName || "未知产品"
    //     });
    //   })
    //   .catch(() => {});

    await capture.download({
      type: "png",
      filename: `${selectedRowData.value?.productName || "AI_Generated_Image"}.png`
    });

    ElMessage.success("图片导出成功");
  } catch (err) {
    console.error("Capture error:", err);
    ElMessage.error("图片导出失败");
  } finally {
    message.close();
    exportPNGLoading.value = false;
  }
};

const handleSaveToMaterialLibrary = async () => {
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
      scale: Number(exportSize.value) / 668,
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

const selectedResultUrl = ref<string>("");
const selectedRowData = ref<any>({});
const selectedImageConfig = ref<any[]>([]);

const handleOpen = (imageUrl: string, rowData?: any, imageConfig?: any[]) => {
  dialogVisible.value = true;
  imageElements.length = 0;
  templateImgBase64.value = DEFAULT_IMG;

  nextTick(() => {
    selectedResultUrl.value = imageUrl;
    selectedRowData.value = rowData || {};
    selectedImageConfig.value = imageConfig || [];

    templateImgBase64.value = imageUrl;

    updateContainerRect();

    // setTimeout(async () => {
    //   await importMaterialElements();

    //   await nextTick();

    //   if (imageElements.length > 0) {
    //     const elements = generateCompositeElements(
    //       imageElements,
    //       700,
    //       Number(exportSize.value)
    //     );

    //     try {
    //       const compositeBase64 = await compositeImage(
    //         imageUrl,
    //         elements,
    //         Number(exportSize.value)
    //       );

    //       console.log("Canvas 合成图片成功:", {
    //         base64Length: compositeBase64.length,
    //         outputSize: exportSize.value,
    //         elementsCount: imageElements.length
    //       });

    //       downloadCompositeImage(
    //         compositeBase64,
    //         `${selectedRowData.value?.productName || "AI_Generated_Image"}.png`
    //       );

    //       ElMessage.success("图片合成并导出成功");

    //       return compositeBase64;
    //     } catch (error) {
    //       console.error("Canvas 合成失败:", error);
    //       throw error;
    //     }
    //   } else {
    //     console.warn("没有可合成的素材元素");
    //     return null;
    //   }
    // }, 100);
    setTimeout(() => {
      importMaterialElements();
    }, 100);
  });
};

const handleClose = (done: () => void) => {
  if (currentLoadRequest.value) {
    currentLoadRequest.value.cancel();
    currentLoadRequest.value = null;
  }

  imageElements.length = 0;
  templateImgBase64.value = DEFAULT_IMG;
  selectedResultUrl.value = "";
  selectedRowData.value = {};

  done();
};

onMounted(() => {
  nextTick(() => {
    window.addEventListener("resize", handleResize);
  });
});

onUnmounted(() => {
  if (currentLoadRequest.value) {
    currentLoadRequest.value.cancel();
    currentLoadRequest.value = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  window.removeEventListener("resize", handleResize);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
});

defineExpose({
  open: (imageUrl: string, rowData?: any, imageConfig?: any[]) => {
    handleOpen(imageUrl, rowData, imageConfig);
  }
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="编辑结果图片"
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
            <el-button type="primary" @click="handleSaveToMaterialLibrary"
              >保存到素材库</el-button
            >
          </div>

          <div>
            <el-select
              v-model="exportSize"
              placeholder="请选择导出尺寸"
              style="width: 120px; margin-right: 10px"
            >
              <el-option label="800*800" value="800"></el-option>
              <el-option label="1400*1400" value="1400"></el-option>
              <el-option label="2048*2048" value="2048"></el-option>
              <el-option label="4096*4096" value="4096"></el-option>
            </el-select>
            <el-button
              type="primary"
              @click="exportAsPNG"
              :loading="exportPNGLoading"
            >
              导出 PNG
            </el-button>
          </div>
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

<style lang="scss" scoped>
.editor-container {
  display: flex;
  flex-direction: column;
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
  overflow: hidden;
  background-color: transparent;
  cursor: default;
  display: flex;
  align-items: flex-start;
}

.background-image {
  width: 100%;
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
