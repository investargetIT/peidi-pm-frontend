import { defineStore } from "pinia";
import { ref, computed, nextTick } from "vue";
import type { Layer, HistorySnapshot, ChatMessage, LovartState, AiModelType } from "../types";
import { mockInitialLayers, generateId } from "../mock";
import { transferDraw, transferDrawAliyun, transferDrawQnaigc, transferGemini, type AiTransferParams } from "@/api/aiDraw";

const MAX_HISTORY_LENGTH = 50;

export const useLovartStore = defineStore("lovart", () => {
  // 状态定义
  const layers = ref<Layer[]>([]);
  const selectedLayerId = ref<string | null>(null);
  const history = ref<HistorySnapshot[]>([]);
  const historyIndex = ref(-1);
  const messages = ref<ChatMessage[]>([]);
  const canvasZoom = ref(1);
  const canvasPan = ref({ x: 0, y: 0 });
  const canvasWidth = ref(1024);
  const canvasHeight = ref(1024);
  const isGenerating = ref(false);
  const currentModel = ref<AiModelType>("aliyun");

  // 计算属性
  const selectedLayer = computed(() => {
    return layers.value.find((layer) => layer.id === selectedLayerId.value) || null;
  });

  const sortedLayers = computed(() => {
    return [...layers.value].sort((a, b) => b.zIndex - a.zIndex);
  });

  const canUndo = computed(() => {
    return historyIndex.value > 0;
  });

  // 保存历史快照
  const saveSnapshot = () => {
    const snapshot: HistorySnapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      layers: JSON.parse(JSON.stringify(layers.value))
    };

    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1);
    }

    history.value.push(snapshot);
    historyIndex.value = history.value.length - 1;

    if (history.value.length > MAX_HISTORY_LENGTH) {
      history.value.shift();
      historyIndex.value--;
    }
  };

  // 撤销
  const undo = () => {
    if (!canUndo.value) return;

    historyIndex.value--;
    const snapshot = history.value[historyIndex.value];
    if (snapshot) {
      layers.value = JSON.parse(JSON.stringify(snapshot.layers));
    }
  };

  // 初始化图层
  const initLayers = () => {
    layers.value = JSON.parse(JSON.stringify(mockInitialLayers));
    saveSnapshot();
  };

  // 选中图层
  const selectLayer = (layerId: string | null) => {
    selectedLayerId.value = layerId;
  };

  // 添加图层
  const addLayer = (layer: Omit<Layer, "id">) => {
    const newLayer: Layer = {
      ...layer,
      id: generateId()
    };
    layers.value.push(newLayer);
    selectedLayerId.value = newLayer.id;
    saveSnapshot();
    return newLayer;
  };

  // 删除图层
  const deleteLayer = (layerId: string) => {
    const index = layers.value.findIndex((l) => l.id === layerId);
    if (index !== -1) {
      layers.value.splice(index, 1);
      if (selectedLayerId.value === layerId) {
        selectedLayerId.value = null;
      }
      saveSnapshot();
    }
  };

  // 更新图层
  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (layer) {
      Object.assign(layer, updates);
      saveSnapshot();
    }
  };

  // 批量更新图层（不保存快照，用于画布拖拽等连续操作）
  const updateLayerWithoutSnapshot = (layerId: string, updates: Partial<Layer>) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (layer) {
      Object.assign(layer, updates);
    }
  };

  // 批量保存快照
  const batchSaveSnapshot = () => {
    saveSnapshot();
  };

  // 切换图层可见性
  const toggleLayerVisibility = (layerId: string) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      saveSnapshot();
    }
  };

  // 切换图层锁定
  const toggleLayerLock = (layerId: string) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (layer) {
      layer.locked = !layer.locked;
      saveSnapshot();
    }
  };

  // 移动图层顺序
  const moveLayer = (fromIndex: number, toIndex: number) => {
    const sorted = sortedLayers.value;
    const layer = sorted[fromIndex];
    if (!layer) return;

    const targetLayer = sorted[toIndex];
    if (!targetLayer) return;

    const tempZIndex = layer.zIndex;
    layer.zIndex = targetLayer.zIndex;
    targetLayer.zIndex = tempZIndex;

    saveSnapshot();
  };

  // 移动图层到顶部
  const moveLayerToTop = (layerId: string) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (!layer) return;

    const maxZ = Math.max(...layers.value.map((l) => l.zIndex));
    layer.zIndex = maxZ + 1;
    saveSnapshot();
  };

  // 移动图层到底部
  const moveLayerToBottom = (layerId: string) => {
    const layer = layers.value.find((l) => l.id === layerId);
    if (!layer) return;

    const minZ = Math.min(...layers.value.map((l) => l.zIndex));
    layer.zIndex = minZ - 1;
    saveSnapshot();
  };

  // 添加聊天消息
  const addMessage = (message: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}`,
      timestamp: Date.now()
    };
    messages.value.push(newMessage);
  };

  // 清空聊天消息
  const clearMessages = () => {
    messages.value = [];
  };

  // 设置画布缩放
  const setCanvasZoom = (zoom: number) => {
    canvasZoom.value = Math.max(0.1, Math.min(5, zoom));
  };

  // 设置画布平移
  const setCanvasPan = (x: number, y: number) => {
    canvasPan.value = { x, y };
  };

  // 重置画布
  const resetCanvas = () => {
    canvasZoom.value = 1;
    canvasPan.value = { x: 0, y: 0 };
  };

  // 设置画布尺寸
  const setCanvasSize = (width: number, height: number) => {
    canvasWidth.value = Math.max(100, Math.min(4096, width));
    canvasHeight.value = Math.max(100, Math.min(4096, height));
  };

  // 设置当前模型
  const setCurrentModel = (model: AiModelType) => {
    currentModel.value = model;
  };

  // 调用 AI 生图 API
  const generateImage = async (
    prompt: string,
    options: {
      model?: AiModelType;
      size?: string;
      n?: number;
      negativePrompt?: string;
    } = {}
  ): Promise<string[]> => {
    isGenerating.value = true;
    try {
      const { model = currentModel.value, size = "1024x1024", n = 1, negativePrompt = "" } = options;

      // 构建参数
      const params: AiTransferParams = {
        prompt,
        negative_prompt: negativePrompt,
        size,
        n
      };

      // 根据模型选择不同的中转接口
      let response: any;
      const urlParam = JSON.stringify(params);

      switch (model) {
        case "aliyun":
          response = await transferDrawAliyun({ urlParam });
          break;
        case "qnaigc":
          response = await transferDrawQnaigc({ urlParam });
          break;
        case "gemini":
          response = await transferGemini({ urlParam });
          break;
        default:
          response = await transferDraw({ urlParam });
      }

      // 解析响应结果
      const images: string[] = [];
      if (response?.success) {
        if (response.data?.images) {
          images.push(...response.data.images);
        } else if (response.data?.image) {
          images.push(response.data.image);
        } else if (Array.isArray(response.data)) {
          response.data.forEach((item: any) => {
            if (item.url || item.image) {
              images.push(item.url || item.image);
            }
          });
        }
      }

      // 如果没有获取到图片，抛出错误
      if (images.length === 0) {
        throw new Error(response?.message || "生成图片失败，请稍后重试");
      }

      return images;
    } finally {
      isGenerating.value = false;
    }
  };

  // 将生成的图片添加到画布
  const addImageToCanvas = (imageUrl: string, name = "AI 生成图片") => {
    return addLayer({
      type: "image",
      name,
      visible: true,
      locked: false,
      x: 100 + Math.random() * 100,
      y: 100 + Math.random() * 100,
      width: 512,
      height: 512,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: 999,
      opacity: 1,
      src: imageUrl
    });
  };

  return {
    // 状态
    layers,
    selectedLayerId,
    history,
    historyIndex,
    messages,
    canvasZoom,
    canvasPan,
    canvasWidth,
    canvasHeight,
    isGenerating,
    currentModel,
    // 计算属性
    selectedLayer,
    sortedLayers,
    canUndo,
    // 方法
    initLayers,
    selectLayer,
    addLayer,
    deleteLayer,
    updateLayer,
    updateLayerWithoutSnapshot,
    batchSaveSnapshot,
    toggleLayerVisibility,
    toggleLayerLock,
    moveLayer,
    moveLayerToTop,
    moveLayerToBottom,
    addMessage,
    clearMessages,
    setCanvasZoom,
    setCanvasPan,
    setCanvasSize,
    resetCanvas,
    undo,
    saveSnapshot,
    // AI 相关
    generateImage,
    addImageToCanvas,
    setCurrentModel
  };
});
