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
  currentMonthLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  monthMetricIndex: () => new Map(),
  currentMonth: "",
  currentMonthLabel: ""
});
const tooltipShowAfter = 800;

const emit = defineEmits<{
  "edit-node": [node: TreeNode];
  "delete-node": [node: TreeNode];
  "add-metric": [];
  "edit-metric": [metric: MetricConfig];
  "delete-metric": [metric: MetricConfig];
}>();

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

// 统计指标各状态人数
const getMetricStats = (metric: MetricConfig) => {
  const users = getMetricUsers(metric);
  const count = { done: 0, doing: 0, pending: 0 };
  users.forEach(u => {
    count[getUserStatus(u)]++;
  });
  return [
    { key: "done", count: count.done, label: "已完成" },
    { key: "doing", count: count.doing, label: "进行中" },
    { key: "pending", count: count.pending, label: "未填写" }
  ];
};

// 获取用户姓名首字符（用于头像）
const getUserInitial = (name: string): string => {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
};

// 头像配色板（按 userId 散列取色，固定展示）
const AVATAR_COLORS = [
  "#5B8FF9",
  "#5AD8A6",
  "#F6BD16",
  "#E86452",
  "#6DC8EC",
  "#945FB9",
  "#FF99C3",
  "#269A99",
  "#FF9845"
];
const getAvatarColor = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

            <!-- {{ currentMonthLabel || '本月' }}使用人 -->
            <div class="metric-users">
              <div class="users-header">
                <span class="users-title">
                  <el-icon class="users-title-icon"><User /></el-icon>
                  {{ currentMonthLabel || "本月" }}使用人
                </span>
                <div class="users-summary">
                  <span
                    v-for="item in getMetricStats(metric)"
                    :key="item.key"
                    class="stat-pill"
                    :class="`stat-pill--${item.key}`"
                  >
                    <span class="stat-dot" />
                    <span class="stat-num">{{ item.count }}</span>
                    <span class="stat-label">{{ item.label }}</span>
                  </span>
                </div>
              </div>
              <div
                v-if="getMetricUsers(metric).length"
                class="user-cards"
              >
                <el-tooltip
                  v-for="u in getMetricUsers(metric)"
                  :key="u.userId + '_' + u.recordId"
                  placement="top"
                  :show-after="tooltipShowAfter"
                >
                  <template #content>
                    <div class="user-tooltip">
                      <div class="user-tooltip__name">{{ u.username }}</div>
                      <div class="user-tooltip__row">
                        <span>工号</span><span>{{ u.jobNum || "-" }}</span>
                      </div>
                      <div class="user-tooltip__row">
                        <span>目标值</span><span>{{ u.target ?? "-" }}</span>
                      </div>
                      <div class="user-tooltip__row">
                        <span>完成值</span><span>{{ u.achieved ?? "-" }}</span>
                      </div>
                      <div class="user-tooltip__status" :class="`is-${getUserStatus(u)}`">
                        {{ getUserStatusLabel(getUserStatus(u)) }}
                      </div>
                    </div>
                  </template>
                  <div
                    class="user-card"
                    :class="`user-card--${getUserStatus(u)}`"
                  >
                    <div
                      class="user-avatar"
                      :style="{ background: getAvatarColor(u.userId) }"
                    >
                      {{ getUserInitial(u.username) }}
                    </div>
                    <div class="user-info">
                      <span class="user-name" :title="u.username">{{ u.username }}</span>
                      <span class="user-status">
                        <span class="status-dot" />
                        {{ getUserStatusLabel(getUserStatus(u)) }}
                      </span>
                    </div>
                  </div>
                </el-tooltip>
              </div>
              <div v-else class="no-users">
                <el-icon class="no-users-icon"><User /></el-icon>
                <span>{{ currentMonthLabel || "本月" }}暂无人员使用此指标</span>
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
  padding: 10px 12px;
  background: linear-gradient(
    135deg,
    #f8fafc 0%,
    #f1f5f9 100%
  );
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.users-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.users-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.users-title-icon {
  color: #64748b;
  font-size: 14px;
}

.users-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
  line-height: 1.4;
  transition: all 0.2s ease;
}

.stat-pill .stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stat-pill--done .stat-dot {
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
}

.stat-pill--doing .stat-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
}

.stat-pill--pending .stat-dot {
  background: #94a3b8;
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.15);
}

.stat-pill--done {
  color: #047857;
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.stat-pill--doing {
  color: #b45309;
  background: #fffbeb;
  border-color: #fde68a;
}

.stat-pill--pending {
  color: #475569;
  background: #f8fafc;
  border-color: #e2e8f0;
}

.stat-pill .stat-num {
  font-weight: 700;
  font-size: 12px;
}

.stat-pill .stat-label {
  opacity: 0.85;
}

.user-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: default;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.user-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #cbd5e1;
  transition: all 0.2s ease;
}

.user-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  border-color: #cbd5e1;
}

.user-card--done::before {
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
}

.user-card--doing::before {
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
}

.user-card--pending::before {
  background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
  margin-top: 1px;
}

.user-status .status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-card--done .user-status .status-dot {
  background: #10b981;
}

.user-card--doing .user-status .status-dot {
  background: #f59e0b;
}

.user-card--pending .user-status .status-dot {
  background: #94a3b8;
}

.user-tooltip {
  font-size: 12px;
  line-height: 1.6;
  padding: 2px;
  min-width: 140px;
}

.user-tooltip__name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
  color: #fff;
}

.user-tooltip__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.user-tooltip__status {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  font-weight: 500;
}

.user-tooltip__status.is-done {
  color: #6ee7b7;
}

.user-tooltip__status.is-doing {
  color: #fcd34d;
}

.user-tooltip__status.is-pending {
  color: #cbd5e1;
}

.no-users {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 0;
  font-size: 12px;
  color: #94a3b8;
}

.no-users-icon {
  font-size: 14px;
  opacity: 0.6;
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

  .users-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .user-cards {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
}
</style>
