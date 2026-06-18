export type LayerType = 'image' | 'text' | 'shape' | 'group';

export type ShapeType = 'rect' | 'triangle';

export interface Layer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  opacity: number;
  // 图片图层专用
  src?: string;
  // 文本图层专用
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  // 形状和文本通用
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // 形状图层专用
  shapeType?: ShapeType;
  // 圆形/椭圆专用
  rx?: number;
  ry?: number;
  // 图层组专用
  children?: string[]; // 子图层 ID 列表
  parentId?: string; // 父图层组 ID
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  layers: Layer[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  targetLayerId?: string;
  // 消息类型 - 用于区分普通对话和生图结果
  messageType?: 'text' | 'image_result';
  // 生图结果图片
  resultImages?: string[];
}

export interface LovartState {
  layers: Layer[];
  selectedLayerId: string | null;
  selectedLayerIds: string[];
  history: HistorySnapshot[];
  historyIndex: number;
  messages: ChatMessage[];
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  // 是否正在生成图片
  isGenerating: boolean;
}

// 预设 AI 模型
export type AiModelType = 'default' | 'aliyun' | 'qnaigc' | 'gemini' | 'aliyunChat';

// 生图配置
export interface GenerateImageConfig {
  model: AiModelType;
  size: string;
  n: number;
}

