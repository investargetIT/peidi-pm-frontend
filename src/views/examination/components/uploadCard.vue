<script setup lang="ts">
import { ElMessage, UploadRequestOptions } from "element-plus";
import { http } from "@/utils/http";

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
  },
  idx: {
    type: String,
    default: "1"
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

// 生成时间戳（年月日时分）
const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}`;
};

// 重命名文件
const renameFile = (file: File) => {
  const timestamp = generateTimestamp();
  const lastDotIndex = file.name.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${file.name}${timestamp}`;
  }
  const name = file.name.substring(0, lastDotIndex);
  const extension = file.name.substring(lastDotIndex);
  return `${name}${timestamp}${extension}`;
};

// 创建符合UploadAjaxError类型的错误（使用类型断言）
const createUploadError = (message: string) => {
  return {
    name: "UploadError",
    message,
    status: 500,
    method: "post",
    url: props.requestUrl
  } as any;
};

// 自定义上传方法
const customUpload = async (options: UploadRequestOptions) => {
  const { file, onSuccess, onError } = options;

  // 检查文件类型
  const isExcel =
    file.type === "application/vnd.ms-excel" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls");

  if (!isExcel) {
    ElMessage.error("只能上传Excel文件（.xlsx 或 .xls 格式）");
    onError?.(createUploadError("文件类型错误"));
    return false;
  }

  // 检查文件大小（限制为50MB）
  const isLt50M = file.size / 1024 / 1024 < 50;
  if (!isLt50M) {
    ElMessage.error("文件大小不能超过50MB");
    onError?.(createUploadError("文件大小超过限制"));
    return false;
  }

  try {
    // 创建FormData
    const formData = new FormData();
    const newFileName = renameFile(file as File);

    // 创建新的File对象，重命名文件
    const renamedFile = new File([file], newFileName, { type: file.type });
    formData.append("file", renamedFile);

    // 发送请求（使用项目封装的http）
    const response: any = await http.request("post", props.requestUrl, {
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    // 处理响应
    if (response.code === 200) {
      ElMessage.success("文件上传成功");
      onSuccess?.(response);
      props.successCallback();
    } else {
      ElMessage.error(`文件上传失败: ${response.msg}`);
      onError?.(createUploadError(response.msg));
    }
  } catch (error: any) {
    const errorMessage = error.message || "文件上传失败";
    ElMessage.error(`文件上传失败: ${errorMessage}`);
    onError?.(createUploadError(errorMessage));
  }
};
</script>

<template>
  <div class="mb-[16px]">
    <el-card shadow="never" style="border-radius: 10px" class="">
      <div class="numCircle">{{ idx }}</div>
      <div>{{ title }}</div>
      <el-upload
        drag
        action="#"
        :http-request="customUpload"
        :limit="1"
        accept=".xlsx,.xls"
        :disabled="disabled"
        :auto-upload="true"
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

<style lang="scss" scoped>
.numCircle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #e7e7e7;
  color: #409eff;
  font-size: 18px;
  margin-bottom: 6px;
}
</style>
