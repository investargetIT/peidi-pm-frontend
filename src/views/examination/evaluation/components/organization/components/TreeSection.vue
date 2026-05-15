<script lang="ts" setup>
import { Search, Plus, Edit } from "@element-plus/icons-vue";
import type { TreeInstance } from "element-plus";
import type { TreeNode } from "./types";
import { ref, computed } from "vue";

interface Props {
  dataSource: TreeNode[];
  loading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "node-click": [node: TreeNode];
  "add-node": [node: TreeNode | null];
  "edit-node": [node: TreeNode];
}>();

const treeRef = ref<TreeInstance>();
const searchKeyword = ref("");

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

const getNodeTypeClass = (type: string) => {
  const map: Record<string, string> = {
    department: "node-department",
    position: "node-position",
    examination_group: "node-examination"
  };
  return map[type] || "";
};

const getNodeLevelPath = (node: TreeNode): string => {
  const pathMap: Record<string, string> = {
    department: "部门",
    position: "岗位",
    examination_group: "考核组"
  };

  if (!node.treePathName) {
    return pathMap[node.nodeType] || node.nodeType;
  }

  return node.treePathName;
};

const filterNode = (value: string, data: TreeNode) => {
  if (!value) return true;
  return data.nodeName.toLowerCase().includes(value.toLowerCase());
};

const handleSearch = () => {
  if (treeRef.value) {
    treeRef.value.filter(searchKeyword.value);
  }
};

const handleAddRootNode = () => {
  emit("add-node", null);
};
</script>

<template>
  <div class="tree-section">
    <div class="section-header">
      <h3>组织架构树</h3>
      <div class="header-actions">
        <el-button type="primary" size="small" @click="handleAddRootNode">
          <el-icon><Plus /></el-icon>
          添加根节点
        </el-button>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索节点名称"
          clearable
          size="small"
          class="search-input"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>
    </div>
    <div class="tree-content">
      <el-tree
        ref="treeRef"
        v-loading="loading"
        :data="dataSource"
        :show-checkbox="false"
        node-key="id"
        :default-expand-all="true"
        :expand-on-click-node="false"
        :props="{ label: 'nodeName' }"
        :filter-node-method="filterNode"
        @node-click="data => emit('node-click', data)"
      >
        <template #default="{ node, data }">
          <div class="custom-tree-node">
            <span class="node-info">
              <span class="node-label" :class="getNodeTypeClass(data.nodeType)">
                {{ node.label }}
              </span>
              <el-tag
                :type="getNodeTypeTagType(data.nodeType)"
                size="small"
                class="node-type-tag"
              >
                {{ getNodeTypeLabel(data.nodeType) }}
              </el-tag>
              <span class="node-path" v-if="data.treePathName">
                {{ getNodeLevelPath(data) }}
              </span>
              <el-tag
                v-if="data.metricConfigs?.length"
                type="danger"
                size="small"
                class="metric-count-tag"
              >
                {{ data.metricConfigs.length }}个指标
              </el-tag>
            </span>
            <span class="node-actions">
              <el-tooltip
                :content="`添加${getNodeTypeLabel(data.nodeType)}子节点`"
                placement="top"
              >
                <el-icon
                  class="action-icon add-icon"
                  :class="`add-icon-${data.nodeType}`"
                  @click.stop="emit('add-node', data)"
                >
                  <Plus />
                </el-icon>
              </el-tooltip>
              <el-tooltip content="编辑节点" placement="top">
                <el-icon
                  class="action-icon edit-icon"
                  @click.stop="emit('edit-node', data)"
                >
                  <Edit />
                </el-icon>
              </el-tooltip>
            </span>
          </div>
        </template>
      </el-tree>
    </div>
  </div>
</template>

<style scoped>
.tree-section {
  flex: 1;
  min-width: 400px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 240px;
  flex-shrink: 0;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.node-label {
  font-weight: 500;
}

.node-department {
  color: var(--el-color-primary);
}

.node-position {
  color: var(--el-color-warning);
}

.node-examination {
  color: var(--el-color-success);
}

.node-type-tag {
  flex-shrink: 0;
}

.node-path {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
}

.metric-count-tag {
  flex-shrink: 0;
}

.node-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.action-icon {
  cursor: pointer;
  font-size: 16px;
  transition: opacity 0.2s;
}

.action-icon:hover {
  opacity: 0.7;
}

.add-icon-department {
  color: var(--el-color-primary);
}

.add-icon-position {
  color: var(--el-color-warning);
}

.add-icon-examination_group {
  color: var(--el-color-success);
}

.edit-icon {
  color: var(--el-color-primary);
}

.tree-content::-webkit-scrollbar {
  width: 6px;
}

.tree-content::-webkit-scrollbar-thumb {
  background-color: var(--el-border-color);
  border-radius: 3px;
}

.tree-content::-webkit-scrollbar-thumb:hover {
  background-color: var(--el-border-color-dark);
}

.tree-content::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>
