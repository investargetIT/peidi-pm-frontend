<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";
import { useLovartStore } from "../store";
import { storeToRefs } from "pinia";
import {
  ChatDotRound,
  ChatRound,
  RefreshLeft,
  Close,
  MagicStick,
  Warning
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { ChatMessage } from "../types";
import { mockAiColorResponse, mockAiTextResponse, mockAiNewTextLayer, mockColorOptions } from "../mock";

const props = defineProps<{
  showLayerPanel?: boolean;
}>();

const emit = defineEmits<{
  (e: "edit:text", layerId: string): void;
}>();

const store = useLovartStore();
const { messages, selectedLayer, selectedLayerId } = storeToRefs(store);

const inputValue = ref("");
const isLoading = ref(false);
const messagesContainer = ref<HTMLDivElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
};

const parseInstruction = (text: string) => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("颜色") || lowerText.includes("红色") || lowerText.includes("蓝色") || lowerText.includes("绿色")) {
    let color = "#409eff";
    if (lowerText.includes("红色")) color = "#ff4444";
    if (lowerText.includes("蓝色")) color = "#409eff";
    if (lowerText.includes("绿色")) color = "#67c23a";
    if (lowerText.includes("黄色")) color = "#e6a23c";
    if (lowerText.includes("橙色")) color = "#ff9800";
    if (lowerText.includes("紫色")) color = "#9c27b0";
    if (lowerText.includes("黑色")) color = "#000000";
    if (lowerText.includes("白色")) color = "#ffffff";
    return { type: "color", color };
  }

  if (lowerText.includes("改成") || lowerText.includes("改为") || lowerText.includes("修改文字")) {
    const match = text.match(/(?:改成|改为|修改文字)[：:]\s*(.+)/);
    if (match && match[1]) {
      return { type: "text", text: match[1] };
    }
  }

  if (lowerText.includes("添加文字") || lowerText.includes("添加文本")) {
    const match = text.match(/(?:添加文字|添加文本)[：:]\s*(.+)/);
    if (match && match[1]) {
      return { type: "new_text", text: match[1] };
    }
    return { type: "new_text", text: "新文字" };
  }

  return { type: "unknown" };
};

const handleSend = async () => {
  if (!inputValue.value.trim()) return;

  const userMessage = inputValue.value.trim();
  inputValue.value = "";

  store.addMessage({
    role: "user",
    content: userMessage,
    targetLayerId: selectedLayerId.value || undefined
  });

  scrollToBottom();
  isLoading.value = true;

  await new Promise((resolve) => setTimeout(resolve, 1500));

  const instruction = parseInstruction(userMessage);
  let responseContent = "已收到您的指令，正在处理...";

  if (selectedLayer.value) {
    if (instruction.type === "color") {
      store.updateLayer(selectedLayer.value.id, {
        fill: instruction.color
      });
      responseContent = `已将选中图层「${selectedLayer.value.name}」的颜色修改为 ${instruction.color}`;
    } else if (instruction.type === "text" && selectedLayer.value.type === "text") {
      store.updateLayer(selectedLayer.value.id, {
        text: instruction.text
      });
      responseContent = `已将选中图层「${selectedLayer.value.name}」的文字修改为「${instruction.text}」`;
    } else {
      responseContent = `已接收对图层「${selectedLayer.value.name}」的调整指令，尝试优化中...`;
      if (selectedLayer.value.type === "text") {
        const randomColor = mockColorOptions[Math.floor(Math.random() * mockColorOptions.length)];
        store.updateLayer(selectedLayer.value.id, { fill: randomColor });
        responseContent += ` 已尝试将文字颜色调整为 ${randomColor}`;
      }
    }
  } else {
    if (instruction.type === "new_text") {
      const newLayer = store.addLayer({
        type: "text",
        name: "AI生成文本",
        visible: true,
        locked: false,
        x: 200,
        y: 300,
        width: 200,
        height: 40,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        zIndex: 99,
        opacity: 1,
        text: instruction.text,
        fontSize: 28,
        fontFamily: "Arial",
        fill: "#409eff"
      });
      responseContent = `已在画布上添加新的文字图层「${newLayer.name}」`;
    } else {
      responseContent = "请先在画布上选中一个图层，然后我可以帮您调整它。您可以尝试说：\n• 把颜色改成红色\n• 添加文字：你好世界\n• 修改文字：新内容";
    }
  }

  store.addMessage({
    role: "assistant",
    content: responseContent,
    targetLayerId: selectedLayerId.value || undefined
  });

  isLoading.value = false;
  scrollToBottom();
};

const handleKeyDown = (evt: KeyboardEvent) => {
  if (evt.key === "Enter" && !evt.shiftKey) {
    evt.preventDefault();
    handleSend();
  }
};

const handleQuickCommand = (cmd: string) => {
  if (selectedLayer.value) {
    inputValue.value = cmd;
  } else {
    ElMessage.warning("请先选中一个图层");
  }
};

const handleClearChat = async () => {
  try {
    store.clearMessages();
    ElMessage.success("已清空对话记录");
  } catch {
    //
  }
};

onMounted(() => {
  store.addMessage({
    role: "assistant",
    content: "你好！我是 SmartCanvas AI。请在画布上选中一个元素，然后告诉我想要如何调整它。\n\n试试说：\n• 把颜色改成蓝色\n• 添加文字：Hello World"
  });
});
</script>

<template>
  <div class="chat-panel">
    <div class="panel-header">
      <div class="header-left">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI 助手</span>
      </div>
      <el-button circle size="small" link @click="handleClearChat">
        <el-icon><RefreshLeft /></el-icon>
      </el-button>
    </div>

    <div v-if="selectedLayer" class="selected-layer-banner">
      <el-icon><ChatRound /></el-icon>
      <span>已选中：{{ selectedLayer.name }}</span>
      <el-tag size="small" type="info">{{ selectedLayer.type === 'image' ? '图片' : '文字' }}</el-tag>
    </div>

    <div v-else class="no-selection-banner">
      <el-icon><Warning /></el-icon>
      <span>请在画布上选中一个元素</span>
    </div>

    <div ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-chat">
        <div class="empty-icon">
          <el-icon :size="48"><MagicStick /></el-icon>
        </div>
        <p>开始与 AI 对话</p>
        <p class="hint">选中图层后，告诉我您想要什么效果</p>
      </div>

      <div v-else class="messages-list">
        <div v-for="msg in messages" :key="msg.id" class="message-item" :class="msg.role">
          <div class="avatar">
            <el-icon v-if="msg.role === 'user'"><User /></el-icon>
            <el-icon v-else><MagicStick /></el-icon>
          </div>
          <div class="content">
            <div class="bubble">
              <span class="text">{{ msg.content }}</span>
            </div>
            <span class="time">{{ formatTime(msg.timestamp) }}</span>
          </div>
        </div>

        <div v-if="isLoading" class="message-item assistant">
          <div class="avatar">
            <el-icon><MagicStick /></el-icon>
          </div>
          <div class="content">
            <div class="bubble loading">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="quick-commands">
      <el-tag
        v-for="cmd in ['把颜色改成红色', '把颜色改成蓝色', '把颜色改成绿色']"
        :key="cmd"
        size="small"
        class="quick-tag"
        @click="handleQuickCommand(cmd)"
      >
        {{ cmd }}
      </el-tag>
    </div>

    <div class="input-area">
      <el-input
        v-model="inputValue"
        type="textarea"
        :rows="3"
        placeholder="输入指令... (选中图层后，试试说：改成蓝色)"
        @keydown="handleKeyDown"
      />
      <div class="input-footer">
        <span class="hint">按 Enter 发送</span>
        <el-button type="primary" :loading="isLoading" @click="handleSend">发送</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { User } from "@element-plus/icons-vue";
export default {
  components: { User }
};
</script>

<style scoped lang="scss">
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-left: 1px solid #e4e7ed;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }
}

.selected-layer-banner,
.no-selection-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid #e4e7ed;

  .el-tag {
    margin-left: auto;
  }
}

.selected-layer-banner {
  background: #f0f9ff;
  color: #409eff;
}

.no-selection-banner {
  background: #fdf6ec;
  color: #e6a23c;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f7fa;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;

  .empty-icon {
    color: #c0c4cc;
    margin-bottom: 16px;
  }

  p {
    margin: 4px 0;
    font-size: 14px;

    &.hint {
      font-size: 12px;
      color: #c0c4cc;
    }
  }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-item {
  display: flex;
  gap: 10px;

  &.user {
    flex-direction: row-reverse;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  &.user .avatar {
    background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  }

  .content {
    max-width: 75%;
    display: flex;
    flex-direction: column;

    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      white-space: pre-wrap;
      word-break: break-word;

      .text {
        font-size: 14px;
        color: #303133;
        line-height: 1.6;
      }

      &.loading {
        display: flex;
        gap: 4px;
        padding: 16px 20px;

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #c0c4cc;
          animation: bounce 1.4s infinite ease-in-out;

          &:nth-child(1) {
            animation-delay: -0.32s;
          }
          &:nth-child(2) {
            animation-delay: -0.16s;
          }
        }
      }
    }

    &.user .bubble {
      background: #ecf5ff;
    }

    .time {
      font-size: 11px;
      color: #c0c4cc;
      margin-top: 4px;
      padding: 0 4px;
    }
  }

  &.user .content {
    align-items: flex-end;
  }
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.quick-commands {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  border-top: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;

  .quick-tag {
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
      background: #ecf5ff;
      border-color: #409eff;
      color: #409eff;
    }
  }
}

.input-area {
  padding: 12px 16px;
  background: #fff;

  .input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;

    .hint {
      font-size: 12px;
      color: #c0c4cc;
    }
  }
}
</style>
