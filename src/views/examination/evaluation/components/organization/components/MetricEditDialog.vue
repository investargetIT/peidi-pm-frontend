<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { ElForm, ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import type { MetricConfig } from "./types";

interface Props {
  visible: boolean;
  metric: MetricConfig | null;
  nodeId: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  success: [];
}>();

const dialogVisible = ref(false);

const formRef = ref<FormInstance>();
const formData = ref({
  targetName: "",
  calculationFormula: ">=",
  weight: null as number | null,
  score: null as number | null,
  kpiDepict: "",
  rate: ""
});

const rules: FormRules = {
  targetName: [{ required: true, message: "请输入指标名称", trigger: "blur" }]
};

const isEdit = computed(() => !!props.metric);

watch(
  () => props.visible,
  val => {
    dialogVisible.value = val;
    if (val) {
      if (props.metric) {
        formData.value = {
          targetName: props.metric.targetName,
          calculationFormula: props.metric.calculationFormula,
          weight: props.metric.weight,
          score: props.metric.score,
          kpiDepict: props.metric.kpiDepict || "",
          rate: props.metric.rate || ""
        };
      } else {
        formData.value = {
          targetName: "",
          calculationFormula: ">=",
          weight: null,
          score: null,
          kpiDepict: "",
          rate: ""
        };
      }
    }
  }
);

watch(dialogVisible, val => {
  if (!val) {
    emit("update:visible", false);
  }
});

const handleClose = () => {
  dialogVisible.value = false;
  formRef.value?.resetFields();
};

const handleSubmit = async () => {
  await formRef.value?.validate();
  try {
    if (props.metric) {
      // 检测 targetName 是否变化——变化会导致历史月度数据匹配不上
      const oldName = props.metric.targetName;
      const newName = formData.value.targetName;
      const isTargetNameChanged = oldName !== newName;

      if (isTargetNameChanged) {
        try {
          await ElMessageBox.confirm(
            `指标名称已由「${oldName}」改为「${newName}」。\n` +
              `此操作会导致历史月度数据中按原名称匹配的使用人「暂时无法关联」，` +
              `需要联系后端同步更新历史记录中的指标名称才能恢复。\n\n` +
              `确认要继续修改吗？`,
            "指标名称变更提示",
            {
              confirmButtonText: "确认修改",
              cancelButtonText: "取消",
              type: "warning"
            }
          );
        } catch (e) {
          // 用户取消
          return;
        }
      }

      // 更新
      const { updatePmKpiGroupNodeNodeConfigApi } = await import(
        "@/api/evaluation"
      );
      await updatePmKpiGroupNodeNodeConfigApi({
        ...props.metric,
        ...formData.value
      });
      ElMessage.success("更新指标成功");
    } else {
      // 新增
      const { addPmKpiGroupNodeNodeConfigApi } = await import(
        "@/api/evaluation"
      );
      await addPmKpiGroupNodeNodeConfigApi({
        nodeId: props.nodeId,
        ...formData.value
      });
      ElMessage.success("新增指标成功");
    }
    emit("success");
    handleClose();
  } catch (error) {
    console.error("操作失败", error);
    ElMessage.error("操作失败");
  }
};
</script>

<template>
  <el-dialog
    :title="isEdit ? '编辑指标' : '新增指标'"
    v-model="dialogVisible"
    @close="handleClose"
    width="480px"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="100px">
      <el-form-item label="指标名称" prop="targetName">
        <el-input v-model="formData.targetName" placeholder="请输入指标名称" />
      </el-form-item>
      <el-form-item label="计算公式" prop="calculationFormula">
        <el-select v-model="formData.calculationFormula" placeholder="请选择">
          <el-option label=">=" value=">=" />
          <el-option label="<=" value="<=" />
          <el-option label="=" value="=" />
          <el-option label=">" value=">" />
          <el-option label="<" value="<" />
        </el-select>
      </el-form-item>
      <el-form-item label="权重" prop="weight">
        <el-input-number v-model="formData.weight" :min="0" :max="100" />
      </el-form-item>
      <el-form-item label="分数" prop="score">
        <el-input-number v-model="formData.score" :min="0" />
      </el-form-item>
      <el-form-item label="比率" prop="rate">
        <el-input v-model="formData.rate" placeholder="请输入比率" />
      </el-form-item>
      <el-form-item label="KPI描述" prop="kpiDepict">
        <el-input
          v-model="formData.kpiDepict"
          type="textarea"
          :rows="3"
          placeholder="请输入KPI描述"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>
