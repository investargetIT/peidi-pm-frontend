<script setup lang="ts">
import { reactive, ref, nextTick } from "vue";
import {
  ElMessage,
  FormInstance,
  FormRules,
  genFileId,
  UploadInstance,
  UploadProps,
  UploadRawFile
} from "element-plus";
import { MATERIAL_LIBRARY_TABS } from "../../config/material";
import { getNameFromObjectName } from "../../utils/general/index";
import { uploadDraw, newMaterial } from "@/api/aiDraw";

const TYPE_OPTIONS = MATERIAL_LIBRARY_TABS.map(item => ({
  label: item.label,
  value: item.name
}));

const props = defineProps({
  materialList: {
    type: Object,
    required: true
  },
  fetchMaterialPage: {
    type: Function,
    required: true
  },
  selectedRadio: {
    type: String,
    required: true
  }
});

const dialogVisible = ref(false);
const loading = ref(false);

const initDetailForm = () => {
  dialogVisible.value = true;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    ruleForm.imageUrl = "";
    uploadRef.value?.clearFiles();

    if (props.selectedRadio) {
      ruleForm.type = props.selectedRadio;
    }
  });
};

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  name: "",
  type: "",
  imageUrl: "",
  image: null
});
const rules = reactive<FormRules>({
  name: [{ required: true, message: "请输入素材名称", trigger: "blur" }],
  type: [{ required: true, message: "请选择素材类型", trigger: "change" }],
  image: [{ required: true, message: "请上传图片", trigger: "change" }]
});

const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      loading.value = true;
      // console.log("提交!", ruleForm);

      // 首先检查图片名称是否存在
      for (const key in props.materialList) {
        for (let item of props.materialList[key]) {
          const pname = getNameFromObjectName(item.objectName);
          if (pname === ruleForm.name) {
            ElMessage.error("素材名称已存在");
            loading.value = false;
            return;
          }
        }
      }
      // 上传图片到服务器 重命名图片名字为 ruleForm.name
      const formData = new FormData();
      // 获取文件扩展名
      const originalName = ruleForm.image.name;
      const extension = originalName.includes(".")
        ? originalName.substring(originalName.lastIndexOf("."))
        : "";

      // 创建新的File对象，保持原文件的类型
      const newFile = new File([ruleForm.image], ruleForm.name + extension, {
        type: ruleForm.image.type,
        lastModified: ruleForm.image.lastModified
      });

      formData.append("file", newFile);

      // 上传图片到服务器
      uploadDraw(formData)
        .then((res: any) => {
          if (res.code === 200) {
            ruleForm.imageUrl = res.data;

            newMaterial({
              objectName: ruleForm.imageUrl,
              type: JSON.stringify({ mtype: ruleForm.type })
            })
              .then((res: any) => {
                if (res.code === 200) {
                  ElMessage.success("素材添加成功");
                  props.fetchMaterialPage();
                  dialogVisible.value = false;
                } else {
                  ElMessage.error("添加素材失败:" + res.msg);
                }
              })
              .catch(error => {
                ElMessage.error("添加素材失败:" + error.message);
              })
              .finally(() => {
                loading.value = false;
              });
          } else {
            ElMessage.error("图片上传失败:" + res.msg);
            loading.value = false;
          }
        })
        .catch(error => {
          ElMessage.error("图片上传失败:" + error.message);
          loading.value = false;
        });
    } else {
      // console.log("error submit!", fields);
    }
  });
};

const uploadRef = ref<UploadInstance>();
const handleExceed: UploadProps["onExceed"] = files => {
  uploadRef.value!.clearFiles();
  const file = files[0] as UploadRawFile;
  file.uid = genFileId();
  uploadRef.value!.handleStart(file);
};
const handleChange: UploadProps["onChange"] = (file, fileList) => {
  let fileinfo = fileList[0];
  ruleForm.image = fileinfo.raw;
};

defineExpose({
  initDetailForm
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="素材详情"
      width="600"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form
        ref="ruleFormRef"
        style="max-width: 600px"
        :model="ruleForm"
        :rules="rules"
        label-width="auto"
        :disabled="loading"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="ruleForm.name" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="ruleForm.type" placeholder="请选择">
            <el-option
              v-for="item in TYPE_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="图片" prop="image">
          <el-upload
            ref="uploadRef"
            action=""
            :auto-upload="false"
            list-type="picture-card"
            :limit="1"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            class="peidi-aiDrawingPro-material-detailForm-upload"
          >
            <template #trigger>
              <el-icon><Plus /></el-icon>
            </template>

            <template #tip>
              <div class="el-upload__tip">
                限制上传1张图片，新图片会覆盖旧图片，大小不超过50MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <div class="flex justify-end w-full">
            <el-button
              type="primary"
              @click="submitForm(ruleFormRef)"
              :loading="loading"
            >
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-material-detailForm-upload {
  :deep(.el-upload-list__item-preview) {
    display: none !important;
  }
  :deep(.el-upload-list__item-delete) {
    margin-left: 0;
  }
}
</style>
