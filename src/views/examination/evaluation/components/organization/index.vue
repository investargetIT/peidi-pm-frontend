<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import dayjs from "dayjs";
import {
  getPmKpiGroupNodePage,
  deletePmKpiGroupNodeApi,
  deletePmKpiGroupNodeNodeConfigApi,
  getPmKpiMonthMetricTargetPage
} from "@/api/evaluation";
import TreeSection from "./components/TreeSection.vue";
import DetailSection from "./components/DetailSection.vue";
import NodeEditDialog from "./components/NodeEditDialog.vue";
import MetricEditDialog from "./components/MetricEditDialog.vue";
import type { TreeNode, MetricConfig, ApiResponse } from "./components/types";

interface MonthUserInfo {
  userId: string;
  username: string;
  jobNum?: string;
  target: number | null;
  achieved: number | null;
  recordId: string;
}

interface MonthApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: Array<{
      userId: string | number;
      jobNum?: string;
      username: string;
      month: string;
      metricTargetList?: Array<{
        id: string | number;
        nodeId: string | number;
        targetName: string;
        target: number | null;
        achieved: number | null;
        status?: number;
      }>;
    }>;
    total: number;
  };
}

const dataSource = ref<TreeNode[]>([]);
const loading = ref(false);
const selectedNode = ref<TreeNode | null>(null);

// 月度数据
const currentMonth = ref(
  dayjs()
    .subtract(1, "month")
    .startOf("month")
    .format("YYYY-MM-DD")
);
// 展示用的月份文案，例如 "2026年7月"
const currentMonthLabel = computed(() => {
  const d = dayjs(currentMonth.value);
  return d.isValid() ? `${d.format("YYYY")}年${Number(d.format("M"))}月` : "";
});
// 禁用当月之后的月份
const disabledMonth = (time: Date) => {
  return dayjs(time).isAfter(dayjs().startOf("month"), "month");
};
const monthMetricIndex = ref<Map<string, MonthUserInfo[]>>(new Map());

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

const fetchMonthMetrics = async (month?: string) => {
  const targetMonth = month || currentMonth.value;
  try {
    const res = (await getPmKpiMonthMetricTargetPage({
      startDate: targetMonth,
      endDate: targetMonth,
      pageNo: 1,
      pageSize: 99999
    })) as MonthApiResponse;

    const map = new Map<string, MonthUserInfo[]>();
    if (res?.success && res.data?.records) {
      res.data.records.forEach(user => {
        (user.metricTargetList || []).forEach(m => {
          if (m.status === 0) return;
          const key = `${m.nodeId}__${m.targetName}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({
            userId: String(user.userId),
            username: user.username,
            jobNum: user.jobNum,
            target: m.target,
            achieved: m.achieved,
            recordId: String(m.id)
          });
        });
      });
    }
    monthMetricIndex.value = map;
  } catch (error) {
    console.error("获取月度指标失败", error);
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

const handleDeleteNode = async (node: TreeNode) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除节点「${node.nodeName}」吗？该操作会递归删除所有子节点。`,
      "删除节点确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );

    await ElMessageBox.confirm(
      "删除后不可恢复，节点下的子节点和指标配置也会被删除，请再次确认是否删除？",
      "二次确认",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "error",
        confirmButtonClass: "el-button--danger"
      }
    );

    const currentNodeId = selectedNode.value?.id;
    const res = (await deletePmKpiGroupNodeApi({
      id: node.id
    })) as { success?: boolean; msg?: string };

    if (res?.success === false) {
      ElMessage.error(res.msg || "删除节点失败");
      return;
    }

    ElMessage.success("删除节点成功");
    await fetchPmKpiGroupNodePage();

    if (currentNodeId) {
      const restoredNode = findNodeById(dataSource.value, currentNodeId);
      selectedNode.value = restoredNode || null;
    }
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      console.error("删除节点失败", error);
      ElMessage.error("删除节点失败");
    }
  }
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

const handleDeleteMetric = async (metric: MetricConfig) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除指标配置「${metric.targetName}」吗？`,
      "删除确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );

    await ElMessageBox.confirm(
      "删除后不可恢复，请再次确认是否删除该节点指标配置？",
      "二次确认",
      {
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        type: "error",
        confirmButtonClass: "el-button--danger"
      }
    );

    const res = (await deletePmKpiGroupNodeNodeConfigApi({
      id: metric.id
    })) as { success?: boolean; msg?: string };

    if (res?.success === false) {
      ElMessage.error(res.msg || "删除节点指标配置失败");
      return;
    }

    ElMessage.success("删除节点指标配置成功");
    await handleMetricDialogSuccess();
  } catch (error) {
    if (error !== "cancel" && error !== "close") {
      console.error("删除节点指标配置失败", error);
      ElMessage.error("删除节点指标配置失败");
    }
  }
};

const handleMetricDialogSuccess = async () => {
  const currentNodeId = selectedNode.value?.id;
  await fetchPmKpiGroupNodePage();
  // 指标配置有变更（增/删/改 targetName），
  // 都要重拉月度数据以让"指标↔人"匹配关系同步
  await fetchMonthMetrics(currentMonth.value);
  if (currentNodeId) {
    const restoredNode = findNodeById(dataSource.value, currentNodeId);
    if (restoredNode) {
      selectedNode.value = restoredNode;
    }
  }
};

// 监听月份变化，重新拉取月度指标
watch(currentMonth, val => {
  if (val) {
    fetchMonthMetrics(val);
  }
});

onMounted(() => {
  fetchPmKpiGroupNodePage();
  fetchMonthMetrics();
});
</script>

<template>
  <div class="evaluation-tree-container">
    <div class="month-toolbar">
      <span class="month-label">查看月份：</span>
      <el-date-picker
        v-model="currentMonth"
        type="month"
        placeholder="选择月份"
        :clearable="false"
        :disabled-date="disabledMonth"
        value-format="YYYY-MM-DD"
        style="width: 160px"
      />
      <span class="month-hint">展示「{{ currentMonthLabel }}」的使用人数据</span>
    </div>
    <div class="evaluation-main">
      <TreeSection
        :data-source="dataSource"
        :loading="loading"
        :month-metric-index="monthMetricIndex"
        :current-month-label="currentMonthLabel"
        @node-click="handleNodeClick"
        @add-node="handleAddNode"
        @edit-node="handleEditNode"
        @delete-node="handleDeleteNode"
      />
      <DetailSection
        :selected-node="selectedNode"
        :month-metric-index="monthMetricIndex"
        :current-month="currentMonth"
        :current-month-label="currentMonthLabel"
        @edit-node="handleEditNode"
        @delete-node="handleDeleteNode"
        @add-metric="handleAddMetric"
        @edit-metric="handleEditMetric"
        @delete-metric="handleDeleteMetric"
      />
    </div>
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
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 200px);
  min-height: 600px;
  overflow: hidden;

  @media (max-width: 768px) {
    height: auto;
    min-height: auto;
  }
}

.evaluation-main {
  display: flex;
  flex-direction: row;
  gap: 24px;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
}

.month-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .month-label {
    font-size: 14px;
    color: #303133;
  }

  .month-hint {
    font-size: 12px;
    color: #909399;
    margin-left: 4px;
  }
}
</style>
