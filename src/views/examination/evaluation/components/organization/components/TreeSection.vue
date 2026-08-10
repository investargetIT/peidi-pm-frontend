<script lang="ts" setup>
import { Search, Plus, Edit, Delete, User } from "@element-plus/icons-vue";
import type { TreeInstance } from "element-plus";
import type { TreeNode } from "./types";
import { ref, computed } from "vue";
import RiAddLine from "@iconify-icons/ri/add-line";

interface MonthUserInfo {
  userId: string;
  username: string;
  jobNum?: string;
  target: number | null;
  achieved: number | null;
  recordId: string;
}

interface Props {
  dataSource: TreeNode[];
  loading: boolean;
  monthMetricIndex?: Map<string, MonthUserInfo[]>;
  currentMonthLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  monthMetricIndex: () => new Map(),
  currentMonthLabel: ""
});

const emit = defineEmits<{
  "node-click": [node: TreeNode];
  "add-node": [node: TreeNode | null];
  "edit-node": [node: TreeNode];
  "delete-node": [node: TreeNode];
}>();

const treeRef = ref<TreeInstance>();
const searchKeyword = ref("");
const tooltipShowAfter = 800;

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

// 收集节点（含子节点）下所有被本月使用的指标对应的去重用户数
// 按 userId 去重：同一用户用同节点下多条指标只算 1 人
const getNodeUsedUserCount = (node: TreeNode): number => {
  if (!props.monthMetricIndex || props.monthMetricIndex.size === 0) return 0;
  const userSet = new Set<string>();
  const walk = (n: TreeNode) => {
    (n.metricConfigs || []).forEach(m => {
      const key = `${m.nodeId}__${m.targetName}`;
      const users = props.monthMetricIndex.get(key);
      if (users && users.length) {
        users.forEach(u => userSet.add(u.userId));
      }
    });
    (n.children || []).forEach(walk);
  };
  walk(node);
  return userSet.size;
};
</script>

<template>
  <div class="tree-section">
    <div class="section-header">
      <h3>组织架构树</h3>
      <div class="header-actions">
        <el-button type="primary" size="small" @click="handleAddRootNode">
          <template #icon>
            <IconifyIconOffline :icon="RiAddLine" />
          </template>
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
        :default-expand-all="false"
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
              <el-tooltip
                v-if="getNodeUsedUserCount(data) > 0"
                :content="`${currentMonthLabel}有 ${getNodeUsedUserCount(data)} 人在使用该节点下的指标`"
                placement="top"
                :show-after="tooltipShowAfter"
              >
                <el-tag
                  type="success"
                  size="small"
                  effect="dark"
                  class="used-user-tag"
                >
                  <span class="used-user-inner">
                    <el-icon class="used-user-icon"><User /></el-icon>
                    <span>{{ currentMonthLabel }} {{ getNodeUsedUserCount(data) }} 人使用</span>
                  </span>
                </el-tag>
              </el-tooltip>
            </span>
            <span class="node-actions">
              <el-tooltip
                :content="`添加${getNodeTypeLabel(data.nodeType)}子节点`"
                placement="top"
                :show-after="tooltipShowAfter"
              >
                <el-icon
                  class="action-icon add-icon"
                  :class="`add-icon-${data.nodeType}`"
                  @click.stop="emit('add-node', data)"
                >
                  <Plus />
                </el-icon>
              </el-tooltip>
              <el-tooltip content="编辑节点" placement="top" :show-after="tooltipShowAfter">
                <el-icon
                  class="action-icon edit-icon"
                  @click.stop="emit('edit-node', data)"
                >
                  <Edit />
                </el-icon>
              </el-tooltip>
              <el-tooltip content="删除节点（递归删除子节点）" placement="top" :show-after="tooltipShowAfter">
                <el-icon
                  class="action-icon delete-icon"
                  @click.stop="emit('delete-node', data)"
                >
                  <Delete />
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

  /* 清除按钮边距 */
  :deep(.el-button) {
    margin-left: 0 !important;
  }
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

/* 树组件全局样式 - 修复节点重叠 */
:deep(.el-tree) {
  .el-tree-node {
    .el-tree-node__content {
      height: auto !important;
      min-height: 48px;
      align-items: flex-start;
      padding: 8px 0;
    }
  }
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
  width: 100%;
  min-height: 32px;
}

.node-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
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

.used-user-tag {
  flex-shrink: 0;
  white-space: nowrap;
}

.used-user-inner {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.used-user-icon {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
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

.delete-icon {
  color: var(--el-color-danger);
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

/* 响应式样式 - 彻底修复手机端节点重叠 */
@media (max-width: 768px) {
  .tree-section {
    min-width: auto;
    width: 100%;
    padding: 12px;
    min-height: 350px;
    height: auto;
    overflow: visible;
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .section-header h3 {
    font-size: 14px;
    text-align: center;
  }

  .header-actions {
    flex-direction: column;
    gap: 8px;
  }

  .header-actions .el-button {
    width: 100%;
  }

  .search-input {
    width: 100%;
  }

  .tree-content {
    overflow-y: auto;
    overflow-x: auto;
    max-height: 500px;
    -webkit-overflow-scrolling: touch;
  }

  /* 手机端树组件核心修复 */
  :deep(.el-tree) {
    .el-tree-node {
      .el-tree-node__content {
        height: auto !important;
        min-height: 64px !important;
        align-items: flex-start !important;
        padding: 12px 0 !important;
        flex-wrap: nowrap;
      }

      .el-tree-node__children {
        padding-left: 16px !important;
      }
    }
  }

  .custom-tree-node {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 8px;
    padding: 0;
    width: 100%;
    min-height: auto;
  }

  .node-info {
    flex: none;
    width: 100%;
    gap: 6px;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .node-label {
    font-size: 14px;
    word-break: break-word;
    line-height: 1.4;
  }

  .node-path {
    font-size: 11px;
    word-break: break-all;
    width: 100%;
    line-height: 1.4;
  }

  .node-actions {
    flex-shrink: 0;
    justify-content: flex-start;
    padding-top: 4px;
    border-top: 1px solid var(--el-border-color-lighter);
    width: 100%;
    gap: 12px;
  }

  .node-type-tag,
  .metric-count-tag {
    flex-shrink: 0;
  }
}
</style>
