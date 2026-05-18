<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";
import { useLovartStore } from "../store";
import { storeToRefs } from "pinia";
import { ChatDotRound, ChatRound, RefreshLeft, MagicStick, Warning } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { ChatMessage, AiModelType } from "../types";

const emit = defineEmits<{
  (e: "edit:text", layerId: string): void;
  (e: "refreshCanvas"): void;
}>();

const store = useLovartStore();
const { messages, selectedLayer, selectedLayerId, isGenerating, currentModel } = storeToRefs(store);

const inputValue = ref("");
const messagesContainer = ref<HTMLDivElement | null>(null);
const mode = ref<"chat" | "generate">("generate"); // 默认是生图模式
const negativePrompt = ref("");
const imageSize = ref("1024x1024");
const imageCount = ref(1);
const isAdvancedSettingsOpen = ref(false);

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

// 解析指令 - 用于聊天模式
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

// 发送消息/生图
const handleSend = async () => {
  if (!inputValue.value.trim()) return;

  const userContent = inputValue.value.trim();
  inputValue.value = "";

  if (mode.value === "generate") {
    // 生图模式
    await handleGenerateImage(userContent);
  } else {
    // 聊天模式 - 处理图层编辑
    await handleChat(userContent);
  }
};

// 处理生图
const handleGenerateImage = async (prompt: string) => {
  // 添加用户消息
  store.addMessage({
    role: "user",
    content: prompt,
    messageType: "text"
  });
  scrollToBottom();

  try {
    // 调用 API 生图
    const images = await store.generateImage(prompt, {
      model: currentModel.value,
      size: imageSize.value,
      n: imageCount.value,
      negativePrompt: negativePrompt.value
    });

    // 添加 AI 回复，带有生图结果
    store.addMessage({
      role: "assistant",
      content: `已为您生成 ${images.length} 张图片，点击图片可添加到画布。`,
      messageType: "image_result",
      resultImages: images
    });

    ElMessage.success("图片生成成功！");
  } catch (error: any) {
    store.addMessage({
      role: "assistant",
      content: `生成图片失败：${error.message || "请稍后重试"}`,
      messageType: "text"
    });
    ElMessage.error(error.message || "生成图片失败");
  }

  scrollToBottom();
};

// 处理聊天编辑
const handleChat = async (userContent: string) => {
  store.addMessage({
    role: "user",
    content: userContent,
    targetLayerId: selectedLayerId.value || undefined
  });

  scrollToBottom();

  await nextTick();

  let responseContent = "已收到您的指令，正在处理...";

  if (selectedLayer.value) {
    const instruction = parseInstruction(userContent);
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
    }
  } else {
    const instruction = parseInstruction(userContent);
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
      responseContent = "请先在画布上选中一个图层，然后告诉我想要如何调整它。";
    }
  }

  store.addMessage({
    role: "assistant",
    content: responseContent,
    targetLayerId: selectedLayerId.value || undefined
  });

  scrollToBottom();
};

// 将图片添加到画布
const handleAddImageToCanvas = (imageUrl: string, index: number) => {
  store.addImageToCanvas(imageUrl, `AI 生成图片 #${index + 1}`);
  emit("refreshCanvas"); // 通知父组件刷新画布
  ElMessage.success("已添加到画布");
};

// 切换模型
const handleModelChange = (model: AiModelType) => {
  store.setCurrentModel(model);
};

const handleKeyDown = (evt: KeyboardEvent) => {
  if (evt.key === "Enter" && !evt.shiftKey) {
    evt.preventDefault();
    handleSend();
  }
};

const handleClearChat = async () => {
  store.clearMessages();
  ElMessage.success("已清空对话记录");
};

onMounted(() => {
  store.addMessage({
    role: "assistant",
    content: "你好！我是 SmartCanvas AI。在「生图」模式中输入提示词来生成图片，或切换到「聊天」模式来编辑画布上的元素。",
    messageType: "text"
  });
});
</script>

<template>
  <div class="chat-panel">
    <!-- 顶部模式切换 -->
    <div class="mode-tabs">
      <div
        class="mode-tab"
        :class="{ active: mode === 'generate' }"
        @click="mode = 'generate'"
      >
        <MagicStick />
        <span>生图</span>
      </div>
      <div
        class="mode-tab"
        :class="{ active: mode === 'chat' }"
        @click="mode = 'chat'"
      >
        <ChatDotRound />
        <span>聊天</span>
      </div>
    </div>

    <!-- 生图模式的模型选择和高级设置 -->
    <div v-if="mode === 'generate'" class="model-selector">
      <div class="model-buttons">
        <button
          v-for="m in ['aliyun', 'qnaigc', 'default'] as AiModelType[]"
          :key="m"
          class="model-btn"
          :class="{ active: currentModel === m }"
          @click="handleModelChange(m)"
        >
          {{ m === 'aliyun' ? '阿里云' : m === 'qnaigc' ? 'Qnaigc' : '默认' }}
        </button>
      </div>
      <div class="advanced-toggle" @click="isAdvancedSettingsOpen = !isAdvancedSettingsOpen">
        <span>高级设置</span>
        <span class="arrow" :class="{ open: isAdvancedSettingsOpen }">▼</span>
      </div>
      <div v-if="isAdvancedSettingsOpen" class="advanced-settings">
        <div class="setting-item">
          <label>尺寸</label>
          <select v-model="imageSize">
            <option value="512x512">512x512</option>
            <option value="768x768">768x768</option>
            <option value="1024x1024">1024x1024</option>
            <option value="1024x768">1024x768</option>
            <option value="768x1024">768x1024</option>
          </select>
        </div>
        <div class="setting-item">
          <label>数量</label>
          <select v-model="imageCount">
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="4">4</option>
          </select>
        </div>
        <div class="setting-item">
          <label>负面提示词</label>
          <input v-model="negativePrompt" type="text" placeholder="不想出现的元素..." />
        </div>
      </div>
    </div>

    <!-- 聊天模式的选中图层提示 -->
    <div v-if="mode === 'chat'" class="layer-info-bar">
      <div v-if="selectedLayer" class="selected-layer-info">
        <ChatRound />
        <span>已选中：{{ selectedLayer.name }}</span>
      </div>
      <div v-else class="no-selection-info">
        <Warning />
        <span>请在画布上选中一个元素</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-chat">
        <div class="empty-icon">
          <MagicStick />
        </div>
        <p>开始与 AI 对话</p>
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
              <!-- 生图结果展示 -->
              <div v-if="msg.messageType === 'image_result' && msg.resultImages" class="result-images">
                <div
                  v-for="(img, idx) in msg.resultImages"
                  :key="idx"
                  class="result-image-item"
                  @click="handleAddImageToCanvas(img, idx)"
                >
                  <img :src="img" :alt="`生成图片 ${idx + 1}`" />
                  <div class="image-overlay">
                    <span>点击添加到画布</span>
                  </div>
                </div>
              </div>
            </div>
            <span class="time">{{ formatTime(msg.timestamp) }}</span>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="isGenerating" class="message-item assistant">
          <div class="avatar">
            <MagicStick />
          </div>
          <div class="content">
            <div class="bubble loading">
              <span class="text">正在生成图片中</span>
              <div class="dots">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 快捷提示词（生图模式） -->
    <div v-if="mode === 'generate'" class="quick-commands">
      <span
        v-for="cmd in ['可爱的猫咪', '未来城市', '梦幻风景', '科技产品']"
        :key="cmd"
        class="quick-tag"
        @click="inputValue = cmd"
      >
        {{ cmd }}
      </span>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <el-input
        v-model="inputValue"
        type="textarea"
        :rows="3"
        :placeholder="mode === 'generate' ? '描述你想要生成的图片...' : '输入指令，如「把颜色改成红色」'"
        :disabled="isGenerating"
        @keydown="handleKeyDown"
      />
      <div class="input-footer">
        <span class="hint">按 Enter 发送</span>
        <el-button type="primary" :loading="isGenerating" :disabled="!inputValue.trim()" @click="handleSend">
          {{ mode === 'generate' ? '生成' : '发送' }}
        </el-button>
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
}

.mode-tabs {
  display: flex;
  border-bottom: 1px solid #e4e7ed;
  padding: 8px 16px;
  gap: 8px;

  .mode-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    color: #606266;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    &.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
  }
}

.model-selector {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;

  .model-buttons {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;

    .model-btn {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid #dcdfe6;
      border-radius: 6px;
      background: #fff;
      font-size: 13px;
      color: #606266;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #667eea;
        color: #667eea;
      }

      &.active {
        background: #667eea;
        border-color: #667eea;
        color: #fff;
      }
    }
  }

  .advanced-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px;
    font-size: 12px;
    color: #909399;
    cursor: pointer;

    .arrow {
      font-size: 10px;
      transition: transform 0.2s;

      &.open {
        transform: rotate(180deg);
      }
    }
  }

  .advanced-settings {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 10px;

    .setting-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;

      label {
        width: 70px;
        color: #606266;
      }

      select,
      input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        font-size: 13px;
        outline: none;

        &:focus {
          border-color: #667eea;
        }
      }
    }
  }
}

.layer-info-bar {
  padding: 10px 16px;
  border-bottom: 1px solid #e4e7ed;

  .selected-layer-info,
  .no-selection-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .selected-layer-info {
    color: #409eff;
  }

  .no-selection-info {
    color: #e6a23c;
  }
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
    font-size: 48px;
  }

  p {
    margin: 4px 0;
    font-size: 14px;
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
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 16px 20px;

        .dots {
          display: flex;
          gap: 4px;

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

.result-images {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;

  .result-image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover .image-overlay {
      opacity: 1;
    }
  }
}

@keyframes bounce {
  0%,
  80%,
  100% {
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
    padding: 4px 10px;
    background: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 12px;
    font-size: 12px;
    color: #606266;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;

    &:hover {
      background: #ecf5ff;
      border-color: #667eea;
      color: #667eea;
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
