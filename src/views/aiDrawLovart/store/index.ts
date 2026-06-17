import { defineStore } from "pinia";
import { ref, computed, nextTick } from "vue";
import type {
  Layer,
  HistorySnapshot,
  ChatMessage,
  LovartState,
  AiModelType
} from "../types";
import { mockInitialLayers, generateId } from "../mock";
import {
  transferDraw,
  transferDrawAliyun,
  transferDrawQnaigc,
  transferGemini,
  type AiTransferParams
} from "@/api/aiDraw";

const MAX_HISTORY_LENGTH = 50;

export const useLovartStore = defineStore("lovart", () => {
  // 状态定义
  const layers = ref<Layer[]>([]);
  const selectedLayerId = ref<string | null>(null);
  const selectedLayerIds = ref<string[]>([]);
  const history = ref<HistorySnapshot[]>([]);
  const historyIndex = ref(-1);
  const messages = ref<ChatMessage[]>([]);
  const canvasZoom = ref(1);
  const canvasPan = ref({ x: 0, y: 0 });
  const isGenerating = ref(false);
  const currentModel = ref<AiModelType>("aliyun");
  const aiMode = ref<"chat" | "generate">("generate"); // AI 助手的模式：生图或聊天
  const hasShownWelcome = ref(false); // 是否已显示欢迎语

  // 计算属性
  const selectedLayer = computed(() => {
    return (
      layers.value.find(layer => layer.id === selectedLayerId.value) || null
    );
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

  // 重做
  const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      const snapshot = history.value[historyIndex.value];
      if (snapshot) {
        layers.value = JSON.parse(JSON.stringify(snapshot.layers));
      }
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
    selectedLayerIds.value = layerId ? [layerId] : [];
  };

  // 多选图层
  const selectLayers = (layerIds: string[]) => {
    selectedLayerIds.value = layerIds;
    selectedLayerId.value = layerIds[0] || null;
  };

  // 切换图层选中状态（用于Ctrl+点击多选）
  const toggleLayerSelection = (layerId: string) => {
    const index = selectedLayerIds.value.indexOf(layerId);
    if (index === -1) {
      selectedLayerIds.value.push(layerId);
      if (selectedLayerIds.value.length === 1) {
        selectedLayerId.value = layerId;
      }
    } else {
      selectedLayerIds.value.splice(index, 1);
      if (selectedLayerId.value === layerId) {
        selectedLayerId.value = selectedLayerIds.value[0] || null;
      }
    }
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
    const index = layers.value.findIndex(l => l.id === layerId);
    if (index !== -1) {
      layers.value.splice(index, 1);
      if (selectedLayerId.value === layerId) {
        selectedLayerId.value = null;
      }
      saveSnapshot();
    }
  };

  // 复制图层
  const duplicateLayer = (layerId: string) => {
    const layer = layers.value.find(l => l.id === layerId);
    if (layer) {
      const { id, ...layerWithoutId } = layer;
      const newLayer = addLayer({
        ...layerWithoutId,
        name: `${layer.name} (副本)`,
        x: layer.x + 20,
        y: layer.y + 20
      });
      return newLayer;
    }
  };

  // 更新图层
  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    const layer = layers.value.find(l => l.id === layerId);
    if (layer) {
      Object.assign(layer, updates);
      saveSnapshot();
    }
  };

  // 批量更新图层（不保存快照，用于画布拖拽等连续操作）
  const updateLayerWithoutSnapshot = (
    layerId: string,
    updates: Partial<Layer>
  ) => {
    const layer = layers.value.find(l => l.id === layerId);
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
    const layer = layers.value.find(l => l.id === layerId);
    if (layer) {
      layer.visible = !layer.visible;
      saveSnapshot();
    }
  };

  // 切换图层锁定
  const toggleLayerLock = (layerId: string) => {
    const layer = layers.value.find(l => l.id === layerId);
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
    const layer = layers.value.find(l => l.id === layerId);
    if (!layer) return;

    const maxZ = Math.max(...layers.value.map(l => l.zIndex));
    layer.zIndex = maxZ + 1;
    saveSnapshot();
  };

  // 移动图层到底部
  const moveLayerToBottom = (layerId: string) => {
    const layer = layers.value.find(l => l.id === layerId);
    if (!layer) return;

    const minZ = Math.min(...layers.value.map(l => l.zIndex));
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

  // 设置当前模型
  const setCurrentModel = (model: AiModelType) => {
    currentModel.value = model;
  };

  // 设置 AI 模式
  const setAiMode = (mode: "chat" | "generate") => {
    aiMode.value = mode;
  };

  // 设置是否已显示欢迎语
  const setHasShownWelcome = (shown: boolean) => {
    hasShownWelcome.value = shown;
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
      const {
        model = currentModel.value,
        size = "1K",
        n = 1,
        negativePrompt = ""
      } = options;

      // 构建参数
      let params: any;
      if (model === "aliyun") {
        // 阿里云模型参数格式
        params = {
          model: "wan2.7-image-pro",
          input: {
            messages: [
              {
                role: "user",
                content: [{ text: prompt }]
              }
            ]
          },
          parameters: {
            size: size,
            n: 1,
            watermark: false,
            thinking_mode: true
          }
        };
      } else if (model === "gemini") {
        // Gemini 模型参数格式
        params = {
          model: "gemini-3.1-flash-image-preview",
          prompt,
          image: [],
          image_config: {
            aspect_ratio: "1:1",
            image_size: size
          }
        };
      } else {
        // Qnaigc 模型参数格式
        params = {
          model: "openai/gpt-image-2",
          prompt,
          image: [],
          image_config: {
            aspect_ratio: "1:1",
            image_size: size
          }
        };
      }

      // 根据模型选择不同的中转接口
      let response: any;
      const urlParam = JSON.stringify(params);

      if (model === "aliyun") {
        response = await transferDrawAliyun({ urlParam });
      } else {
        response = await transferDrawQnaigc({ urlParam });
      }

      // 解析响应结果 - 参考创意工作室的实现
      const validImages: string[] = [];
      if (response?.code === 200 && response.data) {
        let imageUrl = null;

        if (model === "aliyun") {
          // 阿里云模型：res.data 直接是图片 URL
          imageUrl = response.data;
        } else {
          // Qnaigc/Gemini 模型：需要解析 base64
          const dataArray =
            typeof response.data === "string"
              ? JSON.parse(response.data)
              : response.data;

          if (dataArray?.[0]?.b64_json) {
            imageUrl = "data:image/png;base64," + dataArray[0].b64_json;
          }
        }

        if (imageUrl) {
          validImages.push(imageUrl);
        }
      }

      // 如果没有获取到图片，抛出错误
      if (validImages.length === 0) {
        throw new Error(response?.message || "生成图片失败，请稍后重试");
      }

      return validImages;
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

  // 调用 GPT 聊天接口
  const chatWithGemini = async (prompt: string) => {
    isGenerating.value = true;
    try {
      const params = {
        model: "gemini-3.1-pro",
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的智能画布助手，帮助用户编辑画布和内容。你的回复要友好、简洁。"
          },
          {
            role: "user",
            content: prompt
          }
        ]
      };

      const res = await transferGemini({ urlParam: JSON.stringify(params) }) as { code: number; data: string; message?: string };

      if (res.code === 200) {
        return res.data;
      } else {
        throw new Error(res.message || "AI 对话失败");
      }
    } finally {
      isGenerating.value = false;
    }
  };

  return {
    // 状态
    layers,
    selectedLayerId,
    selectedLayerIds,
    history,
    historyIndex,
    messages,
    canvasZoom,
    canvasPan,
    isGenerating,
    currentModel,
    aiMode,
    hasShownWelcome,
    // 计算属性
    selectedLayer,
    sortedLayers,
    canUndo,
    // 方法
    initLayers,
    selectLayer,
    selectLayers,
    toggleLayerSelection,
    addLayer,
    deleteLayer,
    duplicateLayer,
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
    resetCanvas,
    undo,
    redo,
    saveSnapshot,
    // AI 相关
    generateImage,
    addImageToCanvas,
    setCurrentModel,
    chatWithGemini,
    setAiMode,
    setHasShownWelcome
  };
});
