import { defineStore } from "pinia";
import { ref, computed, nextTick } from "vue";
import type {
  Layer,
  HistorySnapshot,
  ChatMessage,
  LovartState,
  AiModelType
} from "../types";
import type { ShapeType } from "../types";
import { mockInitialLayers, generateId } from "../mock";
import {
  transferDraw,
  transferDrawAliyun,
  transferDrawQnaigc,
  transferGemini,
  transferAliyunChat,
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
  const currentModel = ref<AiModelType>("aliyun"); // 生图模型
  const currentChatModel = ref<AiModelType>("aliyunChat"); // 聊天模型
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

    // 保存到 localStorage
    saveToLocalStorage();
  };

  // 撤销
  const undo = () => {
    if (!canUndo.value) return;

    historyIndex.value--;
    const snapshot = history.value[historyIndex.value];
    if (snapshot) {
      layers.value = JSON.parse(JSON.stringify(snapshot.layers));
      saveToLocalStorage();
    }
  };

  // 重做
  const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      const snapshot = history.value[historyIndex.value];
      if (snapshot) {
        layers.value = JSON.parse(JSON.stringify(snapshot.layers));
        saveToLocalStorage();
      }
    }
  };

  // 从 localStorage 加载数据
  const loadFromLocalStorage = () => {
    try {
      const savedData = localStorage.getItem("lovart-canvas-data");
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (
          parsed.layers &&
          parsed.history &&
          parsed.historyIndex !== undefined
        ) {
          layers.value = parsed.layers;
          history.value = parsed.history;
          historyIndex.value = parsed.historyIndex;
          canvasZoom.value = parsed.canvasZoom || 1;
          canvasPan.value = parsed.canvasPan || { x: 0, y: 0 };
          currentModel.value = parsed.currentModel || "aliyun";
          currentChatModel.value = parsed.currentChatModel || "aliyunChat";
          aiMode.value = parsed.aiMode || "generate";
          return true;
        }
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return false;
  };

  // 保存到 localStorage
  const saveToLocalStorage = () => {
    try {
      const dataToSave = {
        layers: layers.value,
        history: history.value,
        historyIndex: historyIndex.value,
        canvasZoom: canvasZoom.value,
        canvasPan: canvasPan.value,
        currentModel: currentModel.value,
        currentChatModel: currentChatModel.value,
        aiMode: aiMode.value
      };
      localStorage.setItem("lovart-canvas-data", JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  };

  // 初始化图层
  const initLayers = () => {
    // 首先尝试从 localStorage 加载
    const loaded = loadFromLocalStorage();
    if (!loaded) {
      // 如果加载失败，使用默认的初始图层
      layers.value = JSON.parse(JSON.stringify(mockInitialLayers));
      saveSnapshot();
    }
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
    // 保存到 localStorage（防抖处理，避免频繁保存）
    debouncedSaveToLocalStorage();
  };

  // 设置画布平移
  const setCanvasPan = (x: number, y: number) => {
    canvasPan.value = { x, y };
    // 保存到 localStorage（防抖处理，避免频繁保存）
    debouncedSaveToLocalStorage();
  };

  // 防抖保存到 localStorage
  let saveToLocalStorageTimer: number | null = null;
  const debouncedSaveToLocalStorage = () => {
    if (saveToLocalStorageTimer) {
      clearTimeout(saveToLocalStorageTimer);
    }
    saveToLocalStorageTimer = window.setTimeout(() => {
      saveToLocalStorage();
      saveToLocalStorageTimer = null;
    }, 500);
  };

  // 重置画布视图
  const resetCanvas = () => {
    canvasZoom.value = 1;
    canvasPan.value = { x: 0, y: 0 };
  };

  // 重置所有到初始状态
  const resetAllToInitial = () => {
    // 清除 localStorage
    localStorage.removeItem("lovart-canvas-data");

    // 清空并重置为初始图层
    layers.value = JSON.parse(JSON.stringify(mockInitialLayers));
    history.value = [];
    historyIndex.value = -1;
    selectedLayerId.value = null;
    selectedLayerIds.value = [];
    canvasZoom.value = 1;
    canvasPan.value = { x: 0, y: 0 };
    messages.value = [];
    hasShownWelcome.value = false;

    // 保存快照
    saveSnapshot();
  };

  // 设置当前生图模型
  const setCurrentModel = (model: AiModelType) => {
    currentModel.value = model;
    debouncedSaveToLocalStorage();
  };

  // 设置当前聊天模型
  const setCurrentChatModel = (model: AiModelType) => {
    currentChatModel.value = model;
    debouncedSaveToLocalStorage();
  };

  // 设置 AI 模式
  const setAiMode = (mode: "chat" | "generate") => {
    aiMode.value = mode;
    debouncedSaveToLocalStorage();
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

  // 添加形状到画布
  const addShapeToCanvas = (shapeType: ShapeType, name = "形状", options: Partial<Layer> = {}) => {
    const maxZ = layers.value.length > 0 ? Math.max(...layers.value.map(l => l.zIndex)) + 1 : 0;

    return addLayer({
      type: "shape",
      shapeType,
      name,
      visible: true,
      locked: false,
      x: options.x || 200 + Math.random() * 100,
      y: options.y || 200 + Math.random() * 100,
      width: options.width || 100,
      height: options.height || 100,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      zIndex: maxZ,
      opacity: 1,
      fill: options.fill || "#409eff",
      stroke: options.stroke || "#303133",
      strokeWidth: options.strokeWidth || 0,
      ...options
    });
  };

  // 调用 AI 聊天接口
  const chatWithGemini = async (prompt: string) => {
    isGenerating.value = true;
    try {
      let res;

      if (currentChatModel.value === "aliyunChat") {
        // 调用阿里云通义千问聊天接口
        const params = {
          model: "qwen3.7-plus", // 可以根据需要调整模型名称
          stream: false,
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
          ],
          enable_thinking: false
        };
        res = (await transferAliyunChat({
          urlParam: JSON.stringify(params)
        })) as { code: number; data: string; message?: string };
      } else {
        // 默认调用 Gemini 接口
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
        res = (await transferGemini({ urlParam: JSON.stringify(params) })) as {
          code: number;
          data: string;
          message?: string;
        };
      }

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
    currentChatModel,
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
    resetAllToInitial,
    undo,
    redo,
    saveSnapshot,
    // AI 相关
    generateImage,
    addImageToCanvas,
    addShapeToCanvas,
    setCurrentModel,
    setCurrentChatModel,
    chatWithGemini,
    setAiMode,
    setHasShownWelcome
  };
});
