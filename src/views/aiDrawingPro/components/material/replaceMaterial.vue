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
import { uploadDraw, updateMaterial } from "@/api/aiDraw";
import { imageCache } from "../../utils/imageCache";
import OnlineImg from "../../common/onlineImg.vue";

const props = defineProps({
  materialData: {
    type: Object,
    required: false,
    default: () => ({})
  },
  fetchMaterialPage: {
    type: Function,
    required: true
  }
});

const dialogVisible = ref(false);
const loading = ref(false);

const initDetailForm = material => {
  // console.log("替换素材图片数据:", material);

  dialogVisible.value = true;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    ruleForm.imageUrl = "";
    uploadRef.value?.clearFiles();

    ruleForm.id = material.id;
    const fileNameWithExt =
      material.objectName.split("/").pop() || material.objectName;
    ruleForm.name = fileNameWithExt.split(".")[0];
    ruleForm.type = material.type;
    ruleForm.objectName = material.objectName;
  });
};

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  id: "",
  name: "",
  type: "",
  objectName: "",
  imageUrl: "",
  image: null
});

const rules = reactive<FormRules>({
  image: [{ required: true, message: "请上传新图片", trigger: "change" }]
});

const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;

  try {
    await formEl.validate();

    loading.value = true;

    const formData = new FormData();
    const originalName = ruleForm.image.name;
    const extension = originalName.includes(".")
      ? originalName.substring(originalName.lastIndexOf("."))
      : "";

    const newFile = new File([ruleForm.image], ruleForm.name + extension, {
      type: ruleForm.image.type,
      lastModified: ruleForm.image.lastModified
    });

    formData.append("file", newFile);

    const uploadRes: any = await uploadDraw(formData);

    if (uploadRes.code !== 200) {
      throw new Error(uploadRes.msg || "图片上传失败");
    }

    ruleForm.imageUrl = uploadRes.data;

    const oldObjectName = ruleForm.objectName;

    const updateRes: any = await updateMaterial({
      id: ruleForm.id,
      objectName: ruleForm.imageUrl,
      type: JSON.stringify({
        ...JSON.parse(ruleForm.type),
        updateTime: Date.now()
      })
    });

    if (updateRes.code !== 200) {
      throw new Error(updateRes.msg || "更新素材失败");
    }

    if (oldObjectName) {
      await imageCache.deleteImage(oldObjectName);
    }

    ElMessage.success("素材图片更新成功");

    await nextTick();
    props.fetchMaterialPage();

    dialogVisible.value = false;
  } catch (error: any) {
    ElMessage.error(error.message || "操作失败");
  } finally {
    loading.value = false;
  }
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
      :title="`替换【${ruleForm.name || '素材'}】素材图片`"
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
        <el-form-item label="新图片" prop="image">
          <el-upload
            ref="uploadRef"
            action=""
            :auto-upload="false"
            list-type="picture-card"
            :limit="1"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            class="peidi-aiDrawingPro-material-updateForm-upload"
          >
            <template #trigger>
              <el-icon><Plus /></el-icon>
            </template>

            <template #tip>
              <div class="el-upload__tip !text-red-500">
                限制上传1张图片，新图片会覆盖旧图片，大小不超过50MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <div class="flex justify-end w-full">
            <el-button
              type="primary"
              :loading="loading"
              @click="submitForm(ruleFormRef)"
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
.peidi-aiDrawingPro-material-updateForm-upload {
  :deep(.el-upload-list__item-preview) {
    display: none !important;
  }
  :deep(.el-upload-list__item-delete) {
    margin-left: 0;
  }
}
</style>
