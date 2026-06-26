<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { ElMessage } from "element-plus";
import { match } from "pinyin-pro";
import {
  getPmKpiGroupNodeConfigGroupApi,
  updatePmKpiMetricUserApi
} from "@/api/evaluation";

type DialogMode = "add" | "edit";

interface ApiResponse<T = unknown> {
  code: number;
  msg?: string;
  success: boolean;
  data: T;
}

interface UserItem {
  id: number;
  username: string;
  jobNum?: string;
}

interface ConfigInfo {
  calculationFormula?: string;
  id?: number;
  kpiDepict?: string;
  rate?: string;
  targetName?: string;
  weight?: string;
}

interface NodeConfigGroup {
  configList?: ConfigInfo[];
  nodeId?: number;
  nodeName?: string;
}

interface SqlExecItem {
  type: string;
  sqlExecId: number | string | null;
}

interface MetricItem {
  id?: number;
  metricConfigId: number;
  metricType: number;
  targetName: string;
  metricId: string;
  kpiDepict: string;
  rate: string;
  nodeId: number;
  nodeName: string;
  status?: number;
  sqlExecConfig?: string | SqlExecItem[];
  otherConfig?: string | null;
}

interface OtherConfig {
  calculationType?: number;
  notifyUserList?: number[];
}

interface RecordItem {
  userId: number;
  jobNum: string;
  username: string;
  nodeId: number;
  nodeName: string;
  metricList: MetricItem[];
}

interface Props {
  modelValue: boolean;
  mode?: DialogMode;
  recordData?: RecordItem | null;
  userList?: UserItem[];
  userLoading?: boolean;
  achievedSqlList?: { id?: string; name?: string }[];
  finishingRateSqlList?: { id?: string; name?: string }[];
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "success"): void;
}

const props = withDefaults(defineProps<Props>(), {
  mode: "edit",
  recordData: null,
  userList: () => [],
  userLoading: false
});

const emit = defineEmits<Emits>();

const loading = ref(false);
const nodeLoading = ref(false);
const userJobNum = ref("");
const selectedNodeId = ref<number>();
const selectedNodeName = ref("");
const nodeConfigGroups = ref<NodeConfigGroup[]>([]);
const selectedUserId = ref<number>();
const selectedUserName = ref("");
const notifyUserList = ref<number[]>([]);
const userSearchQuery = ref("");
const notifyUserSearchQuery = ref("");

// 编辑态中指标列表的副本，支持独立修改
const metricsEdit = ref<MetricItem[]>([]);

// 过滤用户列表的通用方法
const filterUserList = (query: string, userList: UserItem[]) => {
  if (!query) {
    return userList;
  }
  const lowerQuery = query.toLowerCase();
  return userList.filter(item => {
    if (!item.username) return false;
    // 直接匹配
    if (item.username.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    // 拼音匹配
    try {
      const matchResult = match(item.username, lowerQuery);
      return matchResult && matchResult.length > 0;
    } catch (e) {
      console.error("拼音匹配错误:", e);
      return false;
    }
  });
};

// 过滤后的用户列表（用于选择用户）
const filteredUserList = computed(() => {
  return filterUserList(userSearchQuery.value, props.userList);
});

// 过滤后的用户列表（用于通知用户）
const filteredNotifyUserList = computed(() => {
  return filterUserList(notifyUserSearchQuery.value, props.userList);
});

const dialogTitle = computed(() =>
  props.mode === "add" ? "新增KPI指标用户" : "修改KPI指标用户"
);

const parseSqlExecConfig = (sqlExecConfig?: string | SqlExecItem[]): SqlExecItem[] => {
  if (!sqlExecConfig || sqlExecConfig === "0") {
    return [
      { type: "achieved", sqlExecId: null },
      { type: "finishingRate", sqlExecId: null }
    ];
  }
  if (Array.isArray(sqlExecConfig)) {
    return sqlExecConfig.map(item => ({
      ...item,
      sqlExecId: item.sqlExecId != null ? String(item.sqlExecId) : null
    }));
  }
  try {
    const parsed = JSON.parse(sqlExecConfig);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        ...item,
        sqlExecId: item.sqlExecId != null ? String(item.sqlExecId) : null
      }));
    }
  } catch {}
  return [
    { type: "achieved", sqlExecId: null },
    { type: "finishingRate", sqlExecId: null }
  ];
};

const getSqlExecIdByType = (
  sqlExecConfig: SqlExecItem[] | string | null | undefined,
  type: string
): number | string | null => {
  const config = parseSqlExecConfig(sqlExecConfig);
  const item = config.find(i => i.type === type);
  return item?.sqlExecId ?? null;
};

const setSqlExecIdByType = (
  row: MetricItem,
  type: string,
  id: number | string | null
) => {
  let config = parseSqlExecConfig(row.sqlExecConfig);
  const item = config.find(i => i.type === type);
  if (item) {
    item.sqlExecId = id;
  } else {
    config.push({ type, sqlExecId: id });
  }
  row.sqlExecConfig = config;
};

// 解析otherConfig字符串为对象
const parseOtherConfig = (otherConfig?: string | null): OtherConfig => {
  if (!otherConfig || otherConfig.trim() === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(otherConfig);
    return parsed || {};
  } catch (error) {
    console.error("解析otherConfig失败", error);
    return {};
  }
};

// 从第一条指标中获取otherConfig（获取统一的notifyUserList）
const getUnifiedOtherConfig = (metrics: MetricItem[]): OtherConfig => {
  const firstMetric = metrics.find(m => m.otherConfig);
  if (!firstMetric) return {};
  return parseOtherConfig(firstMetric.otherConfig);
};

// 更新所有指标的通知人列表
const updateAllMetricsNotifyUserList = (metrics: MetricItem[], notifyUserList: number[]) => {
  metrics.forEach(metric => {
    const config = parseOtherConfig(metric.otherConfig);
    config.notifyUserList = notifyUserList.length > 0 ? notifyUserList : undefined;
    metric.otherConfig = JSON.stringify(config);
  });
};

// 更新单个指标的计算类型
const updateMetricCalculationType = (metric: MetricItem, calculationType?: number) => {
  const config = parseOtherConfig(metric.otherConfig);
  // 保留原有的notifyUserList
  const notifyUserList = config.notifyUserList;
  const newConfig: OtherConfig = {};
  if (calculationType !== undefined) {
    newConfig.calculationType = calculationType;
  }
  if (notifyUserList && notifyUserList.length > 0) {
    newConfig.notifyUserList = notifyUserList;
  }
  metric.otherConfig = Object.keys(newConfig).length > 0 ? JSON.stringify(newConfig) : null;
};

const buildMetricsByNode = (
  nodeConfig?: NodeConfigGroup,
  oldMetrics: MetricItem[] = []
): MetricItem[] => {
  if (!nodeConfig) return [];
  const oldMetricMap = new Map(
    oldMetrics.map(item => [item.metricConfigId, item] as const)
  );

  // 获取旧指标中的统一通知人列表
  const unifiedConfig = getUnifiedOtherConfig(oldMetrics);
  const oldNotifyList = unifiedConfig.notifyUserList || [];

  return (nodeConfig.configList || []).map(config => {
    const oldMetric = config.id ? oldMetricMap.get(config.id) : undefined;
    const sqlExecConfig = oldMetric?.sqlExecConfig
      ? parseSqlExecConfig(oldMetric.sqlExecConfig)
      : [
          { type: "achieved", sqlExecId: null },
          { type: "finishingRate", sqlExecId: null }
        ];

    // 构建新的otherConfig，保留通知人
    const newConfig: OtherConfig = {};
    if (oldMetric?.otherConfig) {
      const oldConfig = parseOtherConfig(oldMetric.otherConfig);
      if (oldConfig.calculationType !== undefined) {
        newConfig.calculationType = oldConfig.calculationType;
      }
    }
    if (oldNotifyList.length > 0) {
      newConfig.notifyUserList = oldNotifyList;
    }

    return {
      id: oldMetric?.id,
      metricConfigId: config.id || 0,
      metricType: oldMetric?.metricType ?? 1,
      targetName: config.targetName || "",
      metricId: oldMetric?.metricId || "",
      kpiDepict: config.kpiDepict || "",
      rate: config.rate || "",
      nodeId: nodeConfig.nodeId || 0,
      nodeName: nodeConfig.nodeName || "",
      status: oldMetric?.status ?? 1,
      sqlExecConfig,
      otherConfig: Object.keys(newConfig).length > 0 ? JSON.stringify(newConfig) : null
    };
  });
};

const fetchNodeConfigGroups = async () => {
  nodeLoading.value = true;
  try {
    const res = (await getPmKpiGroupNodeConfigGroupApi()) as ApiResponse<
      NodeConfigGroup[]
    >;
    if (res?.code === 200 || res?.success) {
      nodeConfigGroups.value = res.data || [];
    } else {
      ElMessage.error(res?.msg || "获取考核组失败");
    }
  } catch (error) {
    console.error("获取考核组失败", error);
    ElMessage.error("获取考核组失败");
  } finally {
    nodeLoading.value = false;
  }
};

const resetState = () => {
  userJobNum.value = "";
  selectedNodeId.value = undefined;
  selectedNodeName.value = "";
  metricsEdit.value = [];
  selectedUserId.value = undefined;
  selectedUserName.value = "";
  notifyUserList.value = [];
  userSearchQuery.value = "";
  notifyUserSearchQuery.value = "";
};

// 监听通知人变化，自动更新所有指标
watch(notifyUserList, newList => {
  if (metricsEdit.value.length > 0) {
    updateAllMetricsNotifyUserList(metricsEdit.value, newList);
  }
});

watch(
  () => props.modelValue,
  async newVal => {
    if (!newVal) {
      resetState();
      return;
    }

    if (props.mode === "edit" && props.recordData) {
      userJobNum.value = props.recordData.jobNum || "";
      selectedNodeId.value = props.recordData.nodeId;
      selectedNodeName.value = props.recordData.nodeName || "";
      const initialMetrics = props.recordData.metricList.map(m => ({
        ...m,
        status: m.status ?? 1
      }));
      metricsEdit.value = sortMetrics(initialMetrics);

      // 从第一条指标中解析otherConfig并初始化状态
      const parsedConfig = getUnifiedOtherConfig(metricsEdit.value);
      notifyUserList.value = parsedConfig.notifyUserList || [];
    } else if (props.mode === "add") {
      resetState();
    }

    if (!nodeConfigGroups.value.length) {
      await fetchNodeConfigGroups();
    }
  }
);

const handleUserChange = (userId: number) => {
  const user = props.userList.find(u => u.id === userId);
  if (user) {
    selectedUserName.value = user.username;
    userJobNum.value = user.jobNum || "";
  }
};

const metricTypeText = (type: number) => {
  return type === 1 ? "定量考核" : String(type);
};

// 获取计算类型文本
const getCalculationTypeText = (calculationType?: number): string => {
  if (calculationType === 1) return "混合模式";
  if (calculationType === 2) return "累计模式";
  if (calculationType === 3) return "当月模式";
  if (calculationType === 4) return "自定义模式";
  return "";
};

// 获取计算类型对应的TAG类型
const getCalculationTypeTag = (calculationType?: number): "primary" | "success" | "warning" | "info" | "danger" => {
  if (calculationType === 1) return "primary";    // 蓝色
  if (calculationType === 2) return "success";    // 绿色
  if (calculationType === 3) return "warning";    // 橙色
  if (calculationType === 4) return "danger";     // 红色
  return "info";
};

// 指标排序函数：开启的优先，状态相同则保持原顺序
const sortMetrics = (metrics: MetricItem[]): MetricItem[] => {
  return [...metrics].sort((a, b) => {
    const statusA = a.status ?? 1;
    const statusB = b.status ?? 1;
    // 状态为1（开启）的排前面
    if (statusA !== statusB) {
      return statusB - statusA;
    }
    // 状态相同保持原顺序（通过metricConfigId或其他字段稳定排序）
    return (a.metricConfigId || 0) - (b.metricConfigId || 0);
  });
};

// 当开关状态改变时，重新排序列表
const handleStatusChange = () => {
  metricsEdit.value = sortMetrics(metricsEdit.value);
};

const handleNodeChange = (nodeId: number) => {
  const nodeConfig = nodeConfigGroups.value.find(item => item.nodeId === nodeId);
  selectedNodeName.value = nodeConfig?.nodeName || "";
  // 切换考核组后，指标全部更新为所选考核组的最新指标配置
  const newMetrics = buildMetricsByNode(nodeConfig);
  metricsEdit.value = sortMetrics(newMetrics);
};

const handleSubmit = async () => {
  if (props.mode === "add" && !selectedUserId.value) {
    ElMessage.warning("请选择用户");
    return;
  }
  if (!selectedNodeId.value) {
    ElMessage.warning("请选择考核组");
    return;
  }
  if (!metricsEdit.value.length) {
    ElMessage.warning("当前考核组没有可保存的指标数据");
    return;
  }

  loading.value = true;
  try {
    const submitData = {
      userId: props.mode === "add" ? (selectedUserId.value as number) : (props.recordData?.userId as number),
      jobNum: userJobNum.value,
      username: props.mode === "add" ? selectedUserName.value : (props.recordData?.username || ""),
      nodeId: selectedNodeId.value,
      nodeName: selectedNodeName.value,
      metricList: metricsEdit.value.map(m => ({
        ...(props.mode === "edit" ? { id: m.id } : {}),
        metricConfigId: m.metricConfigId,
        metricType: m.metricType,
        targetName: m.targetName,
        metricId: m.metricId,
        kpiDepict: m.kpiDepict,
        rate: m.rate,
        nodeId: selectedNodeId.value,
        nodeName: selectedNodeName.value,
        status: m.status ?? 1,
        sqlExecConfig: Array.isArray(m.sqlExecConfig)
          ? JSON.stringify(m.sqlExecConfig)
          : m.sqlExecConfig || "",
        otherConfig: m.otherConfig
      }))
    };

    const res = (await updatePmKpiMetricUserApi(submitData)) as ApiResponse;

    // 后端可能返回 code !== 200 但不抛异常
    if (res?.code !== 200) {
      ElMessage.error(res?.msg || (props.mode === "add" ? "新增失败" : "修改失败"));
      return;
    }

    ElMessage.success(props.mode === "add" ? "新增成功" : "修改成功");
    handleClose();
    emit("success");
  } catch (error) {
    console.error(props.mode === "add" ? "新增失败" : "修改失败", error);
    ElMessage.error(props.mode === "add" ? "新增失败" : "修改失败");
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  emit("update:modelValue", false);
};

// 拼音搜索用户过滤
const userFilterMethod = (query: string, item: UserItem) => {
  if (!query || !item.username) return false;
  const lowerQuery = query.toLowerCase();
  // 直接匹配
  if (item.username.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  // 拼音匹配
  try {
    const matchResult = match(item.username, lowerQuery);
    return matchResult && matchResult.length > 0;
  } catch (e) {
    console.error("拼音匹配错误:", e);
    return false;
  }
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="1200px"
    :close-on-click-modal="false"
    append-to-body
    @close="handleClose"
  >
    <div class="edit-container">
      <!-- 用户基本信息 -->
      <div class="user-info-section">
        <h4 class="section-title">用户信息</h4>
        <el-form label-width="80px" size="small">
          <el-row :gutter="16">
            <el-col :span="6">
              <el-form-item label="用户名">
                <template v-if="props.mode === 'edit'">
                  <el-input :model-value="props.recordData?.username" disabled />
                </template>
                <template v-else>
                  <el-select
                    v-model="selectedUserId"
                    placeholder="请搜索选择用户"
                    filterable
                    :filter-method="(query: string) => userSearchQuery = query"
                    :loading="props.userLoading"
                    style="width: 100%"
                    @change="handleUserChange"
                  >
                    <el-option
                      v-for="item in filteredUserList"
                      :key="item.id"
                      :label="item.username"
                      :value="item.id"
                    />
                  </el-select>
                </template>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="工号">
                <el-input v-model="userJobNum" placeholder="请输入工号" />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="考核组">
                <el-select
                  v-model="selectedNodeId"
                  placeholder="请选择考核组"
                  filterable
                  :loading="nodeLoading"
                  style="width: 100%"
                  @change="handleNodeChange"
                >
                  <el-option
                    v-for="item in nodeConfigGroups"
                    :key="item.nodeId"
                    :label="item.nodeName"
                    :value="item.nodeId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="通知用户">
                <el-select
                  v-model="notifyUserList"
                  multiple
                  filterable
                  :filter-method="(query: string) => notifyUserSearchQuery = query"
                  placeholder="请选择通知用户"
                  :loading="props.userLoading"
                  style="width: 100%"
                >
                  <el-option
                    v-for="item in filteredNotifyUserList"
                    :key="item.id"
                    :label="item.username"
                    :value="item.id"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>

      <!-- 指标列表编辑 -->
      <div class="metrics-section">
        <h4 class="section-title">指标列表</h4>
        <div class="calculation-type-tip">
          <div class="tip-header">
            <el-tag size="small" type="info" effect="light">计算类型说明</el-tag>
          </div>
          <div class="types-container">
            <div class="type-item">
              <span class="type-name">累计模式</span>
              <span class="type-desc">举个例子：如果现在是6月，我们统计5月的数据，累计模式会计算1月到5月的总和作为目标值和完成值</span>
            </div>
            <div class="type-item">
              <span class="type-name">当月模式</span>
              <span class="type-desc">举个例子：如果现在是6月，我们统计5月的数据，当月模式只会计算5月这一个月的数据作为目标值和完成值</span>
            </div>
            <div class="type-item">
              <span class="type-name">自定义模式</span>
              <span class="type-desc">根据特定指标的特殊需求进行自定义计算逻辑，需要在代码中单独配置</span>
            </div>
          </div>
        </div>
        <el-table :data="metricsEdit" border stripe size="small">
          <el-table-column label="考核指标" min-width="160">
            <template #default="{ row }">
              {{ row.targetName }}
            </template>
          </el-table-column>
          <el-table-column label="指标类型" width="100" align="center">
            <template #default="{ row }">
              {{ metricTypeText(row.metricType) }}
            </template>
          </el-table-column>
          <el-table-column label="指标编号" width="180">
            <template #default="{ row }">
              <el-input
                v-model="row.metricId"
                placeholder="请输入指标编号"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column label="计算类型" width="160">
            <template #default="{ row }">
              <div class="calculation-type-cell">
                <el-select
                  :model-value="parseOtherConfig(row.otherConfig).calculationType"
                  placeholder="请选择"
                  clearable
                  size="small"
                  style="width: 100%"
                  @update:model-value="val => updateMetricCalculationType(row, val)"
                >
                  <el-option label="累计模式" :value="2" />
                  <el-option label="当月模式" :value="3" />
                  <el-option label="自定义模式" :value="4" />
                </el-select>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="实际值" width="160">
            <template #default="{ row }">
              <el-select
                :model-value="getSqlExecIdByType(row.sqlExecConfig, 'achieved')"
                placeholder="请选择"
                filterable
                clearable
                size="small"
                style="width: 100%"
                @update:model-value="val => setSqlExecIdByType(row, 'achieved', val)"
              >
                <el-option
                  v-for="item in props.achievedSqlList"
                  :key="item.id"
                  :label="item.name || ''"
                  :value="item.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="达成率" width="160">
            <template #default="{ row }">
              <el-select
                :model-value="getSqlExecIdByType(row.sqlExecConfig, 'finishingRate')"
                placeholder="请选择"
                filterable
                clearable
                size="small"
                style="width: 100%"
                @update:model-value="val => setSqlExecIdByType(row, 'finishingRate', val)"
              >
                <el-option
                  v-for="item in props.finishingRateSqlList"
                  :key="item.id"
                  :label="item.name || ''"
                  :value="item.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                v-model="row.status"
                :active-value="1"
                :inactive-value="0"
                size="small"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="loading">
          {{ props.mode === "add" ? "确定" : "保存" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.edit-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
}

.user-info-section,
.metrics-section {
  background: var(--el-fill-color-light);
  padding: 16px;
  border-radius: 6px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.calculation-type-tip {
  margin-bottom: 12px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
}

.tip-header {
  margin-bottom: 8px;
}

.types-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 8px;
}

.type-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background-color: #ffffff;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.type-name {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}

.type-desc {
  font-size: 12px;
  color: #606266;
  line-height: 1.4;
}
</style>
