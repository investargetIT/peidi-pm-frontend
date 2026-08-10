<script lang="ts" setup>
import { Edit, Delete, User } from "@element-plus/icons-vue";
import type { TreeNode, MetricConfig } from "./types";

interface MonthUserInfo {
  userId: string;
  username: string;
  jobNum?: string;
  target: number | null;
  achieved: number | null;
  recordId: string;
}

interface Props {
  selectedNode: TreeNode | null;
  monthMetricIndex?: Map<string, MonthUserInfo[]>;
  currentMonth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  monthMetricIndex: () => new Map(),
  currentMonth: ""
});
const tooltipShowAfter = 800;

const emit = defineEmits<{
  "edit-node": [node: TreeNode];
  "delete-node": [node: TreeNode];
  "add-metric": [];
  "edit-metric": [metric: MetricConfig];
  "delete-metric": [metric: MetricConfig];
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

// 获取指标的本月使用人
const getMetricUsers = (metric: MetricConfig): MonthUserInfo[] => {
  const key = `${metric.nodeId}__${metric.targetName}`;
  return props.monthMetricIndex.get(key) || [];
};

// 判断用户完成状态：done=已完成, doing=进行中, pending=未填
const getUserStatus = (
  u: MonthUserInfo
): "done" | "doing" | "pending" => {
  if (u.achieved == null || u.achieved === "") return "pending";
  const targetNum = Number(u.target);
  const achievedNum = Number(u.achieved);
  if (targetNum > 0 && achievedNum >= targetNum) return "done";
  return "doing";
};

const getUserStatusLabel = (status: "done" | "doing" | "pending") => {
  const map: Record<string, string> = {
    done: "已完成",
    doing: "进行中",
    pending: "未填写"
  };
  return map[status];
};

const getUserStatusType = (status: "done" | "doing" | "pending") => {
  const map: Record<string, string> = {
    done: "success",
    doing: "warning",
    pending: "info"
  };
  return map[status];
};
</script>

<template>
  <div v-if="selectedNode" class="detail-section">
    <div class="detail-header">
      <h3>{{ selectedNode.nodeName }}</h3>
      <el-tag :type="getNodeTypeTagType(selectedNode.nodeType)">
        {{ getNodeTypeLabel(selectedNode.nodeType) }}
      </el-tag>
      <div class="detail-actions">
        <el-tooltip content="编辑节点" placement="top" :show-after="tooltipShowAfter">
          <el-button
            type="primary"
            link
            :icon="Edit"
            @click="emit('edit-node', selectedNode)"
          />
        </el-tooltip>
        <el-tooltip content="删除节点（递归删除子节点）" placement="top" :show-after="tooltipShowAfter">
          <el-button
            type="danger"
            link
            :icon="Delete"
            @click="emit('delete-node', selectedNode)"
          />
        </el-tooltip>
      </div>
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

            <!-- 本月使用人 -->
            <div class="metric-users">
              <div class="users-header">
                <el-icon><User /></el-icon>
                <span class="users-title">本月使用人</span>
                <el-tag
                  size="small"
                  :type="getMetricUsers(metric).length ? 'primary' : 'info'"
                  effect="light"
                >
                  {{ getMetricUsers(metric).length }} 人
                </el-tag>
                <span class="users-legend">
                  <el-tag size="small" type="success" effect="plain">已完成</el-tag>
                  <el-tag size="small" type="warning" effect="plain">进行中</el-tag>
                  <el-tag size="small" type="info" effect="plain">未填写</el-tag>
                </span>
              </div>
              <div
                v-if="getMetricUsers(metric).length"
                class="user-chips"
              >
                <el-tooltip
                  v-for="u in getMetricUsers(metric)"
                  :key="u.userId + '_' + u.recordId"
                  placement="top"
                >
                  <template #content>
                    <div>工号：{{ u.jobNum || "-" }}</div>
                    <div>目标值：{{ u.target ?? "-" }}</div>
                    <div>完成值：{{ u.achieved ?? "-" }}</div>
                  </template>
                  <el-tag
                    size="small"
                    :type="getUserStatusType(getUserStatus(u)) as any"
                    effect="light"
                    class="user-chip"
                  >
                    {{ u.username }}
                  </el-tag>
                </el-tooltip>
              </div>
              <div v-else class="no-users">
                <el-text type="info" size="small"
                  >本月无人使用此指标</el-text
                >
              </div>
            </div>
          </div>
          <div class="metric-actions">
            <el-tooltip content="编辑指标" placement="top" :show-after="tooltipShowAfter">
              <el-button
                type="primary"
                link
                :icon="Edit"
                @click="emit('edit-metric', metric)"
              />
            </el-tooltip>
            <el-tooltip content="删除指标配置" placement="top" :show-after="tooltipShowAfter">
              <el-button
                type="danger"
                link
                :icon="Delete"
                @click="emit('delete-metric', metric)"
              />
            </el-tooltip>
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

.detail-actions {
  display: flex;
  align-items: center;
  gap: 4px;
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
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 32px;
}

.metric-users {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 4px;
}

.users-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.users-title {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.users-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-wrap: wrap;
}

.users-legend :deep(.el-tag) {
  margin: 0 !important;
  height: 18px;
  line-height: 16px;
  padding: 0 5px;
  font-size: 11px;
}

.user-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.user-chip {
  margin: 0 !important;
  cursor: default;
}

.no-users {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.metric-actions :deep(.el-button) {
  margin-left: 0;
  padding: 4px;
}

.metric-actions :deep(.el-button .el-icon) {
  font-size: 16px;
}

/* 响应式样式 */
@media (max-width: 768px) {
  .detail-section {
    width: 100%;
    padding: 12px;
    min-height: 300px;
  }

  .detail-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .detail-header h3 {
    font-size: 14px;
  }

  .detail-actions {
    width: 100%;
    justify-content: flex-end;
    padding-top: 4px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .detail-info p {
    flex-direction: column;
    gap: 4px;
  }

  .detail-info .label {
    width: auto;
    font-weight: 500;
  }

  .metric-header {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .metric-header .el-button {
    width: 100%;
  }

  .metric-item {
    flex-direction: column;
    padding: 10px;
  }

  .metric-actions {
    width: 100%;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}
</style>
