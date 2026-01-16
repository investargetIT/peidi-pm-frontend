<script setup lang="ts">
import { getToken } from "@/utils/auth";
import { ElMessage, UploadFile, UploadFiles } from "element-plus";

const props = defineProps({
  title: {
    type: String,
    default: ""
  },
  requestUrl: {
    type: String,
    required: true
  },
  successCallback: {
    type: Function,
    default: () => {}
  }
});

// 文件上传前的验证
const beforeUpload = (file: File) => {
  // 检查文件类型
  const isExcel =
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls");

  if (!isExcel) {
    ElMessage.error("只能上传Excel文件（.xlsx 或 .xls 格式）");
    return false;
  }

  // 检查文件大小（限制为10MB）
  const isLt10M = file.size / 1024 / 1024 < 50;
  if (!isLt10M) {
    ElMessage.error("文件大小不能超过50MB");
    return false;
  }

  return true;
};

const handleSuccess = () => {
  ElMessage.success("文件上传成功");
  props.successCallback();
};

const handleError = (
  error: Error,
  uploadFile: UploadFile,
  uploadFiles: UploadFiles
) => {
  ElMessage.error(`文件上传失败: ${error.message}`);
};
</script>

<template>
  <div class="mb-[16px]">
    <el-card shadow="never" style="border-radius: 10px">
      <div>{{ title }}</div>
      <el-upload
        drag
        :action="requestUrl"
        :headers="{ Authorization: getToken().accessToken }"
        :limit="1"
        accept=".xlsx,.xls"
        :before-upload="beforeUpload"
        :on-success="handleSuccess"
        :on-error="handleError"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">拖放文件到这里，或 <em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">
            请上传Excel文件（.xlsx 或 .xls 格式），且文件大小不超过50MB
          </div>
        </template>
      </el-upload>
    </el-card>
  </div>
</template>
