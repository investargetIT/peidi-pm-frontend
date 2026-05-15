<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import {
  getPmKpiGroupNodePage,
  addPmKpiGroupNodeApi,
  updatePmKpiGroupNodeApi,
  addPmKpiGroupNodeNodeConfigApi,
  updatePmKpiGroupNodeNodeConfigApi
} from "@/api/evaluation";
import TreeSection from "./components/TreeSection.vue";
import DetailSection from "./components/DetailSection.vue";
import NodeEditDialog from "./components/NodeEditDialog.vue";
import MetricEditDialog from "./components/MetricEditDialog.vue";
import type { TreeNode, MetricConfig, ApiResponse } from "./components/types";

const dataSource = ref<TreeNode[]>([]);
const loading = ref(false);
const selectedNode = ref<TreeNode | null>(null);

// 节点编辑对话框
const nodeDialogVisible = ref(false);
const editingNode = ref<TreeNode | null>(null);
const addingParentNode = ref<TreeNode | null>(null);

// 指标编辑对话框
const metricDialogVisible = ref(false);
const editingMetric = ref<MetricConfig | null>(null);

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

const handleNodeClick = (node: TreeNode) => {
  selectedNode.value = node;
};

const handleAddNode = (parentNode: TreeNode | null) => {
  addingParentNode.value = parentNode;
  editingNode.value = null;
  nodeDialogVisible.value = true;
};

const handleEditNode = (node: TreeNode) => {
  editingNode.value = node;
  addingParentNode.value = null;
  nodeDialogVisible.value = true;
};

const handleNodeDialogSuccess = async () => {
  const currentNodeId = selectedNode.value?.id;
  await fetchPmKpiGroupNodePage();
  if (currentNodeId) {
    const restoredNode = findNodeById(dataSource.value, currentNodeId);
    if (restoredNode) {
      selectedNode.value = restoredNode;
    }
  }
};

const handleAddMetric = () => {
  if (!selectedNode.value) return;
  editingMetric.value = null;
  metricDialogVisible.value = true;
};

const handleEditMetric = (metric: MetricConfig) => {
  editingMetric.value = metric;
  metricDialogVisible.value = true;
};

const handleMetricDialogSuccess = async () => {
  const currentNodeId = selectedNode.value?.id;
  await fetchPmKpiGroupNodePage();
  if (currentNodeId) {
    const restoredNode = findNodeById(dataSource.value, currentNodeId);
    if (restoredNode) {
      selectedNode.value = restoredNode;
    }
  }
};

onMounted(() => {
  fetchPmKpiGroupNodePage();
});
</script>

<template>
  <div class="evaluation-tree-container">
    <TreeSection
      :data-source="dataSource"
      :loading="loading"
      @node-click="handleNodeClick"
      @add-node="handleAddNode"
      @edit-node="handleEditNode"
    />
    <DetailSection
      :selected-node="selectedNode"
      @edit-node="handleEditNode"
      @add-metric="handleAddMetric"
      @edit-metric="handleEditMetric"
    />
    <NodeEditDialog
      v-model:visible="nodeDialogVisible"
      :node="editingNode"
      :parent-node="addingParentNode"
      @success="handleNodeDialogSuccess"
    />
    <MetricEditDialog
      v-model:visible="metricDialogVisible"
      :metric="editingMetric"
      :node-id="selectedNode?.id || 0"
      @success="handleMetricDialogSuccess"
    />
  </div>
</template>

<style scoped>
.evaluation-tree-container {
  display: flex;
  gap: 24px;
  height: calc(100vh - 200px);
  min-height: 600px;
  overflow: hidden;
}
</style>
