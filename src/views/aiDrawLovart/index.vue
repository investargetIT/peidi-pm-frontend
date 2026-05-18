<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
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
  Edit,
  Download,
  Upload,
  Setting
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as fabric from "fabric";

const store = useLovartStore();
const { canUndo, selectedLayer, canvasWidth, canvasHeight, canvasZoom } = storeToRefs(store);
const canvasAreaRef = ref<any>(null);

const rightPanelTab = ref<"chat" | "layers">("chat");
const isEditDialogVisible = ref(false);
const isCanvasSizeDialogVisible = ref(false);
const editingLayerId = ref<string | null>(null);
const editingText = ref("");
const tempCanvasWidth = ref(1024);
const tempCanvasHeight = ref(1024);

const handleUndo = () => {
  if (canUndo.value) {
    store.undo();
    nextTick(() => {
      canvasAreaRef.value?.refreshCanvas();
    });
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
  const layer = store.layers.find(l => l.id === layerId);
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

// 导出画布为图片
const handleExport = async () => {
  try {
    // 使用 Fabric.js 的 toDataURL 方法
    const fabricCanvas = (window as any).__lovartCanvas;
    if (fabricCanvas) {
      // 保存当前缩放和平移状态
      const currentZoom = fabricCanvas.getZoom();
      const currentPan = fabricCanvas.viewportTransform;

      // 临时重置缩放和平移以导出原图尺寸
      fabricCanvas.setZoom(1);
      fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      fabricCanvas.calcOffset();

      const dataUrl = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier: 1
      });

      // 恢复之前的缩放和平移状态
      fabricCanvas.setZoom(currentZoom);
      fabricCanvas.setViewportTransform(currentPan);
      fabricCanvas.calcOffset();

      // 下载图片
      const link = document.createElement("a");
      link.download = `lovart-design-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      ElMessage.success(`导出成功！尺寸: ${store.canvasWidth} × ${store.canvasHeight}`);
      return;
    }

    ElMessage.warning("画布未初始化，无法导出");
  } catch (error) {
    console.error("导出失败:", error);
    ElMessage.error("导出失败，请稍后重试");
  }
};

// 上传图片并添加到画布
const handleUploadImage = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log("Selected file:", file);

    try {
      const reader = new FileReader();
      reader.onload = event => {
        const dataUrl = event.target?.result as string;
        console.log("Data URL loaded, length:", dataUrl.length);
        const newLayer = store.addLayer({
          type: "image",
          name: file.name.replace(/\.[^/.]+$/, ""),
          visible: true,
          locked: false,
          x: 100,
          y: 100,
          width: 400,
          height: 300,
          angle: 0,
          scaleX: 1,
          scaleY: 1,
          zIndex: 999,
          opacity: 1,
          src: dataUrl
        });
        console.log("Layer added:", newLayer);
        // 直接调用画布刷新
        nextTick(() => {
          canvasAreaRef.value?.refreshCanvas();
        });
        ElMessage.success("图片已添加到画布");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      ElMessage.error("图片加载失败");
    }
  };
  input.click();
};

// 打开画布尺寸设置对话框
const openCanvasSizeDialog = () => {
  tempCanvasWidth.value = store.canvasWidth;
  tempCanvasHeight.value = store.canvasHeight;
  isCanvasSizeDialogVisible.value = true;
};

// 保存画布尺寸
const saveCanvasSize = () => {
  store.setCanvasSize(tempCanvasWidth.value, tempCanvasHeight.value);
  isCanvasSizeDialogVisible.value = false;
  ElMessage.success("画布尺寸已更新");
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
          <el-button
            :icon="RefreshLeft"
            @click="handleUndo"
            :disabled="!canUndo"
          >
            撤销 (Ctrl+Z)
          </el-button>
          <el-button
            :icon="ZoomOut"
            @click="store.setCanvasZoom(store.canvasZoom - 0.1)"
          >
            缩小
          </el-button>
          <el-button
            :icon="ZoomIn"
            @click="store.setCanvasZoom(store.canvasZoom + 0.1)"
          >
            放大
          </el-button>
          <el-button :icon="ArrowLeft" @click="handleResetView">
            重置视图
          </el-button>
        </el-button-group>
      </div>

      <div class="header-right">
        <div class="canvas-info">
          <span class="canvas-size">{{ canvasWidth }} × {{ canvasHeight }}</span>
          <span class="canvas-zoom">{{ Math.round(canvasZoom * 100) }}%</span>
        </div>
        <el-button :icon="Setting" @click="openCanvasSizeDialog">
          画布设置
        </el-button>
        <el-button :icon="Upload" @click="handleUploadImage">
          上传图片
        </el-button>
        <el-button :icon="Edit" @click="handleAddTextLayer">
          添加文本
        </el-button>
        <el-button type="primary" :icon="Download" @click="handleExport">
          导出图片
        </el-button>
      </div>
    </header>

    <main class="page-main">
      <div class="canvas-wrapper">
        <CanvasArea ref="canvasAreaRef" @layer:dblclick="handleEditText" />
      </div>

      <div class="right-panel">
        <div class="panel-tabs">
          <div
            class="tab-item"
            :class="{ active: rightPanelTab === 'chat' }"
            @click="rightPanelTab = 'chat'"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>AI 助手</span>
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
          <ChatPanel
            v-if="rightPanelTab === 'chat'"
            @edit:text="handleEditText"
            @refreshCanvas="canvasAreaRef.value?.refreshCanvas()"
          />
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

    <el-dialog v-model="isCanvasSizeDialogVisible" title="画布设置" width="450px">
      <el-form label-width="80px">
        <el-form-item label="预设尺寸">
          <el-select placeholder="选择预设" @change="(val: number[]) => { tempCanvasWidth = val[0]; tempCanvasHeight = val[1]; }">
            <el-option label="正方形 512×512" :value="[512, 512]" />
            <el-option label="正方形 1024×1024" :value="[1024, 1024]" />
            <el-option label="正方形 2048×2048" :value="[2048, 2048]" />
            <el-option label="横屏 1920×1080" :value="[1920, 1080]" />
            <el-option label="竖屏 1080×1920" :value="[1080, 1920]" />
            <el-option label="A4 2480×3508" :value="[2480, 3508]" />
          </el-select>
        </el-form-item>
        <el-form-item label="宽度">
          <el-input-number v-model="tempCanvasWidth" :min="100" :max="4096" :step="10" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="高度">
          <el-input-number v-model="tempCanvasHeight" :min="100" :max="4096" :step="10" style="width: 100%;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="isCanvasSizeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCanvasSize">应用</el-button>
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

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .canvas-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-right: 8px;
      padding: 6px 12px;
      background: #f5f7fa;
      border-radius: 6px;

      .canvas-size {
        font-size: 13px;
        color: #606266;
        font-weight: 500;
      }

      .canvas-zoom {
        font-size: 13px;
        color: #409eff;
        font-weight: 500;
      }
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
