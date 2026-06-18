<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import * as fabric from "fabric";
import { useLovartStore } from "../store";
import type { Layer, ShapeType } from "../types";

const props = defineProps<{
  width?: number;
  height?: number;
}>();

const emit = defineEmits<{
  (e: "layer:dblclick", layerId: string): void;
}>();

const store = useLovartStore();

const canvasContainer = ref<HTMLDivElement | null>(null);
let canvas: fabric.Canvas | null = null;
let isUpdatingFromStore = false;

// 交互状态管理
let interactionMode: "idle" | "panning" | "zooming" | "selecting" = "idle";
let lastPointer: { x: number; y: number } | null = null;
let pendingUpdate: number | null = null;

// 暴露给父组件的刷新方法
const refreshCanvas = () => {
  nextTick(async () => {
    await renderAllLayers();
  });
};

defineExpose({
  refreshCanvas
});

const initCanvas = () => {
  if (!canvasContainer.value) return;

  const containerRect = canvasContainer.value.getBoundingClientRect();

  canvas = new fabric.Canvas("lovart-canvas", {
    width: containerRect.width,
    height: containerRect.height,
    backgroundColor: null,
    selection: true,
    preserveObjectStacking: true,
    uniScaleTransform: false,
    centeredScaling: false
  });

  (window as any).__lovartCanvas = canvas;

  // 选择事件处理
  canvas.on("selection:created", handleSelection);
  canvas.on("selection:updated", handleSelection);
  canvas.on("selection:cleared", () => {
    if (!isUpdatingFromStore) {
      store.selectLayers([]);
    }
  });

  // 对象修改事件（拖拽、缩放、旋转完成后）
  canvas.on("object:modified", (opt: any) => {
    const obj = opt.target;
    if (!obj || isUpdatingFromStore) return;

    if (obj.type === "activeSelection") {
      obj.getObjects().forEach((subObj: any) => {
        if (subObj.layerId) updateLayerFromObject(subObj);
      });
    } else if (obj.layerId) {
      updateLayerFromObject(obj);
    }

    debouncedSaveSnapshot();
  });

  // 缩放过程中 - 不做任何 store 更新，避免重新渲染
  canvas.on("object:scaling", (opt: any) => {
    // 什么都不做，让 Fabric.js 自己处理
  });


  // 双击编辑文本
  canvas.on("mouse:dblclick", (opt: any) => {
    const obj = opt.target;
    if (obj && obj.layerId) {
      const layer = store.layers.find(l => l.id === obj.layerId);
      if (layer && layer.type === "text" && !layer.locked) {
        emit("layer:dblclick", obj.layerId);
      }
    }
  });

  // 鼠标按下
  canvas.on("mouse:down", (opt: any) => {
    const evt = opt.e;

    // Alt + 点击 或 中键点击 = 平移模式
    if (evt.altKey || evt.button === 1) {
      interactionMode = "panning";
      lastPointer = { x: evt.clientX, y: evt.clientY };
      canvas!.defaultCursor = "grabbing";

      // 如果点击了对象，取消选中以便平移
      if (opt.target) {
        canvas!.discardActiveObject();
        canvas!.requestRenderAll();
      }
      return;
    }

    // 左键点击空白处 = 框选模式（Fabric 默认行为）
    if (!opt.target) {
      interactionMode = "selecting";
    }
  });

  // 鼠标移动
  canvas.on("mouse:move", (opt: any) => {
    if (interactionMode !== "panning" || !lastPointer) return;

    const evt = opt.e;
    const dx = evt.clientX - lastPointer.x;
    const dy = evt.clientY - lastPointer.y;

    const vpt = canvas!.viewportTransform!;
    vpt[4] += dx;
    vpt[5] += dy;

    lastPointer = { x: evt.clientX, y: evt.clientY };
    canvas!.requestRenderAll();
  });

  // 鼠标抬起
  canvas.on("mouse:up", () => {
    if (interactionMode === "panning" && canvas) {
      const vpt = canvas.viewportTransform!;
      store.setCanvasPan(vpt[4], vpt[5]);
    }

    interactionMode = "idle";
    lastPointer = null;
    if (canvas) {
      canvas.defaultCursor = "default";
    }
  });

  // 鼠标滚轮处理
  canvas.on("mouse:wheel", (opt: any) => {
    const evt = opt.e;

    if (evt.ctrlKey || evt.metaKey) {
      // Ctrl + 滚轮 = 缩放 (内部已处理 preventDefault)
      handleZoom(evt);
    } else if (evt.shiftKey) {
      // Shift + 滚轮 = 水平平移
      evt.preventDefault();
      handlePanHorizontal(evt.deltaY);
    } else {
      // 普通滚轮 = 垂直平移
      evt.preventDefault();
      handlePanVertical(evt.deltaY);
    }
  });

  // 键盘快捷键
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize);
};

// 缩放处理
const handleZoom = (evt: WheelEvent) => {
  if (!canvas) return;

  const delta = evt.deltaY;
  const zoomFactor = delta > 0 ? 0.9 : 1.1;
  let zoom = canvas.getZoom();

  // 计算理论上的新缩放值
  let newZoom = zoom * zoomFactor;

  // 限制缩放范围（与 store 保持一致）
  const minZoom = 0.1;
  const maxZoom = 5;

  // 【关键修复】提前检查边界 - 在 preventDefault 之前检查
  // 如果当前已经在最小值且试图缩小，或者在最大值且试图放大，直接返回
  if ((newZoom <= minZoom && zoom <= minZoom) || (newZoom < minZoom && zoom === minZoom)) {
    // 已经达到最小值，阻止所有操作
    evt.preventDefault();
    evt.stopPropagation();
    return;
  }
  if ((newZoom >= maxZoom && zoom >= maxZoom) || (newZoom > maxZoom && zoom === maxZoom)) {
    // 已经达到最大值，阻止所有操作
    evt.preventDefault();
    evt.stopPropagation();
    return;
  }

  // 1. 始终阻止默认行为
  evt.preventDefault();
  evt.stopPropagation();

  // 钳制最终的缩放值（与 store 保持一致）
  newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

  // 2. 获取鼠标相对于 Canvas 元素的原始像素坐标
  const rect = canvas.getElement().getBoundingClientRect();
  const pointerX = evt.clientX - rect.left;
  const pointerY = evt.clientY - rect.top;

  // 3. 使用 Fabric 官方工具进行坐标转换
  const currentVpt = canvas.viewportTransform!;
  // 清洗矩阵，防止倾斜分量累积
  const cleanVpt: [number, number, number, number, number, number] = [
    currentVpt[0],
    0,
    0,
    currentVpt[3],
    currentVpt[4],
    currentVpt[5]
  ];

  const invertedVpt = fabric.util.invertTransform(cleanVpt);
  const worldPoint = fabric.util.transformPoint(
    { x: pointerX, y: pointerY },
    invertedVpt
  );

  // 4. 计算新的平移量
  const newPanX = pointerX - worldPoint.x * newZoom;
  const newPanY = pointerY - worldPoint.y * newZoom;

  // 5. 构造新的 TMat2D
  const newVpt: [number, number, number, number, number, number] = [
    newZoom,
    0,
    0,
    newZoom,
    newPanX,
    newPanY
  ];

  // 6. 应用变换
  canvas.setViewportTransform(newVpt);
  canvas.requestRenderAll();

  // 7. 更新 store (精度截断)
  store.setCanvasZoom(Number(newZoom.toFixed(4)));
  store.setCanvasPan(Number(newPanX.toFixed(2)), Number(newPanY.toFixed(2)));
};

// 水平平移
const handlePanHorizontal = (delta: number) => {
  if (!canvas) return;

  const vpt = canvas.viewportTransform!;
  vpt[4] -= delta;
  canvas.setViewportTransform(vpt);
  canvas.requestRenderAll();

  // 立即更新 store，不使用防抖，保证流畅性
  store.setCanvasPan(vpt[4], vpt[5]);
};

// 垂直平移
const handlePanVertical = (delta: number) => {
  if (!canvas) return;

  const vpt = canvas.viewportTransform!;
  vpt[5] -= delta;
  canvas.setViewportTransform(vpt);
  canvas.requestRenderAll();

  // 立即更新 store，不使用防抖，保证流畅性
  store.setCanvasPan(vpt[4], vpt[5]);
};

// 防抖更新画布状态到 store
const debouncedUpdateCanvasState = (
  zoom: number,
  panX: number,
  panY: number
) => {
  if (pendingUpdate) {
    cancelAnimationFrame(pendingUpdate);
  }

  pendingUpdate = requestAnimationFrame(() => {
    store.setCanvasZoom(zoom);
    store.setCanvasPan(panX, panY);
    pendingUpdate = null;
  });
};

// 防抖保存快照
let saveSnapshotTimer: number | null = null;
const debouncedSaveSnapshot = () => {
  if (saveSnapshotTimer) {
    clearTimeout(saveSnapshotTimer);
  }
  saveSnapshotTimer = window.setTimeout(() => {
    store.batchSaveSnapshot();
    saveSnapshotTimer = null;
  }, 300);
};

// 键盘事件处理
const handleKeyDown = (evt: KeyboardEvent) => {
  if ((evt.ctrlKey || evt.metaKey) && evt.key === "z") {
    evt.preventDefault();
    store.undo();
    refreshCanvas();
  }
};

// 处理选择变化
const handleSelection = (opt: any) => {
  if (isUpdatingFromStore) return;

  const selected = opt.selected || [];
  const layerIds = selected
    .filter((obj: any) => obj.layerId)
    .map((obj: any) => obj.layerId);

  store.selectLayers(layerIds);
};

// 从 Fabric 对象更新图层数据
const updateLayerFromObject = (obj: any) => {
  const layerId = obj.layerId;
  if (!layerId) return;

  // 计算实际尺寸（仿 PS 模式）
  let actualWidth: number;
  let actualHeight: number;

  if (obj.type === "image") {
    // 图片类型：实际尺寸 = 原始尺寸 × scale
    actualWidth = (obj.width || 0) * (obj.scaleX || 1);
    actualHeight = (obj.height || 0) * (obj.scaleY || 1);
  } else {
    // 其他类型（文字、矩形）：把 scale 应用到宽高，然后重置 scale 为 1
    actualWidth = (obj.width || 0) * (obj.scaleX || 1);
    actualHeight = (obj.height || 0) * (obj.scaleY || 1);

    // 直接修改 Fabric 对象，把 scale 应用到宽高上
    obj.set({
      width: actualWidth,
      height: actualHeight,
      scaleX: 1,
      scaleY: 1
    });
  }

  // 设置标志，防止 watcher 触发重新渲染
  isUpdatingFromStore = true;

  // 更新 store
  store.updateLayerWithoutSnapshot(layerId, {
    x: obj.left || 0,
    y: obj.top || 0,
    width: actualWidth,
    height: actualHeight,
    angle: obj.angle || 0,
    scaleX: 1,
    scaleY: 1
  });

  // 重新计算对象坐标
  obj.setCoords();

  // 延迟重置标志，确保 watch 已经跳过
  setTimeout(() => {
    isUpdatingFromStore = false;
  }, 0);
};

// 窗口 resize 处理
const handleResize = () => {
  if (!canvas || !canvasContainer.value) return;

  const containerRect = canvasContainer.value.getBoundingClientRect();
  canvas.setDimensions({
    width: containerRect.width,
    height: containerRect.height
  });
  canvas.renderAll();
};

// 应用画布变换（从 store 同步到 canvas）
const applyCanvasTransform = () => {
  if (!canvas) return;

  const currentZoom = canvas.getZoom();
  const currentVpt = canvas.viewportTransform!;
  const currentPanX = currentVpt[4];
  const currentPanY = currentVpt[5];

  // 增大阈值，避免浮点数精度问题导致的闪烁
  // 由于我们在 handleZoom 中已经 toFixed(2)，这里阈值设为 0.1 或 0.5 都是安全的
  if (
    Math.abs(currentZoom - store.canvasZoom) > 0.001 ||
    Math.abs(currentPanX - store.canvasPan.x) > 0.5 ||
    Math.abs(currentPanY - store.canvasPan.y) > 0.5
  ) {
    canvas.setZoom(store.canvasZoom);
    canvas.absolutePan(new fabric.Point(store.canvasPan.x, store.canvasPan.y));
    canvas.renderAll();
  }
};

// 渲染所有图层
const renderAllLayers = async () => {
  if (!canvas) return;
  isUpdatingFromStore = true;

  // 清除所有对象
  canvas.getObjects().forEach(obj => canvas!.remove(obj));

  // 按 zIndex 排序后添加
  const sorted = [...store.layers].sort((a, b) => a.zIndex - b.zIndex);

  // 等待所有图层添加完成
  const promises: Promise<void>[] = [];

  // 重写 addLayerToCanvas 的逻辑，使其返回 Promise
  for (let index = 0; index < sorted.length; index++) {
    const layer = sorted[index];
    const promise = new Promise<void>(async (resolve) => {
      let fabricObject: fabric.Object | null = null;

      if (layer.type === "image" && layer.src) {
        try {
          const img = await fabric.Image.fromURL(layer.src, {
            crossOrigin: "anonymous"
          });

          // 计算缩放比例，使图片缩放到目标尺寸，避免裁剪
          const scaleX = layer.width / img.width!;
          const scaleY = layer.height / img.height!;

          img.set({
            left: layer.x,
            top: layer.y,
            angle: layer.angle,
            scaleX: scaleX,
            scaleY: scaleY,
            opacity: layer.opacity,
            selectable: !layer.locked,
            evented: !layer.locked,
            visible: layer.visible
          });

          fabricObject = img;
        } catch (error) {
          console.error("Failed to load image:", error);
          // 加载失败时显示占位矩形
          fabricObject = createPlaceholderRect(layer);
        }
      } else if (layer.type === "image") {
        fabricObject = createPlaceholderRect(layer);
      } else if (layer.type === "text" && layer.text) {
        fabricObject = new fabric.Textbox(layer.text, {
          left: layer.x,
          top: layer.y,
          width: layer.width,
          height: layer.height,
          fontSize: layer.fontSize || 24,
          fontFamily: layer.fontFamily || "Arial",
          fill: layer.fill || "#333",
          stroke: layer.stroke,
          strokeWidth: layer.strokeWidth || 0,
          angle: layer.angle,
          scaleX: 1,
          scaleY: 1,
          opacity: layer.opacity,
          selectable: !layer.locked,
          evented: !layer.locked,
          visible: layer.visible,
          // 让 Textbox 的行为更像普通元素
          splitByGrapheme: true, // 更好的换行处理
          uniScaleTransform: false // 允许非等比缩放
        });
      } else if (layer.type === "shape") {
        fabricObject = createFabricShape(layer);
      }

      if (fabricObject && canvas) {
        (fabricObject as any).layerId = layer.id;
        canvas.add(fabricObject);
        canvas.moveObjectTo(fabricObject, index);
      }

      resolve();
    });

    promises.push(promise);
  }

  // 等待所有图层添加完成
  await Promise.all(promises);

  canvas.renderAll();

  // 恢复选中状态
  restoreSelection();

  isUpdatingFromStore = false;
};

// 恢复选中状态
const restoreSelection = () => {
  if (!canvas || store.selectedLayerIds.length === 0) return;

  const objectsToSelect: any[] = [];
  canvas.getObjects().forEach((obj: any) => {
    if (obj.layerId && store.selectedLayerIds.includes(obj.layerId)) {
      objectsToSelect.push(obj);
    }
  });

  if (objectsToSelect.length === 1) {
    canvas.setActiveObject(objectsToSelect[0]);
  } else if (objectsToSelect.length > 1) {
    const selection = new fabric.ActiveSelection(objectsToSelect, {
      canvas: canvas
    });
    canvas.setActiveObject(selection);
  }

  canvas.renderAll();
};

// 添加图层到画布
const addLayerToCanvas = async (layer: Layer, index: number) => {
  if (!canvas) return;

  let fabricObject: fabric.Object | null = null;

  if (layer.type === "image" && layer.src) {
    try {
      const img = await fabric.Image.fromURL(layer.src, {
        crossOrigin: "anonymous"
      });

      // 计算缩放比例，使图片缩放到目标尺寸，避免裁剪
      const scaleX = layer.width / img.width!;
      const scaleY = layer.height / img.height!;

      img.set({
        left: layer.x,
        top: layer.y,
        angle: layer.angle,
        scaleX: scaleX,
        scaleY: scaleY,
        opacity: layer.opacity,
        selectable: !layer.locked,
        evented: !layer.locked,
        visible: layer.visible
      });

      fabricObject = img;
    } catch (error) {
      console.error("Failed to load image:", error);
      // 加载失败时显示占位矩形
      fabricObject = createPlaceholderRect(layer);
    }
  } else if (layer.type === "image") {
    fabricObject = createPlaceholderRect(layer);
  } else if (layer.type === "text" && layer.text) {
    fabricObject = new fabric.Textbox(layer.text, {
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      fontSize: layer.fontSize || 24,
      fontFamily: layer.fontFamily || "Arial",
      fill: layer.fill || "#333",
      stroke: layer.stroke,
      strokeWidth: layer.strokeWidth || 0,
      angle: layer.angle,
      scaleX: 1,
      scaleY: 1,
      opacity: layer.opacity,
      selectable: !layer.locked,
      evented: !layer.locked,
      visible: layer.visible,
      // 让 Textbox 的行为更像普通元素
      splitByGrapheme: true, // 更好的换行处理
      uniScaleTransform: false // 允许非等比缩放
    });
  } else if (layer.type === "shape") {
    fabricObject = createFabricShape(layer);
  }

  if (fabricObject) {
    (fabricObject as any).layerId = layer.id;
    canvas.add(fabricObject);
    canvas.moveObjectTo(fabricObject, index);
  }
};

// 创建占位矩形
const createPlaceholderRect = (layer: Layer) => {
  return new fabric.Rect({
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    angle: layer.angle,
    scaleX: 1,
    scaleY: 1,
    opacity: layer.opacity,
    fill: "#f0f0f0",
    stroke: "#ccc",
    strokeWidth: 1,
    selectable: !layer.locked,
    evented: !layer.locked,
    visible: layer.visible
  });
};

// 创建 Fabric 形状对象
const createFabricShape = (layer: Layer): fabric.Object => {
  const commonOptions = {
    left: layer.x,
    top: layer.y,
    angle: layer.angle,
    scaleX: 1,
    scaleY: 1,
    opacity: layer.opacity,
    fill: layer.fill || "#409eff",
    stroke: layer.stroke || "#303133",
    strokeWidth: layer.strokeWidth || 0,
    selectable: !layer.locked,
    evented: !layer.locked,
    visible: layer.visible
  };

  switch (layer.shapeType) {
    case "rect":
      return new fabric.Rect({
        ...commonOptions,
        width: layer.width,
        height: layer.height
      });

    case "triangle":
      return new fabric.Triangle({
        ...commonOptions,
        width: layer.width,
        height: layer.height
      });

    default:
      // 默认返回矩形
      return new fabric.Rect({
        ...commonOptions,
        width: layer.width,
        height: layer.height
      });
  }
};

// 生命周期
onMounted(() => {
  nextTick(() => {
    initCanvas();
    store.initLayers();
    nextTick(async () => {
      await renderAllLayers();
      applyCanvasTransform();
      // 初始化图层数量
      prevLayerCount = store.layers.length;
    });
  });
});

// 监听 store 变化
watch(
  () => [store.canvasZoom, store.canvasPan],
  ([newZoom, newPan]) => {
    applyCanvasTransform();
  },
  { deep: true }
);

// 保存上一次的图层数量，用于检测删除操作
let prevLayerCount = 0;

// 监听图层变化
watch(
  () => store.layers,
  (newLayers) => {
    if (!isUpdatingFromStore && canvas) {
      // 只有删除操作时用增量删除，其他情况都全量重绘
      if (newLayers.length < prevLayerCount && prevLayerCount > 0) {
        handleLayerDeletion(newLayers);
      } else {
        renderAllLayers();
      }
      prevLayerCount = newLayers.length;
    }
  },
  { deep: true }
);

// 处理图层删除 - 增量删除
const handleLayerDeletion = (newLayers: Layer[]) => {
  if (!canvas) return;

  isUpdatingFromStore = true;

  const newLayerIds = new Set(newLayers.map(l => l.id));
  const objectsToRemove: any[] = [];

  canvas.getObjects().forEach((obj: any) => {
    if (obj.layerId && !newLayerIds.has(obj.layerId)) {
      objectsToRemove.push(obj);
    }
  });

  // 删除对象
  objectsToRemove.forEach(obj => canvas!.remove(obj));

  canvas.requestRenderAll();
  isUpdatingFromStore = false;
};


onUnmounted(() => {
  if (canvas) {
    canvas.dispose();
  }
  delete (window as any).__lovartCanvas;

  if (pendingUpdate) {
    cancelAnimationFrame(pendingUpdate);
  }
  if (saveSnapshotTimer) {
    clearTimeout(saveSnapshotTimer);
  }

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("resize", handleResize);
});
</script>

<template>
  <div ref="canvasContainer" class="canvas-area">
    <canvas id="lovart-canvas"></canvas>
  </div>
</template>

<style scoped lang="scss">
.canvas-area {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9e9e9;
  background-image: radial-gradient(#ccc 1px, transparent 1px);
  background-size: 20px 20px;
  cursor: default;

  &:active {
    cursor: grab;
  }
}
</style>
