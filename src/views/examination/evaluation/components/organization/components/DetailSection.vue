<script lang="ts" setup>
import type { TreeNode, MetricConfig } from "./types";

interface Props {
  selectedNode: TreeNode | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "edit-node": [node: TreeNode];
  "add-metric": [];
  "edit-metric": [metric: MetricConfig];
}>();

// ... existing code ...

const getNodeTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    department: "部门",
    position: "岗位",
    examination_group: "考核组"
  };
  return map[type] || type;
};

const getNodeTypeTagType = (type: string): any => {
  const map: Record<string, string> = {
    department: "primary",
    position: "warning",
    examination_group: "success"
  };
  return map[type] || "info";
};
</script>

<template>
  <div v-if="selectedNode" class="detail-section">
    <div class="detail-header">
      <h3>{{ selectedNode.nodeName }}</h3>
      <el-tag :type="getNodeTypeTagType(selectedNode.nodeType)">
        {{ getNodeTypeLabel(selectedNode.nodeType) }}
      </el-tag>
      <el-button
        type="primary"
        link
        size="small"
        @click="emit('edit-node', selectedNode)"
      >
        编辑节点
      </el-button>
    </div>
    <div class="detail-info">
      <p><span class="label">节点ID:</span> {{ selectedNode.id }}</p>
      <p>
        <span class="label">父节点:</span>
        {{ selectedNode.parentName || "-" }}
      </p>
      <p><span class="label">层级:</span> {{ selectedNode.treeLevel }}</p>
      <p>
        <span class="label">排序:</span>
        {{ selectedNode.sortNo }}
      </p>
      <p>
        <span class="label">状态:</span>
        {{ selectedNode.status === 1 ? "启用" : "禁用" }}
      </p>
    </div>

    <div class="metric-section">
      <div class="metric-header">
        <h4>指标配置</h4>
        <el-button type="primary" size="small" @click="emit('add-metric')">
          + 添加指标
        </el-button>
      </div>
      <div v-if="selectedNode.metricConfigs?.length" class="metric-list">
        <div
          class="metric-item"
          v-for="metric in selectedNode.metricConfigs"
          :key="metric.id"
        >
          <div class="metric-info">
            <span class="metric-name">{{ metric.targetName }}</span>
            <div class="metric-meta">
              <el-tag v-if="metric.calculationFormula" size="small" type="info">
                {{ metric.calculationFormula }}
              </el-tag>
              <el-tag v-if="metric.weight !== null" size="small" type="warning">
                权重: {{ metric.weight }}
              </el-tag>
              <el-tag v-if="metric.score !== null" size="small" type="success">
                分数: {{ metric.score }}
              </el-tag>
            </div>
            <p v-if="metric.kpiDepict" class="metric-desc">
              {{ metric.kpiDepict }}
            </p>
          </div>
          <div class="metric-actions">
            <el-button
              type="primary"
              link
              size="small"
              @click="emit('edit-metric', metric)"
            >
              编辑
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无指标配置" />
    </div>
  </div>
</template>

<style scoped>
.detail-section {
  width: 420px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  flex-wrap: wrap;
}

.detail-header h3 {
  margin: 0;
  font-size: 16px;
}

.detail-info {
  margin-bottom: 20px;
}

.detail-info p {
  margin: 8px 0;
  display: flex;
}

.detail-info .label {
  color: var(--el-text-color-secondary);
  width: 80px;
  flex-shrink: 0;
}

.metric-section {
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 16px;
}

.metric-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.metric-header h4 {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.metric-list {
  margin-top: 12px;
}

.metric-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  margin-bottom: 8px;
  gap: 12px;
}

.metric-info {
  flex: 1;
  min-width: 0;
}

.metric-name {
  font-size: 14px;
  font-weight: 500;
  display: block;
}

.metric-meta {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.metric-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
</style>
