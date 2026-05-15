<script setup lang="ts">
import { ref, reactive, watch, toRefs } from "vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import {
  addPmKpiMetricUserApi,
  updatePmKpiMetricUserApi,
  getUserListApi
} from "@/api/evaluation";

interface FormData {
  id?: number;
  userId?: number;
  jobNum?: string;
  metricConfigId?: number;
  username?: string;
  metricType?: number;
  targetName?: string;
  metricId?: string;
  kpiDepict?: string;
  rate?: string;
}

interface Props {
  modelValue: boolean;
  type: "add" | "edit";
  formData?: FormData;
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "success"): void;
}

const props = withDefaults(defineProps<Props>(), {
  formData: () => ({})
});

const emit = defineEmits<Emits>();

const formLoading = ref(false);
const formRef = ref<FormInstance>();
const userList = ref<any[]>([]);

const detailForm = reactive({
  id: null as number | null,
  userId: null as number | null,
  jobNum: "",
  metricType: 1,
  metricId: "",
  metricConfigId: null as number | null,
  kpiDepict: "",
  rate: ""
});

const detailRules = reactive<FormRules>({
  userId: [{ required: true, message: "请选择用户", trigger: "change" }],
  jobNum: [{ required: true, message: "请输入工号", trigger: "blur" }],
  metricType: [
    { required: true, message: "请选择指标类型", trigger: "change" }
  ],
  metricId: [
    { required: true, message: "请输入指标编号", trigger: "blur" },
    { min: 18, max: 18, message: "指标编号长度必须为18位", trigger: "blur" }
  ]
});

const fetchUserList = async () => {
  try {
    const res = (await getUserListApi({ name: "" })) as any;
    if (res.success && res.data) {
      userList.value = res.data;
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
  }
};

watch(
  () => props.modelValue,
  newVal => {
    if (newVal) {
      fetchUserList();
      if (props.type === "edit" && props.formData) {
        detailForm.id = props.formData.id || null;
        detailForm.userId = props.formData.userId || null;
        detailForm.jobNum = props.formData.jobNum || "";
        detailForm.metricType = props.formData.metricType || 1;
        detailForm.metricId = props.formData.metricId || "";
        detailForm.metricConfigId = props.formData.metricConfigId || null;
        detailForm.kpiDepict = props.formData.kpiDepict || "";
        detailForm.rate = props.formData.rate || "";
      } else {
        resetForm();
      }
    }
  }
);

const handleUserChange = (userId: number) => {
  const selectedUser = userList.value.find(u => u.id === userId);
  if (selectedUser) {
    detailForm.jobNum = selectedUser.jobNum || "";
  }
};

const resetForm = () => {
  detailForm.id = null;
  detailForm.userId = null;
  detailForm.jobNum = "";
  detailForm.metricType = 1;
  detailForm.metricId = "";
  detailForm.metricConfigId = null;
  detailForm.kpiDepict = "";
  detailForm.rate = "";
  formRef.value?.clearValidate();
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (valid) {
      formLoading.value = true;
      try {
        const selectedUser = userList.value.find(
          u => u.id === detailForm.userId
        );
        const requestData = {
          id: detailForm.id,
          userId: detailForm.userId,
          jobNum: selectedUser?.jobNum || detailForm.jobNum,
          metricType: detailForm.metricType,
          metricId: detailForm.metricId,
          metricConfigId: detailForm.metricConfigId,
          kpiDepict: detailForm.kpiDepict,
          rate: detailForm.rate
        };

        if (props.type === "add") {
          await addPmKpiMetricUserApi(requestData);
          ElMessage.success("新增成功");
        } else {
          await updatePmKpiMetricUserApi(requestData);
          ElMessage.success("修改成功");
        }

        handleClose();
        emit("success");
      } catch (error) {
        console.error("操作失败", error);
        ElMessage.error("操作失败");
      } finally {
        formLoading.value = false;
      }
    }
  });
};

const handleClose = () => {
  emit("update:modelValue", false);
  resetForm();
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="type === 'add' ? '新增KPI指标用户' : '修改KPI指标用户'"
    width="600px"
    :close-on-click-modal="false"
    append-to-body
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="detailForm"
      :rules="detailRules"
      label-width="120px"
    >
      <el-form-item label="用户" prop="userId">
        <el-select
          v-model="detailForm.userId"
          placeholder="请选择用户"
          filterable
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
      </el-form-item>
      <el-form-item label="工号" prop="jobNum">
        <el-input v-model="detailForm.jobNum" placeholder="请输入工号" />
      </el-form-item>
      <el-form-item label="指标编号" prop="metricId">
        <el-input
          v-model="detailForm.metricId"
          placeholder="请输入指标编号"
          show-word-limit
          maxlength="18"
        />
      </el-form-item>
      <el-form-item label="指标类型" prop="metricType">
        <el-select
          v-model="detailForm.metricType"
          placeholder="请选择指标类型"
          style="width: 100%"
        >
          <el-option label="定量考核" :value="1" />
        </el-select>
      </el-form-item>
      <el-form-item label="指标名称" prop="metricConfigId">
        <el-select
          v-model="detailForm.metricConfigId"
          placeholder="请选择指标名称"
          style="width: 100%"
        >
          <el-option label="1" :value="1" />
        </el-select>
      </el-form-item>

      <el-form-item label="KPI描述">
        <el-input
          v-model="detailForm.kpiDepict"
          type="textarea"
          :rows="3"
          placeholder="请输入KPI描述"
        />
      </el-form-item>
      <el-form-item label="系数规则">
        <el-input
          v-model="detailForm.rate"
          type="textarea"
          :rows="3"
          placeholder="请输入系数规则"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="formLoading">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
