import type { Layer } from "../types";

// 生成唯一 ID
export const generateId = (): string => {
  return `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 初始 Mock 图层数据 - 简化版本
export const mockInitialLayers: Layer[] = [
  {
    id: "layer_bg_001",
    type: "image",
    name: "背景画布",
    visible: true,
    locked: true,
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 0,
    opacity: 1
  },
  {
    id: "layer_text_001",
    type: "text",
    name: "欢迎文本",
    visible: true,
    locked: false,
    x: 200,
    y: 250,
    width: 400,
    height: 60,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 1,
    opacity: 1,
    text: "开始你的创作",
    fontSize: 40,
    fontFamily: "Arial",
    fill: "#303133"
  },
  {
    id: "layer_text_002",
    type: "text",
    name: "提示文本",
    visible: true,
    locked: false,
    x: 200,
    y: 320,
    width: 400,
    height: 40,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 2,
    opacity: 1,
    text: "使用 AI 助手生成图片或编辑元素",
    fontSize: 18,
    fontFamily: "Arial",
    fill: "#909399"
  }
];
