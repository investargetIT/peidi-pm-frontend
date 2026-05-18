<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from "vue";
import * as fabric from "fabric";
import { useLovartStore } from "../store";
import type { Layer } from "../types";

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

// 暴露给父组件的刷新方法
const refreshCanvas = () => {
  nextTick(() => {
    renderAllLayers();
  });
};

defineExpose({
  refreshCanvas
});

const initCanvas = () => {
  if (!canvasContainer.value) return;

  canvas = new fabric.Canvas("lovart-canvas", {
    width: store.canvasWidth,
    height: store.canvasHeight,
    backgroundColor: "#ffffff",
    selection: true,
    preserveObjectStacking: true
  });

  (window as any).__lovartCanvas = canvas;

  canvas.on("selection:created", (opt: any) => {
    if (isUpdatingFromStore) return;
    const obj = opt.selected?.[0];
    if (obj && (obj as any).layerId) {
      store.selectLayer((obj as any).layerId);
    }
  });

  canvas.on("selection:cleared", () => {
    if (isUpdatingFromStore) return;
    store.selectLayer(null);
  });

  canvas.on("object:modified", (opt: any) => {
    const obj = opt.target;
    if (!obj || !(obj as any).layerId) return;
    const layerId = (obj as any).layerId;
    store.updateLayerWithoutSnapshot(layerId, {
      x: obj.left || 0,
      y: obj.top || 0,
      angle: obj.angle || 0,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1
    });
    store.batchSaveSnapshot();
  });

  canvas.on("mouse:dblclick", (opt: any) => {
    const obj = opt.target;
    if (obj && (obj as any).layerId) {
      const layerId = (obj as any).layerId;
      const layer = store.layers.find(l => l.id === layerId);
      if (layer && layer.type === "text" && !layer.locked) {
        emit("layer:dblclick", layerId);
      }
    }
  });

  window.addEventListener("keydown", evt => {
    if ((evt.ctrlKey || evt.metaKey) && evt.key === "z") {
      evt.preventDefault();
      store.undo();
      refreshCanvas();
    }
  });

  window.addEventListener("resize", handleResize);
};

const handleResize = () => {
  // 不再根据容器大小调整画布尺寸，画布尺寸由 store 控制
};

const applyCanvasTransform = () => {
  if (!canvas) return;
  canvas.setZoom(store.canvasZoom);
  canvas.absolutePan(new fabric.Point(store.canvasPan.x, store.canvasPan.y));
  canvas.renderAll();
};

const applyCanvasSize = () => {
  if (!canvas) return;
  canvas.setDimensions({ width: store.canvasWidth, height: store.canvasHeight });
  canvas.renderAll();
};

const renderAllLayers = () => {
  if (!canvas) return;
  isUpdatingFromStore = true;
  console.log("renderAllLayers, layers:", store.layers);

  canvas.getObjects().forEach(obj => canvas!.remove(obj));

  const sorted = [...store.layers].sort((a, b) => a.zIndex - b.zIndex);

  sorted.forEach((layer, index) => {
    addLayerToCanvas(layer, index);
  });

  canvas.renderAll();
  isUpdatingFromStore = false;
};

const addLayerToCanvas = async (layer: Layer, index: number) => {
  if (!canvas) return;

  if (layer.type === "image" && layer.src) {
    try {
      const img = await fabric.Image.fromURL(layer.src, {
        crossOrigin: "anonymous"
      });
      if (!canvas) return;
      img.set({
        left: layer.x,
        top: layer.y,
        angle: layer.angle,
        scaleX: layer.scaleX,
        scaleY: layer.scaleY,
        opacity: layer.opacity,
        selectable: !layer.locked,
        evented: !layer.locked,
        visible: layer.visible
      });
      // 调整图片尺寸
      const scaleX = layer.width / img.width!;
      const scaleY = layer.height / img.height!;
      img.scaleX = scaleX * layer.scaleX;
      img.scaleY = scaleY * layer.scaleY;
      (img as any).layerId = layer.id;
      canvas.add(img);
      canvas.moveObjectTo(img, index);
      if (store.selectedLayerId === layer.id) {
        canvas.setActiveObject(img);
      }
      canvas.renderAll();
    } catch (error) {
      console.error("Failed to load image:", error);
    }
  } else if (layer.type === "image") {
    const rect = new fabric.Rect({
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      angle: layer.angle,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      opacity: layer.opacity,
      fill: "#f0f0f0",
      selectable: !layer.locked,
      evented: !layer.locked,
      visible: layer.visible
    });
    (rect as any).layerId = layer.id;
    canvas.add(rect);
  } else if (layer.type === "text" && layer.text) {
    const text = new fabric.Textbox(layer.text, {
      left: layer.x,
      top: layer.y,
      fontSize: layer.fontSize || 24,
      fontFamily: layer.fontFamily || "Arial",
      fill: layer.fill || "#333",
      angle: layer.angle,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      opacity: layer.opacity,
      selectable: !layer.locked,
      evented: !layer.locked,
      visible: layer.visible
    });
    (text as any).layerId = layer.id;
    canvas.add(text);
  }
};

onMounted(() => {
  nextTick(() => {
    initCanvas();
    store.initLayers();
    nextTick(() => {
      renderAllLayers();
      applyCanvasTransform();
    });
  });
});

// 监听画布缩放和平移变化
watch(
  () => [store.canvasZoom, store.canvasPan],
  () => {
    applyCanvasTransform();
  },
  { deep: true }
);

// 监听画布尺寸变化
watch(
  () => [store.canvasWidth, store.canvasHeight],
  () => {
    applyCanvasSize();
  }
);

onUnmounted(() => {
  if (canvas) {
    canvas.dispose();
  }
  delete (window as any).__lovartCanvas;
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
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9e9e9;
  background-image: radial-gradient(#ccc 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
