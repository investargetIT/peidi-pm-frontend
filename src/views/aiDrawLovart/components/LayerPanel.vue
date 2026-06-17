<script setup lang="ts">
import { ref, computed } from "vue";
import { useLovartStore } from "../store";
import { storeToRefs } from "pinia";
import {
  View,
  Hide,
  Lock,
  Unlock,
  Delete,
  Top,
  Bottom,
  Picture,
  Document,
  ArrowUp,
  ArrowDown,
  More
} from "@element-plus/icons-vue";
import type { Layer } from "../types";
import { ElMessage, ElMessageBox } from "element-plus";

const emit = defineEmits<{
  (e: "edit:text", layerId: string): void;
}>();

const store = useLovartStore();
const { sortedLayers, selectedLayerId, selectedLayerIds } = storeToRefs(store);

const dragIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null);

const getLayerIcon = (layer: Layer) => {
  return layer.type === "image" ? Picture : Document;
};

const handleSelectLayer = (evt: MouseEvent, layerId: string) => {
  if (evt.ctrlKey || evt.metaKey) {
    store.toggleLayerSelection(layerId);
  } else {
    store.selectLayer(layerId);
  }
};

const handleToggleVisibility = (evt: Event, layerId: string) => {
  evt.stopPropagation();
  store.toggleLayerVisibility(layerId);
};

const handleToggleLock = (evt: Event, layerId: string) => {
  evt.stopPropagation();
  store.toggleLayerLock(layerId);
};

const handleDeleteLayer = async (evt: Event, layerId: string) => {
  evt.stopPropagation();
  try {
    await ElMessageBox.confirm("确定要删除此图层吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    store.deleteLayer(layerId);
    ElMessage.success("删除成功");
  } catch {
    // 用户取消
  }
};

const handleMoveToTop = (evt: Event, layerId: string) => {
  evt.stopPropagation();
  store.moveLayerToTop(layerId);
};

const handleMoveToBottom = (evt: Event, layerId: string) => {
  evt.stopPropagation();
  store.moveLayerToBottom(layerId);
};

const handleMoveUp = (evt: Event, index: number) => {
  evt.stopPropagation();
  if (index > 0) {
    store.moveLayer(index, index - 1);
  }
};

const handleMoveDown = (evt: Event, index: number) => {
  evt.stopPropagation();
  if (index < sortedLayers.value.length - 1) {
    store.moveLayer(index, index + 1);
  }
};

const handleDragStart = (index: number) => {
  dragIndex.value = index;
};

const handleDragOver = (evt: DragEvent, index: number) => {
  evt.preventDefault();
  dropIndex.value = index;
};

const handleDrop = () => {
  if (
    dragIndex.value !== null &&
    dropIndex.value !== null &&
    dragIndex.value !== dropIndex.value
  ) {
    store.moveLayer(dragIndex.value, dropIndex.value);
  }
  dragIndex.value = null;
  dropIndex.value = null;
};

const handleDragEnd = () => {
  dragIndex.value = null;
  dropIndex.value = null;
};

const handleEditText = (evt: Event, layerId: string) => {
  evt.stopPropagation();
  emit("edit:text", layerId);
};
</script>

<template>
  <div class="layer-panel">
    <div class="panel-header">
      <h3>图层</h3>
      <span class="layer-count">{{ sortedLayers.length }}</span>
    </div>

    <div class="panel-content">
      <div v-if="sortedLayers.length === 0" class="empty-state">
        <el-empty description="暂无图层" :image-size="60" />
      </div>

      <div v-else class="layer-list">
        <div
          v-for="(layer, index) in sortedLayers"
          :key="layer.id"
          class="layer-item"
          :class="{
            selected: selectedLayerIds.includes(layer.id),
            'drag-over': dropIndex === index
          }"
          draggable="true"
          @click="handleSelectLayer($event, layer.id)"
          @dragstart="handleDragStart(index)"
          @dragover="handleDragOver($event, index)"
          @drop="handleDrop"
          @dragend="handleDragEnd"
        >
          <div class="layer-info">
            <el-icon :size="18" class="layer-type-icon">
              <component :is="getLayerIcon(layer)" />
            </el-icon>
            <span class="layer-name" :class="{ muted: !layer.visible }">
              {{ layer.name }}
            </span>
          </div>

          <div class="layer-actions">
            <el-tooltip
              :content="layer.visible ? '隐藏' : '显示'"
              placement="top"
            >
              <el-icon
                :size="16"
                class="action-icon"
                :class="{ active: layer.visible }"
                @click="handleToggleVisibility($event, layer.id)"
              >
                <component :is="layer.visible ? View : Hide" />
              </el-icon>
            </el-tooltip>

            <el-tooltip
              :content="layer.locked ? '解锁' : '锁定'"
              placement="top"
            >
              <el-icon
                :size="16"
                class="action-icon"
                :class="{ active: layer.locked }"
                @click="handleToggleLock($event, layer.id)"
              >
                <component :is="layer.locked ? Lock : Unlock" />
              </el-icon>
            </el-tooltip>

            <el-dropdown trigger="click" @click.stop>
              <el-icon :size="16" class="action-icon more-icon">
                <More />
              </el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-if="layer.type === 'text'"
                    @click="handleEditText($event, layer.id)"
                  >
                    <el-icon><Document /></el-icon>
                    编辑文字
                  </el-dropdown-item>
                  <el-dropdown-item
                    @click="handleMoveUp($event, index)"
                    :disabled="index === 0"
                  >
                    <el-icon><ArrowUp /></el-icon>
                    上移一层
                  </el-dropdown-item>
                  <el-dropdown-item
                    @click="handleMoveDown($event, index)"
                    :disabled="index === sortedLayers.length - 1"
                  >
                    <el-icon><ArrowDown /></el-icon>
                    下移一层
                  </el-dropdown-item>
                  <el-dropdown-item @click="handleMoveToTop($event, layer.id)">
                    <el-icon><Top /></el-icon>
                    置于顶层
                  </el-dropdown-item>
                  <el-dropdown-item
                    @click="handleMoveToBottom($event, layer.id)"
                  >
                    <el-icon><Bottom /></el-icon>
                    置于底层
                  </el-dropdown-item>
                  <el-dropdown-item
                    divided
                    @click="handleDeleteLayer($event, layer.id)"
                  >
                    <el-icon><Delete /></el-icon>
                    删除图层
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.layer-panel {
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

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .layer-count {
    font-size: 12px;
    color: #909399;
    background: #f5f7fa;
    padding: 2px 8px;
    border-radius: 10px;
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  .empty-state {
    padding: 40px 0;
  }
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;

  &:hover {
    background: #f5f7fa;
  }

  &.selected {
    background: #ecf5ff;
    border: 1px solid #409eff;
  }

  &.drag-over {
    border-top: 2px solid #409eff;
  }
}

.layer-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;

  .layer-type-icon {
    color: #606266;
    flex-shrink: 0;
  }

  .layer-name {
    font-size: 13px;
    color: #303133;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.muted {
      color: #c0c4cc;
    }
  }
}

.layer-actions {
  display: flex;
  align-items: center;
  gap: 4px;

  .action-icon {
    padding: 4px;
    border-radius: 4px;
    color: #909399;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #e9e9eb;
      color: #606266;
    }

    &.active {
      color: #409eff;
    }
  }
}
</style>
