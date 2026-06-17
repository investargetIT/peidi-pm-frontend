<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useLovartStore } from "./store";
import { storeToRefs } from "pinia";
import CanvasArea from "./components/CanvasArea.vue";
import LayerPanel from "./components/LayerPanel.vue";
import ChatPanel from "./components/ChatPanel.vue";
import {
  RefreshLeft,
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
const { canUndo, selectedLayer, canvasZoom, selectedLayerIds } =
  storeToRefs(store);
const canvasAreaRef = ref<any>(null);

const rightPanelTab = ref<"chat" | "layers" | "properties">("chat");
const isEditDialogVisible = ref(false);
const editingLayerId = ref<string | null>(null);
const editingText = ref("");

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

const handlePropertyChange = () => {
  if (selectedLayer.value) {
    store.updateLayer(selectedLayer.value.id, {
      name: selectedLayer.value.name,
      x: selectedLayer.value.x,
      y: selectedLayer.value.y,
      width: selectedLayer.value.width,
      height: selectedLayer.value.height,
      angle: selectedLayer.value.angle,
      opacity: selectedLayer.value.opacity,
      fontSize: selectedLayer.value.fontSize,
      fill: selectedLayer.value.fill
    });
    nextTick(() => {
      canvasAreaRef.value?.refreshCanvas();
    });
  }
};

// 导出画布为图片
const handleExport = async () => {
  try {
    const fabricCanvas = (window as any).__lovartCanvas;
    if (fabricCanvas) {
      const activeObjects = fabricCanvas.getActiveObjects();
      const hasSelection = activeObjects.length > 0;

      // 保存当前状态
      const currentZoom = fabricCanvas.getZoom();
      const currentPan = fabricCanvas.viewportTransform;
      const allObjects = fabricCanvas.getObjects();

      // 临时重置缩放和平移
      fabricCanvas.setZoom(1);
      fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      fabricCanvas.calcOffset();

      let dataUrl: string;
      let exportDesc: string;

      if (hasSelection) {
        // 计算选中对象的边界（不修改原对象）
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        activeObjects.forEach(obj => {
          const rect = obj.getBoundingRect();
          minX = Math.min(minX, rect.left);
          minY = Math.min(minY, rect.top);
          maxX = Math.max(maxX, rect.left + rect.width);
          maxY = Math.max(maxY, rect.top + rect.height);
        });
        const bounds = {
          left: minX,
          top: minY,
          width: maxX - minX,
          height: maxY - minY
        };

        // 临时隐藏未选中的对象
        allObjects.forEach(obj => {
          if (!activeObjects.includes(obj)) {
            (obj as any)._originalVisible = obj.visible;
            obj.visible = false;
          }
        });

        // 裁剪导出选中区域
        dataUrl = fabricCanvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 1,
          backgroundColor: null,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height
        });

        // 恢复可见性
        allObjects.forEach(obj => {
          if ((obj as any)._originalVisible !== undefined) {
            obj.visible = (obj as any)._originalVisible;
            delete (obj as any)._originalVisible;
          }
        });

        exportDesc = `选中区域 (${Math.round(bounds.width)} × ${Math.round(bounds.height)})`;
      } else {
        // 计算所有对象的边界（不修改原对象）
        if (allObjects.length === 0) {
          ElMessage.warning("画布为空，无法导出");
          return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        allObjects.forEach(obj => {
          const rect = obj.getBoundingRect();
          minX = Math.min(minX, rect.left);
          minY = Math.min(minY, rect.top);
          maxX = Math.max(maxX, rect.left + rect.width);
          maxY = Math.max(maxY, rect.top + rect.height);
        });
        const bounds = {
          left: minX,
          top: minY,
          width: maxX - minX,
          height: maxY - minY
        };

        // 添加一些边距
        const padding = 20;
        dataUrl = fabricCanvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 1,
          backgroundColor: null,
          left: bounds.left - padding,
          top: bounds.top - padding,
          width: bounds.width + padding * 2,
          height: bounds.height + padding * 2
        });

        exportDesc = `全部内容 (${Math.round(bounds.width)} × ${Math.round(bounds.height)})`;
      }

      // 恢复之前的缩放和平移状态
      fabricCanvas.setZoom(currentZoom);
      fabricCanvas.setViewportTransform(currentPan);
      fabricCanvas.calcOffset();

      // 下载图片
      const link = document.createElement("a");
      link.download = `lovart-design-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      ElMessage.success(`导出成功！${exportDesc}`);
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
          <el-button :icon="ArrowLeft" @click="handleResetView">
            重置视图
          </el-button>
        </el-button-group>
      </div>

      <div class="header-right">
        <div class="canvas-info">
          <span class="canvas-zoom">{{ Math.round(canvasZoom * 100) }}%</span>
        </div>
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
          <div
            class="tab-item"
            :class="{ active: rightPanelTab === 'properties' }"
            @click="rightPanelTab = 'properties'"
          >
            <el-icon><Setting /></el-icon>
            <span>属性</span>
          </div>
        </div>

        <div class="panel-content-wrapper">
          <ChatPanel
            v-if="rightPanelTab === 'chat'"
            @edit:text="handleEditText"
            @refreshCanvas="canvasAreaRef.value?.refreshCanvas()"
          />
          <LayerPanel
            v-else-if="rightPanelTab === 'layers'"
            @edit:text="handleEditText"
          />
          <div v-else class="properties-panel">
            <div v-if="selectedLayerIds.length === 0" class="no-selection">
              <el-empty description="请在画布上选择元素" :image-size="80" />
            </div>
            <div v-else class="properties-content">
              <div class="section-title">
                {{
                  selectedLayerIds.length === 1
                    ? "元素属性"
                    : `已选择 ${selectedLayerIds.length} 个元素`
                }}
              </div>

              <div v-if="selectedLayer" class="property-group">
                <div class="form-item">
                  <label>名称</label>
                  <el-input v-model="selectedLayer.name" size="small" />
                </div>
              </div>

              <div class="property-group">
                <div class="form-item">
                  <label>X</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.x"
                    size="small"
                    :min="-10000"
                    :max="10000"
                    :precision="1"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
                <div class="form-item">
                  <label>Y</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.y"
                    size="small"
                    :min="-10000"
                    :max="10000"
                    :precision="1"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
              </div>

              <div class="property-group">
                <div class="form-item">
                  <label>宽度</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.width"
                    size="small"
                    :min="1"
                    :max="10000"
                    :precision="0"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
                <div class="form-item">
                  <label>高度</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.height"
                    size="small"
                    :min="1"
                    :max="10000"
                    :precision="0"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
              </div>

              <div class="property-group">
                <div class="form-item">
                  <label>旋转</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.angle"
                    size="small"
                    :min="0"
                    :max="360"
                    :precision="1"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
                <div class="form-item">
                  <label>不透明度</label>
                  <el-input-number
                    v-if="selectedLayer"
                    v-model="selectedLayer.opacity"
                    size="small"
                    :min="0"
                    :max="1"
                    :precision="2"
                    :step="0.01"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
              </div>

              <div
                v-if="selectedLayer && selectedLayer.type === 'text'"
                class="property-group"
              >
                <div class="form-item">
                  <label>字体大小</label>
                  <el-input-number
                    v-model="selectedLayer.fontSize"
                    size="small"
                    :min="8"
                    :max="500"
                    :precision="0"
                    :step="1"
                    style="width: 100%"
                    @change="handlePropertyChange"
                  />
                </div>
                <div class="form-item">
                  <label>颜色</label>
                  <el-color-picker
                    v-model="selectedLayer.fill"
                    size="small"
                    show-alpha
                    @change="handlePropertyChange"
                  />
                </div>
              </div>
            </div>
          </div>
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

.properties-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px;

  .no-selection {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .properties-content {
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e4e7ed;
    }

    .property-group {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;

      .form-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;

        label {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }
}
</style>
