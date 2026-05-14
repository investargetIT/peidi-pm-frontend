<script setup lang="ts">
import { ref, computed } from "vue";
import { useLovartStore } from "./store";
import { storeToRefs } from "pinia";
import CanvasArea from "./components/CanvasArea.vue";
import LayerPanel from "./components/LayerPanel.vue";
import ChatPanel from "./components/ChatPanel.vue";
import {
  RefreshLeft,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ChatDotRound,
  Operation,
  Edit
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";

const store = useLovartStore();
const { canUndo, selectedLayer } = storeToRefs(store);

const rightPanelTab = ref<"chat" | "layers">("chat");
const isEditDialogVisible = ref(false);
const editingLayerId = ref<string | null>(null);
const editingText = ref("");

const handleUndo = () => {
  if (canUndo.value) {
    store.undo();
    ElMessage.success("已撤销");
  } else {
    ElMessage.info("没有可撤销的操作");
  }
};

const handleResetView = () => {
  store.resetCanvas();
  ElMessage.success("视图已重置");
};

const handleEditText = (layerId: string) => {
  const layer = store.layers.find((l) => l.id === layerId);
  if (layer && layer.type === "text") {
    editingLayerId.value = layerId;
    editingText.value = layer.text || "";
    isEditDialogVisible.value = true;
  }
};

const handleSaveEdit = () => {
  if (editingLayerId.value && editingText.value) {
    store.updateLayer(editingLayerId.value, {
      text: editingText.value
    });
    isEditDialogVisible.value = false;
    ElMessage.success("文字已更新");
  }
};

const handleAddTextLayer = () => {
  store.addLayer({
    type: "text",
    name: "新文本",
    visible: true,
    locked: false,
    x: 300,
    y: 300,
    width: 150,
    height: 40,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    zIndex: 99,
    opacity: 1,
    text: "双击编辑",
    fontSize: 24,
    fontFamily: "Arial",
    fill: "#303133"
  });
  ElMessage.success("已添加文本图层");
};

const handleExport = async () => {
  try {
    await ElMessageBox.alert("导出功能需要后端配合，这里仅展示 Mock 效果", "提示", {
      confirmButtonText: "确定"
    });
  } catch {
    //
  }
};
</script>

<template>
  <div class="lovart-page">
    <header class="page-header">
      <div class="header-left">
        <h1>SmartCanvas AI</h1>
        <span class="subtitle">Lovart Style</span>
      </div>

      <div class="header-center">
        <el-button-group>
          <el-button :icon="RefreshLeft" @click="handleUndo" :disabled="!canUndo">
            撤销 (Ctrl+Z)
          </el-button>
          <el-button :icon="ZoomOut" @click="store.setCanvasZoom(store.canvasZoom - 0.1)">
            缩小
          </el-button>
          <el-button :icon="ZoomIn" @click="store.setCanvasZoom(store.canvasZoom + 0.1)">
            放大
          </el-button>
          <el-button :icon="ArrowLeft" @click="handleResetView">
            重置视图
          </el-button>
        </el-button-group>
      </div>

      <div class="header-right">
        <el-button :icon="Edit" @click="handleAddTextLayer">
          添加文本
        </el-button>
        <el-button type="primary" :icon="Operation" @click="handleExport">
          导出
        </el-button>
      </div>
    </header>

    <main class="page-main">
      <div class="canvas-wrapper">
        <CanvasArea @layer:dblclick="handleEditText" />
      </div>

      <div class="right-panel">
        <div class="panel-tabs">
          <div
            class="tab-item"
            :class="{ active: rightPanelTab === 'chat' }"
            @click="rightPanelTab = 'chat'"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>AI 对话</span>
          </div>
          <div
            class="tab-item"
            :class="{ active: rightPanelTab === 'layers' }"
            @click="rightPanelTab = 'layers'"
          >
            <el-icon><Operation /></el-icon>
            <span>图层</span>
          </div>
        </div>

        <div class="panel-content-wrapper">
          <ChatPanel v-if="rightPanelTab === 'chat'" @edit:text="handleEditText" />
          <LayerPanel v-else @edit:text="handleEditText" />
        </div>
      </div>
    </main>

    <el-dialog v-model="isEditDialogVisible" title="编辑文字" width="500px">
      <el-input
        v-model="editingText"
        type="textarea"
        :rows="4"
        placeholder="输入文字内容"
      />
      <template #footer>
        <el-button @click="isEditDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.lovart-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
  overflow: hidden;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #303133;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      font-size: 12px;
      color: #909399;
      background: #f5f7fa;
      padding: 2px 8px;
      border-radius: 10px;
    }
  }
}

.page-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.right-panel {
  width: 360px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-left: 1px solid #e4e7ed;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #e4e7ed;

  .tab-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    font-size: 13px;
    color: #606266;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 2px solid transparent;

    &:hover {
      color: #409eff;
      background: #f5f7fa;
    }

    &.active {
      color: #409eff;
      border-bottom-color: #409eff;
      background: #ecf5ff;
    }
  }
}

.panel-content-wrapper {
  flex: 1;
  overflow: hidden;
}
</style>
