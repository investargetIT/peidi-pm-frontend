<script lang="ts" setup>
import { ref, watch, computed } from "vue";
import { ElForm, ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import type { TreeNode } from "./types";

interface Props {
  visible: boolean;
  node: TreeNode | null;
  parentNode: TreeNode | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  success: [];
}>();

const dialogVisible = ref(false);

const formRef = ref<FormInstance>();
const formData = ref({
  nodeName: "",
  nodeType: "department" as "department" | "position" | "examination_group",
  sortNo: 1,
  status: 1,
  targetType: ""
});

const rules: FormRules = {
  nodeName: [{ required: true, message: "请输入节点名称", trigger: "blur" }],
  sortNo: [{ required: true, message: "请输入排序号", trigger: "blur" }]
};

const isEdit = computed(() => !!props.node);

const allowedNodeTypes = computed(() => {
  if (isEdit.value) {
    return ["department", "position", "examination_group"];
  }

  if (!props.parentNode) {
    return ["department"];
  }

  const parentType = props.parentNode.nodeType;

  if (parentType === "department") {
    return ["department", "position"];
  } else if (parentType === "position") {
    return ["position", "examination_group"];
  } else if (parentType === "examination_group") {
    return ["examination_group"];
  }

  return ["department", "position", "examination_group"];
});

const getNodeTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    department: "部门",
    position: "岗位",
    examination_group: "考核组"
  };
  return map[type] || type;
};

watch(
  () => props.visible,
  val => {
    dialogVisible.value = val;
    if (val) {
      if (props.node) {
        formData.value = {
          nodeName: props.node.nodeName,
          nodeType: props.node.nodeType,
          sortNo: props.node.sortNo,
          status: props.node.status,
          targetType: props.node.targetType || ""
        };
      } else if (props.parentNode) {
        const defaultType = getDefaultNodeType(props.parentNode.nodeType);
        formData.value = {
          nodeName: "",
          nodeType: defaultType as
            | "department"
            | "position"
            | "examination_group",
          sortNo: (props.parentNode.children?.length || 0) + 1,
          status: 1,
          targetType: ""
        };
      } else {
        formData.value = {
          nodeName: "",
          nodeType: "department",
          sortNo: 1,
          status: 1,
          targetType: ""
        };
      }
    }
  }
);

const getDefaultNodeType = (parentType: string): string => {
  if (parentType === "department") {
    return "department";
  } else if (parentType === "position") {
    return "position";
  } else if (parentType === "examination_group") {
    return "examination_group";
  }
  return "department";
};

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
    if (props.node) {
      const { updatePmKpiGroupNodeApi } = await import("@/api/evaluation");
      await updatePmKpiGroupNodeApi({
        ...props.node,
        ...formData.value
      });
      ElMessage.success("更新节点成功");
    } else if (props.parentNode) {
      const { addPmKpiGroupNodeApi } = await import("@/api/evaluation");
      await addPmKpiGroupNodeApi({
        nodeName: formData.value.nodeName,
        nodeType: formData.value.nodeType,
        parentId: props.parentNode.id,
        sortNo: formData.value.sortNo,
        status: formData.value.status,
        targetType: formData.value.targetType || undefined,
        treeLevel: props.parentNode.treeLevel + 1
      });
      ElMessage.success("新增节点成功");
    } else {
      const { addPmKpiGroupNodeApi } = await import("@/api/evaluation");
      await addPmKpiGroupNodeApi({
        nodeName: formData.value.nodeName,
        nodeType: formData.value.nodeType,
        parentId: 0,
        sortNo: formData.value.sortNo,
        status: formData.value.status,
        targetType: formData.value.targetType || undefined,
        treeLevel: 1
      });
      ElMessage.success("新增根节点成功");
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
    :title="isEdit ? '编辑节点' : '新增节点'"
    v-model="dialogVisible"
    @close="handleClose"
    width="480px"
  >
    <el-form ref="formRef" :model="formData" :rules="rules" label-width="80px">
      <el-form-item label="节点名称" prop="nodeName">
        <el-input v-model="formData.nodeName" placeholder="请输入节点名称" />
      </el-form-item>
      <el-form-item label="节点类型" prop="nodeType">
        <el-select
          v-model="formData.nodeType"
          :disabled="isEdit"
          placeholder="请选择节点类型"
        >
          <el-option
            v-for="type in allowedNodeTypes"
            :key="type"
            :label="getNodeTypeLabel(type)"
            :value="type"
          />
        </el-select>
        <div v-if="!isEdit && parentNode" class="type-hint">
          <el-text size="small" type="info">
            父节点：{{ getNodeTypeLabel(parentNode.nodeType) }} -
            {{ parentNode.nodeName }}
          </el-text>
        </div>
      </el-form-item>
      <el-form-item label="排序号" prop="sortNo">
        <el-input-number v-model="formData.sortNo" :min="1" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio :label="1">启用</el-radio>
          <el-radio :label="0">禁用</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.type-hint {
  margin-top: 8px;
}
</style>
