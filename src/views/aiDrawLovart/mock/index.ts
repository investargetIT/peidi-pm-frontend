import type { Layer } from "../types";

// 生成唯一 ID
export const generateId = (): string => {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 初始 Mock 图层数据
export const mockInitialLayers: Layer[] = [
  {
    id: "layer_bg_001",
    type: "image",
    name: "背景图",
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 0,
    opacity: 1,
    src: "https://picsum.photos/800/600?random=101"
  },
  {
    id: "layer_text_001",
    type: "text",
    name: "主标题",
    visible: true,
    locked: false,
    x: 100,
    y: 120,
    width: 300,
    height: 60,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    opacity: 1,
    text: "Hello Lovart",
    fontSize: 48,
    fontFamily: "Arial",
    fill: "#ff4444"
  },
  {
    id: "layer_text_002",
    type: "text",
    name: "副标题",
    visible: true,
    locked: false,
    x: 100,
    y: 200,
    width: 400,
    height: 40,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 2,
    opacity: 1,
    text: "SmartCanvas AI Design",
    fontSize: 24,
    fontFamily: "Arial",
    fill: "#333333"
  },
  {
    id: "layer_image_001",
    type: "image",
    name: "装饰图案",
    visible: true,
    locked: false,
    x: 550,
    y: 400,
    width: 180,
    height: 150,
    angle: -10,
    scaleX: 1,
    scaleY: 1,
    zIndex: 3,
    opacity: 0.9,
    src: "https://picsum.photos/180/150?random=102"
  }
];

// 模拟 AI 响应 - 修改图层颜色
export const mockAiColorResponse = (layerId: string, newColor: string): Partial<Layer> => {
  return {
    id: layerId,
    fill: newColor
  };
};

// 模拟 AI 响应 - 修改文本内容
export const mockAiTextResponse = (layerId: string, newText: string): Partial<Layer> => {
  return {
    id: layerId,
    text: newText
  };
};

// 模拟 AI 响应 - 添加新文本图层
export const mockAiNewTextLayer = (text: string, x: number, y: number): Layer => {
  return {
    id: generateId(),
    type: "text",
    name: "AI生成文本",
    visible: true,
    locked: false,
    x: x,
    y: y,
    width: 200,
    height: 40,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 99,
    opacity: 1,
    text: text,
    fontSize: 28,
    fontFamily: "Arial",
    fill: "#409eff"
  };
};

// 预设颜色选项
export const mockColorOptions = [
  "#ff4444",
  "#409eff",
  "#67c23a",
  "#e6a23c",
  "#909399",
  "#303133",
  "#ffffff",
  "#000000"
];
