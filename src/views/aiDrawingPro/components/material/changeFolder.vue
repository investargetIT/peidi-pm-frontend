<script setup lang="ts">
import { reactive, ref, nextTick, computed } from "vue";
import { getNameFromObjectName } from "../../utils/general/index";
import OnlineImg from "../../common/onlineImg.vue";
import { updateMaterial } from "@/api/aiDraw";
import { ElMessage, FormInstance } from "element-plus";

const props = defineProps({
  materialList: {
    type: Object,
    required: true
  },
  fetchMaterialPage: {
    type: Function,
    required: true
  }
});

const dialogVisible = ref(false);
const loading = ref(false);
const folderData = ref(null);

const initChangeFolderForm = (data: any) => {
  folderData.value = data;
  dialogVisible.value = true;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    // const folder = JSON.parse(folderData.value.type)?.folder;
    // if (folder) {
    //   ruleForm.folder = folder;
    // }
    try {
      const folder = JSON.parse(folderData.value.type)?.folder;
      ruleForm.folder = folder || "默认文件夹";
    } catch (e) {
      ruleForm.folder = "默认文件夹";
    }
  });
};

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  folder: ""
});

const submitForm = () => {
  loading.value = true;
  // console.log("ruleForm:", ruleForm, folderData.value);
  const type = JSON.parse(folderData.value.type);
  const temp = {
    ...folderData.value,
    type: JSON.stringify({
      ...type,
      folder: ruleForm.folder
    })
  };
  // console.log("submitForm:", temp);
  updateMaterial(temp)
    .then((res: any) => {
      if (res.code === 200) {
        ElMessage.success("更换文件夹成功");
        props.fetchMaterialPage();
        dialogVisible.value = false;
      } else {
        ElMessage.error("更换文件夹失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("更换文件夹失败:" + error.message);
    })
    .finally(() => {
      loading.value = false;
    });
};

// 计算属性 获取所有文件夹列表
const getFolderList = computed(() => {
  // 去props.materialList遍历所有数据，解析type字段是否有folder属性，有的话就添加到folderList中，要去重
  const folderList = [];
  for (const key in props.materialList) {
    for (let item of props.materialList[key]) {
      const folder = JSON.parse(item.type)?.folder;
      if (folder) {
        folderList.push(folder);
      }
    }
  }
  return [...new Set(folderList)].map(item => ({ label: item, value: item }));
});

defineExpose({
  initChangeFolderForm
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="更换文件夹"
      width="600"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form
        ref="ruleFormRef"
        style="max-width: 600px"
        :model="ruleForm"
        label-width="auto"
        :disabled="loading"
      >
        <el-form-item label="所属文件夹" prop="folder">
          <el-select
            v-model="ruleForm.folder"
            placeholder="请选择已有文件夹 或 输入新文件夹名称，不选择则为默认文件夹"
            allow-create
            filterable
            clearable
          >
            <el-option
              v-for="item in getFolderList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <div class="flex justify-end w-full">
            <el-button type="primary" @click="submitForm" :loading="loading">
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>
