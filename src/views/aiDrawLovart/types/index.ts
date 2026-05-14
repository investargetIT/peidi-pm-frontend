export type LayerType = 'image' | 'text';

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
  fill?: string;
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
}

export interface LovartState {
  layers: Layer[];
  selectedLayerId: string | null;
  history: HistorySnapshot[];
  historyIndex: number;
  messages: ChatMessage[];
  canvasZoom: number;
  canvasPan: { x: number; y: number };
}
