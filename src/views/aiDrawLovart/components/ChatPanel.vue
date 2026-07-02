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
const { messages, selectedLayer, selectedLayerId, isGenerating, currentModel, currentChatModel, aiMode, hasShownWelcome } = storeToRefs(store);

const inputValue = ref("");
const messagesContainer = ref<HTMLDivElement | null>(null);
const negativePrompt = ref("");
const imageSize = ref("1K");
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

// 解析用户指令，执行相应操作
const executeInstruction = async (text: string) => {
  const lowerText = text.toLowerCase();

  // 1. 如果选中了图层
  if (selectedLayer.value) {
    // 文本相关操作
    if (selectedLayer.value.type === "text") {
      // 修改文字内容
      if (lowerText.includes("改成") || lowerText.includes("改为")) {
        const match = text.match(/(?:改成|改为)[：:]\s*(.+)/);
        if (match && match[1]) {
          store.updateLayer(selectedLayer.value.id, { text: match[1] });
          emit("refreshCanvas");
          return `已将文字修改为：${match[1]}`;
        }
      }

      // AI 润色文字
      if (lowerText.includes("润色") || lowerText.includes("优化") || lowerText.includes("改写")) {
        const prompt = `请帮我润色这段文字，使其更有吸引力：${selectedLayer.value.text}`;
        const aiResponse = await store.chatWithGemini(prompt);
        store.updateLayer(selectedLayer.value.id, { text: aiResponse });
        emit("refreshCanvas");
        return `已润色文字：${aiResponse}`;
      }

      // 修改文字颜色 - 混合方案
      if (lowerText.includes("颜色") || lowerText.includes("色")) {
        // 简单颜色用硬编码（快速响应）
        const simpleColors: Record<string, string> = {
          "红色": "#ff4444",
          "蓝色": "#409eff",
          "绿色": "#67c23a",
          "黄色": "#e6a23c",
          "橙色": "#ff9800",
          "紫色": "#9c27b0",
          "黑色": "#000000",
          "白色": "#ffffff",
          "灰色": "#909399",
          "粉色": "#ffc0cb",
          "青色": "#00bcd4",
          "棕色": "#795548"
        };

        let color = "";
        // 先检查是否是简单颜色
        for (const [name, hex] of Object.entries(simpleColors)) {
          if (lowerText.includes(name)) {
            color = hex;
            break;
          }
        }

        // 如果不是简单颜色，用AI识别
        if (!color) {
          const prompt = `用户想要把颜色改成：${text}。请只返回一个十六进制颜色代码，不要其他任何文字，比如"#ff0000"。如果用户只说了"红色"、"蓝色"等，请返回对应的颜色代码。`;
          const aiColor = await store.chatWithGemini(prompt);
          const colorMatch = aiColor.match(/#[0-9a-fA-F]{6}/);
          color = colorMatch ? colorMatch[0] : "#409eff";
        }

        store.updateLayer(selectedLayer.value.id, { fill: color });
        emit("refreshCanvas");
        return `已将颜色修改为：${color}`;
      }
    }

    // 图片相关操作
    if (selectedLayer.value.type === "image") {
      // 重新生成图片
      if (lowerText.includes("重新生成") || lowerText.includes("换一张")) {
        const match = text.match(/(?:重新生成|换一张)[：:]\s*(.+)/);
        const prompt = match ? match[1] : "精美设计";

        const images = await store.generateImage(prompt);
        if (images.length > 0) {
          store.updateLayer(selectedLayer.value.id, { src: images[0] });
          emit("refreshCanvas");
          return "已重新生成图片";
        }
      }
    }

    // 通用图层操作
    // 删除
    if (lowerText.includes("删除")) {
      const layerName = selectedLayer.value.name;
      store.deleteLayer(selectedLayer.value.id);
      emit("refreshCanvas");
      return `已删除图层：${layerName}`;
    }

    // 复制
    if (lowerText.includes("复制")) {
      store.duplicateLayer(selectedLayer.value.id);
      emit("refreshCanvas");
      return `已复制图层：${selectedLayer.value.name}`;
    }

    // 锁定/解锁
    if (lowerText.includes("锁定")) {
      store.toggleLayerLock(selectedLayer.value.id);
      emit("refreshCanvas");
      return `${selectedLayer.value.locked ? "已解锁" : "已锁定"}图层`;
    }

    // 隐藏/显示
    if (lowerText.includes("隐藏")) {
      store.toggleLayerVisibility(selectedLayer.value.id);
      emit("refreshCanvas");
      return `${selectedLayer.value.visible ? "已隐藏" : "已显示"}图层`;
    }

    // 置顶
    if (lowerText.includes("置顶") || lowerText.includes("最上层")) {
      store.moveLayerToTop(selectedLayer.value.id);
      emit("refreshCanvas");
      return "已将图层置顶";
    }

    // 置底
    if (lowerText.includes("置底") || lowerText.includes("最下层")) {
      store.moveLayerToBottom(selectedLayer.value.id);
      emit("refreshCanvas");
      return "已将图层置底";
    }

    // 移动位置
    const moveMatch = text.match(/(?:向左|向右|向上|向下)\s*(\d+)/);
    if (moveMatch) {
      const distance = parseInt(moveMatch[1]);
      let newX = selectedLayer.value.x;
      let newY = selectedLayer.value.y;

      if (lowerText.includes("向左")) newX -= distance;
      if (lowerText.includes("向右")) newX += distance;
      if (lowerText.includes("向上")) newY -= distance;
      if (lowerText.includes("向下")) newY += distance;

      store.updateLayer(selectedLayer.value.id, { x: newX, y: newY });
      emit("refreshCanvas");
      return `已移动图层到 (${newX}, ${newY})`;
    }

    // 缩放
    const scaleMatch = text.match(/(?:放大|缩小)\s*(\d+)/);
    if (scaleMatch) {
      const scale = parseInt(scaleMatch[1]) / 100;
      const isEnlarge = lowerText.includes("放大");
      const newWidth = selectedLayer.value.width * (isEnlarge ? (1 + scale) : (1 - scale));
      const newHeight = selectedLayer.value.height * (isEnlarge ? (1 + scale) : (1 - scale));

      store.updateLayer(selectedLayer.value.id, { width: newWidth, height: newHeight });
      emit("refreshCanvas");
      return `已将图层${isEnlarge ? "放大" : "缩小"}`;
    }

    // 旋转
    const rotateMatch = text.match(/旋转\s*(\d+)/);
    if (rotateMatch) {
      const angle = parseInt(rotateMatch[1]);
      const newAngle = (selectedLayer.value.angle + angle) % 360;

      store.updateLayer(selectedLayer.value.id, { angle: newAngle });
      emit("refreshCanvas");
      return `已将图层旋转 ${angle} 度`;
    }
  } else {
    // 没有选中图层时的操作
    // 添加文字
    if (lowerText.includes("添加文字") || lowerText.includes("添加文本")) {
      const match = text.match(/(?:添加文字|添加文本)[：:]\s*(.+)/);
      const textContent = match ? match[1] : "新文字";

      store.addLayer({
        type: "text",
        name: textContent,
        visible: true,
        locked: false,
        x: 200, y: 300, width: 200, height: 50,
        angle: 0, scaleX: 1, scaleY: 1, zIndex: 999,
        opacity: 1,
        text: textContent,
        fontSize: 24,
        fontFamily: "Arial",
        fill: "#333333"
      });
      emit("refreshCanvas");
      return "已添加文字图层";
    }
  }

  // 画布操作
  if (lowerText.includes("撤销")) {
    store.undo();
    emit("refreshCanvas");
    return "已撤销";
  }

  if (lowerText.includes("重置视图")) {
    store.resetCanvas();
    return "视图已重置";
  }

  // 如果没有匹配任何指令，调用 AI 自由回复
  const aiResponse = await store.chatWithGemini(text);
  return aiResponse;
};

// 发送消息/生图
const handleSend = async () => {
  if (!inputValue.value.trim()) return;

  const userContent = inputValue.value.trim();
  inputValue.value = "";

  if (aiMode.value === "generate") {
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

  // 执行指令并获取响应
  const responseContent = await executeInstruction(userContent);

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

// 切换生图模型
const handleModelChange = (model: AiModelType) => {
  store.setCurrentModel(model);
};

// 切换聊天模型
const handleChatModelChange = (model: AiModelType) => {
  store.setCurrentChatModel(model);
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
  // 只在第一次显示欢迎语
  if (!hasShownWelcome.value) {
    store.addMessage({
      role: "assistant",
      content: "你好！我是 SmartCanvas AI。在「生图」模式中输入提示词来生成图片，或切换到「聊天」模式来编辑画布上的元素。",
      messageType: "text"
    });
    store.setHasShownWelcome(true);
  }
});
</script>

<template>
  <div class="chat-panel">
    <!-- 顶部模式切换和模型选择 -->
    <div class="top-controls">
      <div class="mode-tabs">
        <div
          class="mode-tab"
          :class="{ active: aiMode === 'generate' }"
          @click="store.setAiMode('generate')"
        >
          <el-icon :size="14"><MagicStick /></el-icon>
          <span>生图</span>
        </div>
        <div
          class="mode-tab"
          :class="{ active: aiMode === 'chat' }"
          @click="store.setAiMode('chat')"
        >
          <el-icon :size="14"><ChatDotRound /></el-icon>
          <span>聊天</span>
        </div>
      </div>

      <!-- 模型选择 -->
      <div class="model-selector">
        <el-select v-if="aiMode === 'generate'" v-model="currentModel" size="small" @change="handleModelChange">
          <el-option label="阿里云Qwen" value="aliyun" />
          <el-option label="七牛云Nano2" value="gemini" />
          <el-option label="七牛云GPT2" value="qnaigc" />
        </el-select>
        <el-select v-else v-model="currentChatModel" size="small" @change="handleChatModelChange">
          <el-option label="Gemini" value="gemini" />
          <el-option label="阿里云Qwen" value="aliyunChat" />
        </el-select>
        <el-button
          v-if="aiMode === 'generate'"
          type="text"
          size="small"
          class="advanced-btn"
          @click="isAdvancedSettingsOpen = !isAdvancedSettingsOpen"
        >
          {{ isAdvancedSettingsOpen ? '收起' : '高级' }}
        </el-button>
      </div>
    </div>

    <!-- 生图模式的高级设置 -->
    <div v-if="aiMode === 'generate' && isAdvancedSettingsOpen" class="advanced-settings">
      <div class="setting-item">
        <label>尺寸</label>
        <el-select v-model="imageSize" size="small">
          <el-option label="512" value="512" />
          <el-option label="1K" value="1K" />
          <el-option label="2K" value="2K" />
          <el-option label="4K" value="4K" />
        </el-select>
      </div>
      <div class="setting-item">
        <label>数量</label>
        <el-select v-model="imageCount" size="small">
          <el-option label="1" :value="1" />
          <el-option label="2" :value="2" />
          <el-option label="4" :value="4" />
        </el-select>
      </div>
      <div class="setting-item">
        <label>负面提示</label>
        <el-input v-model="negativePrompt" type="text" size="small" placeholder="不想出现的元素..." />
      </div>
    </div>

    <!-- 聊天模式的选中图层提示 -->
    <div v-if="aiMode === 'chat'" class="layer-info-bar">
      <div v-if="selectedLayer" class="selected-layer-info">
        <el-icon :size="14"><ChatRound /></el-icon>
        <span>已选中：{{ selectedLayer.name }}</span>
      </div>
      <div v-else class="no-selection-info">
        <el-icon :size="14"><Warning /></el-icon>
        <span>请在画布上选中一个元素</span>
      </div>
    </div>

    <!-- 消息列表 -->
    <div ref="messagesContainer" class="messages-container">
      <div v-if="messages.length === 0" class="empty-chat">
        <div class="empty-icon">
          <el-icon :size="48">
            <component :is="aiMode === 'generate' ? MagicStick : ChatDotRound" />
          </el-icon>
        </div>
        <p>{{ aiMode === 'generate' ? '描述你想要生成的图片' : '选中元素，输入指令' }}</p>
      </div>

      <div v-else class="messages-list">
        <div v-for="msg in messages" :key="msg.id" class="message-item" :class="msg.role">
          <div class="avatar">
            <el-icon v-if="msg.role === 'user'" :size="18"><User /></el-icon>
            <el-icon v-else-if="msg.messageType === 'image_result'" :size="18"><MagicStick /></el-icon>
            <el-icon v-else :size="18"><ChatDotRound /></el-icon>
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
            <el-icon :size="18">
              <component :is="aiMode === 'generate' ? MagicStick : ChatDotRound" />
            </el-icon>
          </div>
          <div class="content">
            <div class="bubble loading">
              <span class="text">{{ aiMode === 'generate' ? '正在生成图片中' : '正在思考中' }}</span>
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
    <div v-if="aiMode === 'generate'" class="quick-commands">
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
        :placeholder="aiMode === 'generate' ? '描述你想要生成的图片...' : '输入指令，如「把颜色改成红色」'"
        :disabled="isGenerating"
        @keydown="handleKeyDown"
      />
      <div class="input-footer">
        <span class="hint">按 Enter 发送</span>
        <el-button type="primary" :loading="isGenerating" :disabled="!inputValue.trim()" @click="handleSend">
          {{ aiMode === 'generate' ? '生成' : '发送' }}
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
* {
  box-sizing: border-box;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fff;
  overflow: hidden;
  min-height: 400px;
  max-height: none;
}

.top-controls {
  border-bottom: 1px solid #e4e7ed;
  padding: 8px 12px;
  flex-shrink: 0;

  .mode-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;

    .mode-tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 6px 10px;
      border-radius: 5px;
      font-size: 13px;
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
    display: flex;
    align-items: center;
    gap: 8px;

    .el-select {
      flex: 1;
    }

    .advanced-btn {
      padding: 4px 8px;
      color: #909399;
      font-size: 12px;
      flex-shrink: 0;

      &:hover {
        color: #667eea;
      }
    }
  }
}

.advanced-settings {
  padding: 10px 12px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fafafa;
  flex-shrink: 0;

  .setting-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;

    label {
      width: 60px;
      color: #606266;
      flex-shrink: 0;
    }

    .el-select,
    .el-input {
      flex: 1;
    }
  }
}

.layer-info-bar {
  padding: 5px 12px;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .selected-layer-info,
  .no-selection-info {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    line-height: 1.5;
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
  overflow-x: hidden;
  padding: 14px;
  background: #f5f7fa;
  min-height: 200px;
  max-height: none;
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
  gap: 14px;
}

.message-item {
  display: flex;
  gap: 10px;

  &.user {
    flex-direction: row-reverse;
  }

  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .el-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
  }

  &.user .avatar {
    background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  }

  .content {
    max-width: 75%;
    display: flex;
    flex-direction: column;

    .bubble {
      padding: 8px 12px;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      white-space: pre-wrap;
      word-break: break-word;

      .text {
        font-size: 13px;
        color: #303133;
        line-height: 1.5;
      }

      &.loading {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 14px 16px;

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
  margin-top: 10px;

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
  gap: 6px;
  padding: 8px 12px;
  overflow-x: auto;
  border-top: 1px solid #e4e7ed;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;

  .quick-tag {
    padding: 3px 8px;
    background: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 10px;
    font-size: 11px;
    color: #606266;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    flex-shrink: 0;

    &:hover {
      background: #ecf5ff;
      border-color: #667eea;
      color: #667eea;
    }
  }
}

.input-area {
  padding: 10px 12px;
  background: #fff;
  flex-shrink: 0;

  .input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;

    .hint {
      font-size: 11px;
      color: #c0c4cc;
    }
  }
}
</style>
