<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { ElMessage } from "element-plus";
import {
  getPmKpiGroupNodeConfigGroupApi,
  updatePmKpiMetricUserApi,
  getUserListApi
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
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "success"): void;
}

const props = withDefaults(defineProps<Props>(), {
  mode: "edit",
  recordData: null
});

const emit = defineEmits<Emits>();

const loading = ref(false);
const nodeLoading = ref(false);
const userLoading = ref(false);
const userJobNum = ref("");
const selectedNodeId = ref<number>();
const selectedNodeName = ref("");
const nodeConfigGroups = ref<NodeConfigGroup[]>([]);
const userList = ref<UserItem[]>([]);
const selectedUserId = ref<number>();
const selectedUserName = ref("");

// 编辑态中指标列表的副本，支持独立修改
const metricsEdit = ref<MetricItem[]>([]);

const dialogTitle = computed(() =>
  props.mode === "add" ? "新增KPI指标用户" : "修改KPI指标用户"
);

const buildMetricsByNode = (
  nodeConfig?: NodeConfigGroup,
  oldMetrics: MetricItem[] = []
): MetricItem[] => {
  if (!nodeConfig) return [];
  const oldMetricMap = new Map(
    oldMetrics.map(item => [item.metricConfigId, item] as const)
  );

  return (nodeConfig.configList || []).map(config => {
    const oldMetric = config.id ? oldMetricMap.get(config.id) : undefined;
    return {
      // 考核组未变更时保留原指标用户明细 id；考核组变更时不带旧 id，避免旧指标被错误复用
      id: oldMetric?.id,
      metricConfigId: config.id || 0,
      metricType: oldMetric?.metricType ?? 1,
      targetName: config.targetName || "",
      metricId: oldMetric?.metricId || "",
      kpiDepict: config.kpiDepict || "",
      rate: config.rate || "",
      nodeId: nodeConfig.nodeId || 0,
      nodeName: nodeConfig.nodeName || "",
      status: oldMetric?.status ?? 1
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

const fetchUserList = async () => {
  userLoading.value = true;
  try {
    const res = (await getUserListApi({ name: "" })) as any;
    if (res?.success && Array.isArray(res.data)) {
      userList.value = res.data.sort((a: UserItem, b: UserItem) =>
        (a.username || "").localeCompare(b.username || "", "zh-CN")
      );
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
  } finally {
    userLoading.value = false;
  }
};

const resetState = () => {
  userJobNum.value = "";
  selectedNodeId.value = undefined;
  selectedNodeName.value = "";
  metricsEdit.value = [];
  selectedUserId.value = undefined;
  selectedUserName.value = "";
};

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
      metricsEdit.value = props.recordData.metricList.map(m => ({
        ...m,
        status: m.status ?? 1
      }));
    } else if (props.mode === "add") {
      resetState();
    }

    if (!nodeConfigGroups.value.length) {
      await fetchNodeConfigGroups();
    }
    if (props.mode === "add" && !userList.value.length) {
      await fetchUserList();
    }
  }
);

const handleUserChange = (userId: number) => {
  const user = userList.value.find(u => u.id === userId);
  if (user) {
    selectedUserName.value = user.username;
    userJobNum.value = user.jobNum || "";
  }
};

const metricTypeText = (type: number) => {
  return type === 1 ? "定量考核" : String(type);
};

const handleNodeChange = (nodeId: number) => {
  const nodeConfig = nodeConfigGroups.value.find(item => item.nodeId === nodeId);
  selectedNodeName.value = nodeConfig?.nodeName || "";
  // 切换考核组后，指标全部更新为所选考核组的最新指标配置
  metricsEdit.value = buildMetricsByNode(nodeConfig);
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
        status: m.status ?? 1
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
                    :loading="userLoading"
                    style="width: 100%"
                    @change="handleUserChange"
                  >
                    <el-option
                      v-for="item in userList"
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
        </el-form>
      </div>

      <!-- 指标列表编辑 -->
      <div class="metrics-section">
        <h4 class="section-title">指标列表</h4>
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
          <el-table-column label="KPI描述" min-width="220">
            <template #default="{ row }">
              <span class="readonly-text">{{ row.kpiDepict }}</span>
            </template>
          </el-table-column>
          <el-table-column label="系数规则" min-width="220">
            <template #default="{ row }">
              <span class="readonly-text">{{ row.rate }}</span>
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
</style>
