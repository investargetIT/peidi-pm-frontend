<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, nextTick } from "vue";
import * as fabric from "fabric";
import { useLovartStore } from "../store";
import type { Layer } from "../types";
import { storeToRefs } from "pinia";

const props = defineProps<{
  width?: number;
  height?: number;
}>();

const emit = defineEmits<{
  (e: "layer:dblclick", layerId: string): void;
}>();

const store = useLovartStore();
const { layers, selectedLayerId, canvasZoom, canvasPan, sortedLayers } = storeToRefs(store);

const canvasContainer = ref<HTMLDivElement | null>(null);
let canvas: fabric.Canvas | null = null;
let fabricObjects = new Map<string, fabric.Object>();
let isUpdatingFromStore = false;
let isPanning = false;
let lastPosX = 0;
let lastPosY = 0;

const initCanvas = () => {
  if (!canvasContainer.value) return;

  canvas = new fabric.Canvas("lovart-canvas", {
    width: props.width || 1200,
    height: props.height || 800,
    backgroundColor: "#f5f7fa",
    selection: true,
    preserveObjectStacking: true
  });

  canvas.on("mouse:down", handleMouseDown);
  canvas.on("mouse:move", handleMouseMove);
  canvas.on("mouse:up", handleMouseUp);
  canvas.on("selection:created", handleSelectionCreated);
  canvas.on("selection:updated", handleSelectionUpdated);
  canvas.on("selection:cleared", handleSelectionCleared);
  canvas.on("object:modified", handleObjectModified);
  canvas.on("object:moving", handleObjectMoving);
  canvas.on("object:scaling", handleObjectScaling);
  canvas.on("object:rotating", handleObjectRotating);
  canvas.on("mouse:dblclick", handleDoubleClick);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", handleResize);

  handleResize();
  renderLayers();
};

const handleResize = () => {
  if (!canvas || !canvasContainer.value) return;
  const rect = canvasContainer.value.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  canvas.renderAll();
};

const handleMouseDown = (opt: any) => {
  if (!canvas) return;
  const evt = opt.e as MouseEvent;
  if (evt.button === 1 || (evt.button === 0 && evt.altKey)) {
    isPanning = true;
    lastPosX = evt.clientX;
    lastPosY = evt.clientY;
    canvas.selection = false;
    evt.preventDefault();
  }
};

const handleMouseMove = (opt: any) => {
  if (!canvas || !isPanning) return;
  const evt = opt.e as MouseEvent;
  const deltaX = evt.clientX - lastPosX;
  const deltaY = evt.clientY - lastPosY;

  const vpt = canvas.viewportTransform;
  if (vpt) {
    vpt[4] += deltaX;
    vpt[5] += deltaY;
    canvas.setViewportTransform(vpt);
    store.setCanvasPan(vpt[4], vpt[5]);
  }

  lastPosX = evt.clientX;
  lastPosY = evt.clientY;
};

const handleMouseUp = () => {
  if (!canvas) return;
  isPanning = false;
  canvas.selection = true;
};

const handleSelectionCreated = (opt: any) => {
  if (isUpdatingFromStore) return;
  const selected = opt.selected;
  if (selected && selected.length > 0) {
    const obj = selected[0];
    if (obj && (obj as any).data) {
      store.selectLayer(((obj as any).data as any).layerId);
    }
  }
};

const handleSelectionUpdated = (opt: any) => {
  if (isUpdatingFromStore) return;
  const selected = opt.selected;
  if (selected && selected.length > 0) {
    const obj = selected[0];
    if (obj && (obj as any).data) {
      store.selectLayer(((obj as any).data as any).layerId);
    }
  }
};

const handleSelectionCleared = () => {
  if (isUpdatingFromStore) return;
  store.selectLayer(null);
};

const handleObjectModified = () => {
  store.batchSaveSnapshot();
};

const updateLayerFromObject = (obj: fabric.Object) => {
  if (!(obj as any).data) return;
  const layerId = ((obj as any).data as any).layerId;
  store.updateLayerWithoutSnapshot(layerId, {
    x: obj.left || 0,
    y: obj.top || 0,
    angle: obj.angle || 0,
    scaleX: obj.scaleX || 1,
    scaleY: obj.scaleY || 1,
    width: (obj.width || 0) * (obj.scaleX || 1),
    height: (obj.height || 0) * (obj.scaleY || 1)
  });
};

const handleObjectMoving = (opt: any) => {
  const obj = opt.target;
  if (obj) {
    updateLayerFromObject(obj);
  }
};

const handleObjectScaling = (opt: any) => {
  const obj = opt.target;
  if (obj) {
    updateLayerFromObject(obj);
  }
};

const handleObjectRotating = (opt: any) => {
  const obj = opt.target;
  if (obj) {
    updateLayerFromObject(obj);
  }
};

const handleDoubleClick = (opt: any) => {
  const obj = opt.target;
  if (obj && (obj as any).data) {
    const layerId = ((obj as any).data as any).layerId;
    const layer = layers.value.find((l) => l.id === layerId);
    if (layer && layer.type === "text" && !layer.locked) {
      emit("layer:dblclick", layerId);
    }
  }
};

const handleKeyDown = (evt: KeyboardEvent) => {
  if ((evt.ctrlKey || evt.metaKey) && evt.key === "z") {
    evt.preventDefault();
    store.undo();
  }
};

const renderLayers = () => {
  if (!canvas) return;
  isUpdatingFromStore = true;

  canvas.getObjects().forEach((obj) => {
    canvas!.remove(obj);
  });
  fabricObjects.clear();

  const sorted = [...layers.value].sort((a, b) => a.zIndex - b.zIndex);

  sorted.forEach((layer) => {
    const obj = createFabricObject(layer);
    if (obj) {
      fabricObjects.set(layer.id, obj);
      canvas!.add(obj);
    }
  });

  if (selectedLayerId.value) {
    const selectedObj = fabricObjects.get(selectedLayerId.value);
    if (selectedObj) {
      canvas.setActiveObject(selectedObj);
    }
  }

  canvas.renderAll();
  isUpdatingFromStore = false;
};

const createFabricObject = (layer: Layer): fabric.Object | null => {
  let obj: fabric.Object | null = null;

  if (layer.type === "image" && layer.src) {
    obj = new fabric.Rect({
      left: layer.x,
      top: layer.y,
      width: layer.width,
      height: layer.height,
      angle: layer.angle,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      opacity: layer.opacity,
      fill: "#ddd",
      selectable: !layer.locked,
      evented: !layer.locked,
      visible: layer.visible
    });

    fabric.Image.fromURL(layer.src).then((img: fabric.Image) => {
      img.set({
        left: layer.x,
        top: layer.y,
        width: layer.width,
        height: layer.height,
        angle: layer.angle,
        scaleX: layer.scaleX,
        scaleY: layer.scaleY,
        opacity: layer.opacity,
        selectable: !layer.locked,
        evented: !layer.locked,
        visible: layer.visible
      });
      (img as any).data = { layerId: layer.id };

      const oldObj = fabricObjects.get(layer.id);
      if (oldObj && canvas) {
        canvas.remove(oldObj);
      }

      fabricObjects.set(layer.id, img);
      if (canvas) {
        canvas.add(img);
        if (selectedLayerId.value === layer.id) {
          canvas.setActiveObject(img);
        }
        canvas.renderAll();
      }
    });
  } else if (layer.type === "text" && layer.text) {
    obj = new fabric.Textbox(layer.text, {
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
  }

  if (obj) {
    (obj as any).data = { layerId: layer.id };
  }

  return obj;
};

const updateSingleLayer = (layer: Layer) => {
  if (!canvas || isUpdatingFromStore) return;
  isUpdatingFromStore = true;

  const oldObj = fabricObjects.get(layer.id);
  if (oldObj) {
    canvas.remove(oldObj);
  }

  const newObj = createFabricObject(layer);
  if (newObj) {
    fabricObjects.set(layer.id, newObj);
    canvas.add(newObj);

    if (selectedLayerId.value === layer.id) {
      canvas.setActiveObject(newObj);
    }
  }

  canvas.renderAll();
  isUpdatingFromStore = false;
};

watch(
  () => layers.value.length,
  () => {
    renderLayers();
  }
);

watch(selectedLayerId, (newId) => {
  if (!canvas || isUpdatingFromStore) return;
  isUpdatingFromStore = true;

  if (newId) {
    const obj = fabricObjects.get(newId);
    if (obj) {
      canvas.setActiveObject(obj);
    }
  } else {
    canvas.discardActiveObject();
  }

  canvas.renderAll();
  isUpdatingFromStore = false;
});

watch(
  sortedLayers,
  (newLayers) => {
    if (!canvas || isUpdatingFromStore) return;

    const sorted = [...newLayers].sort((a, b) => a.zIndex - b.zIndex);
    sorted.forEach((layer) => {
      const obj = fabricObjects.get(layer.id);
      if (obj) {
        canvas!.moveObjectTo(obj, layer.zIndex + 1000);
      }
    });

    canvas!.renderAll();
  },
  { deep: true }
);

onMounted(() => {
  nextTick(() => {
    initCanvas();
    store.initLayers();
  });
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("resize", handleResize);
  if (canvas) {
    canvas.dispose();
  }
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
  background: #e9e9e9;
  background-image: radial-gradient(#ccc 1px, transparent 1px);
  background-size: 20px 20px;

  :deep(#lovart-canvas) {
    cursor: default;
  }
}
</style>
