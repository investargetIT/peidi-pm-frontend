<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import { ElTree, ElButton, ElMessage, ElInput } from "element-plus";
import {
  addPmKpiGroupNodeNodeConfigApi,
  getPmKpiGroupNodePage
} from "@/api/evaluation";
import type { TreeInstance } from "element-plus";
import { Search } from "@element-plus/icons-vue";

interface MetricConfig {
  id: number;
  nodeId: number;
  targetName: string;
  weight: number | null;
  score: number | null;
  calculationFormula: string;
  createdAt: string;
}

interface TreeNode {
  id: number;
  parentId: number;
  parentName: string | null;
  nodeName: string;
  nodeType: "department" | "position" | "examination_group";
  sortNo: number;
  treeLevel: number;
  treePath: string;
  targetType: string | null;
  status: number;
  metricConfigs: MetricConfig[];
  children: TreeNode[];
}

interface ApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: TreeNode[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
}

const treeRef = ref<TreeInstance>();
const dataSource = ref<TreeNode[]>([]);
const checkedKeys = ref<(number | string)[]>([]);
const loading = ref(false);
const selectedNode = ref<TreeNode | null>(null);
const newMetricName = ref("");
const newMetricFormula = ref(">=");
const searchKeyword = ref("");
let tempId = 10000;
let metricTempId = 20000;

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

const fetchPmKpiGroupNodePage = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiGroupNodePage({
      pageNo: 1,
      pageSize: 1000
    })) as ApiResponse;
    if (res.success && res.data.records) {
      dataSource.value = res.data.records;
    }
  } catch (error) {
    console.error("获取节点列表失败", error);
  } finally {
    loading.value = false;
  }
};

const handleCheck = (data: {
  checkedKeys: (number | string)[];
  halfCheckedKeys: (number | string)[];
}) => {
  checkedKeys.value = data.checkedKeys;
};

const handleNodeClick = (data: TreeNode) => {
  selectedNode.value = data;
};

const append = (data: TreeNode) => {
  const newChild: TreeNode = {
    id: tempId++,
    parentId: data.id,
    parentName: data.nodeName,
    nodeName: "新节点",
    nodeType: data.nodeType,
    sortNo: (data.children?.length || 0) + 1,
    treeLevel: data.treeLevel + 1,
    treePath: data.treePath + tempId + "/",
    targetType: null,
    status: 1,
    metricConfigs: [],
    children: []
  };
  if (!data.children) {
    data.children = [];
  }
  data.children.push(newChild);
  ElMessage.success("添加子节点成功");
};

const remove = (data: TreeNode) => {
  const doRemove = (nodes: TreeNode[]): boolean => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === data.id) {
        nodes.splice(i, 1);
        return true;
      }
      if (nodes[i].children?.length && doRemove(nodes[i].children)) {
        return true;
      }
    }
    return false;
  };
  doRemove(dataSource.value);
  if (selectedNode.value?.id === data.id) {
    selectedNode.value = null;
  }
  ElMessage.success("删除节点成功");
};

const addMetric = async () => {
  if (!selectedNode.value || !newMetricName.value.trim()) {
    ElMessage.warning("请输入指标名称");
    return;
  }
  const currentNodeId = selectedNode.value.id;
  try {
    await addPmKpiGroupNodeNodeConfigApi({
      nodeId: selectedNode.value.id,
      targetName: newMetricName.value.trim(),
      weight: null,
      score: null,
      calculationFormula: newMetricFormula.value
    });
    ElMessage.success("添加指标成功");
    newMetricName.value = "";
    await fetchPmKpiGroupNodePage();
    const restoredNode = findNodeById(dataSource.value, currentNodeId);
    if (restoredNode) {
      selectedNode.value = restoredNode;
    }
  } catch (error) {
    console.error("添加指标失败", error);
    ElMessage.error("添加指标失败");
  }
};

const findNodeById = (nodes: TreeNode[], id: number): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

const removeMetric = (metricId: number) => {
  if (!selectedNode.value) return;
  const index = selectedNode.value.metricConfigs.findIndex(
    m => m.id === metricId
  );
  if (index > -1) {
    selectedNode.value.metricConfigs.splice(index, 1);
    ElMessage.success("删除指标成功");
  }
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

onMounted(() => {
  fetchPmKpiGroupNodePage();
});
</script>

<template>
  <div class="evaluation-tree-container">
    <div class="tree-section">
      <div class="section-header">
        <h3>绩效考核组织架构树</h3>
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
        @check="handleCheck"
        @node-click="handleNodeClick"
      >
        <template #default="{ node, data }">
          <div class="custom-tree-node">
            <span class="node-label" :class="getNodeTypeClass(data.nodeType)">
              {{ node.label }}
              <el-tag
                :type="getNodeTypeTagType(data.nodeType)"
                size="small"
                class="node-type-tag"
              >
                {{ getNodeTypeLabel(data.nodeType) }}
              </el-tag>
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
              <el-button type="primary" link size="small" @click="append(data)">
                添加
              </el-button>
              <el-button type="danger" link size="small" @click="remove(data)">
                删除
              </el-button>
            </span>
          </div>
        </template>
      </el-tree>
    </div>

    <div v-if="selectedNode" class="detail-section">
      <div class="detail-header">
        <h3>{{ selectedNode.nodeName }}</h3>
        <el-tag :type="getNodeTypeTagType(selectedNode.nodeType)">
          {{ getNodeTypeLabel(selectedNode.nodeType) }}
        </el-tag>
      </div>
      <div class="detail-info">
        <p><span class="label">节点ID:</span> {{ selectedNode.id }}</p>
        <p>
          <span class="label">父节点:</span>
          {{ selectedNode.parentName || "-" }}
        </p>
        <p><span class="label">层级:</span> {{ selectedNode.treeLevel }}</p>
        <p>
          <span class="label">状态:</span>
          {{ selectedNode.status === 1 ? "启用" : "禁用" }}
        </p>
      </div>

      <div class="metric-section">
        <div class="metric-header">
          <h4>指标配置</h4>
        </div>
        <div class="add-metric">
          <el-input
            v-model="newMetricName"
            size="small"
            placeholder="输入指标名称"
            class="metric-input"
            @keyup.enter="addMetric"
          />
          <el-select
            v-model="newMetricFormula"
            size="small"
            class="formula-select"
            placeholder="公式"
          >
            <el-option label=">=" value=">=" />
            <el-option label="<=" value="<=" />
            <el-option label="=" value="=" />
            <el-option label=">" value=">" />
            <el-option label="<" value="<" />
          </el-select>
          <el-button type="primary" size="small" @click="addMetric"
            >添加</el-button
          >
        </div>
        <div v-if="selectedNode.metricConfigs?.length" class="metric-list">
          <div
            class="metric-item"
            v-for="metric in selectedNode.metricConfigs"
            :key="metric.id"
          >
            <span class="metric-name">{{ metric.targetName }}</span>
            <div class="metric-actions">
              <el-tag size="small">{{ metric.calculationFormula }}</el-tag>
              <el-button
                type="danger"
                link
                size="small"
                @click="removeMetric(metric.id)"
                >删除</el-button
              >
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无指标配置" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.evaluation-tree-container {
  display: flex;
  gap: 24px;
  /* padding: 16px; */
  height: 100%;
}

.tree-section {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.section-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  white-space: nowrap;
}

.search-input {
  width: 240px;
  flex-shrink: 0;
}

.search-icon {
  font-size: 14px;
}

.detail-section {
  width: 380px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  overflow: auto;
}

.custom-tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  padding-right: 8px;
}

.node-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-department {
  color: var(--el-color-primary);
  font-weight: 500;
}

.node-position {
  color: var(--el-color-warning);
}

.node-examination {
  color: var(--el-color-success);
  font-weight: 500;
}

.node-type-tag {
  margin-right: 4px;
}

.metric-count-tag {
  margin-left: 8px;
}

.node-actions {
  display: flex;
  gap: 4px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
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

.add-metric {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.metric-input {
  flex: 1;
}

.formula-select {
  width: 80px;
}

.metric-list {
  margin-top: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
  margin-bottom: 8px;
}

.metric-name {
  font-size: 14px;
}

.metric-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
