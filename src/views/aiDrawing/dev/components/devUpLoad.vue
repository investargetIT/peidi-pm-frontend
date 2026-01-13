<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { Close } from "@element-plus/icons-vue";
import { ElMessage, ElLoading } from "element-plus";
import { uploadDraw, getDownloadUrl } from "@/api/aiDraw";
import OnlineImage from "../../excelTable/components/onlineImage/index.vue";

interface Props {
  modelValue?: string[] | null;
  limit?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  limit: 5
});

const emit = defineEmits<{
  "update:modelValue": [value: string[] | null];
}>();

const uploadRef = ref();
const fileList = ref<any[]>([]);
const isUpdating = ref(false); // 防止循环更新的标志
const uploading = ref(false); // 上传状态

// 生成唯一ID
const generateUID = () => Date.now() + Math.random().toString(36).substr(2, 9);

// 上传图片到服务器
const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response: any = await uploadDraw(formData);
    if (response.data && response.success) {
      return response.data;
      // 获取文件url
      // const downloadUrlResponse: any = await getDownloadUrl({
      //   objectName: response.data
      // });
      // if (downloadUrlResponse.data && downloadUrlResponse.success) {
      //   return downloadUrlResponse.data;
      // } else {
      //   throw new Error(downloadUrlResponse.msg || "获取文件url失败");
      // }
    } else {
      throw new Error(response.msg || "上传失败");
    }
  } catch (error: any) {
    console.error("上传失败:", error);
    throw new Error(error.message || "上传失败");
  }
};

// 处理文件选择
const handleChange = async (file: any, uploadFileList: any[]) => {
  if (file.raw) {
    uploading.value = true;
    const loadingInstance = ElLoading.service({
      lock: true,
      text: "图片上传中...",
      background: "rgba(0, 0, 0, 0.7)"
    });

    try {
      // 上传图片到服务器
      const imageUrl = await uploadImage(file.raw);

      // 更新文件列表状态
      file.status = "success";
      file.url = imageUrl;

      // 更新modelValue
      const currentImages = props.modelValue ? [...props.modelValue] : [];
      currentImages.push(imageUrl);
      emit("update:modelValue", currentImages);

      ElMessage.success("图片上传成功");
    } catch (error: any) {
      console.error("上传失败:", error);
      file.status = "fail";
      ElMessage.error(`上传失败: ${error.message}`);
    } finally {
      loadingInstance.close();
      uploading.value = false;
    }
  }
};

// 处理文件移除 - 双向联动
const handleRemove = (file: any, uploadFileList: any[]) => {
  if (props.modelValue && !isUpdating.value) {
    isUpdating.value = true;
    const currentImages = [...props.modelValue];
    const index = currentImages.findIndex((_, i) => {
      const fileItem = fileList.value[i];
      return fileItem && fileItem.uid === file.uid;
    });

    if (index > -1) {
      currentImages.splice(index, 1);
      emit(
        "update:modelValue",
        currentImages.length > 0 ? currentImages : null
      );
    }

    nextTick(() => {
      isUpdating.value = false;
    });
  }
};

// 处理预览图片的删除 - 双向联动
const handlePreviewRemove = (index: number) => {
  if (props.modelValue && fileList.value[index] && !isUpdating.value) {
    isUpdating.value = true;

    // 从 modelValue 中移除对应的图片
    const currentImages = [...props.modelValue];
    currentImages.splice(index, 1);
    emit("update:modelValue", currentImages.length > 0 ? currentImages : null);

    // 同时从 el-upload 的文件列表中移除对应的文件
    if (fileList.value[index]) {
      fileList.value.splice(index, 1);
    }

    nextTick(() => {
      isUpdating.value = false;
    });
  }
};

// 监听外部值变化，保持双向同步
watch(
  () => props.modelValue,
  newVal => {
    if (!isUpdating.value) {
      isUpdating.value = true;

      if (!newVal || newVal.length === 0) {
        fileList.value = [];
      } else {
        // 确保 fileList 与 modelValue 保持同步，使用唯一UID
        fileList.value = newVal.map((image, index) => {
          // 如果已有对应文件，保持原有UID，否则生成新UID
          const existingFile = fileList.value[index];
          return {
            uid: existingFile?.uid || generateUID(),
            name: `image-${index}.jpg`,
            url: image,
            status: "success"
          };
        });
      }

      nextTick(() => {
        isUpdating.value = false;
      });
    }
  },
  { deep: true, immediate: true }
);

// 限制上传数量
const beforeUpload = (file: any) => {
  const currentCount = fileList.value.length;
  if (currentCount >= props.limit) {
    ElMessage.warning(`最多只能上传${props.limit}张图片`);
    return false;
  }

  // 检查文件类型
  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    ElMessage.warning("只能上传图片文件");
    return false;
  }

  // 检查文件大小（限制为50MB）
  const isLt50M = file.size / 1024 / 1024 < 50;
  if (!isLt50M) {
    ElMessage.warning("图片大小不能超过50MB");
    return false;
  }

  return true;
};

// 处理超出数量限制
const handleExceed = (files: any[], uploadFileList: any[]) => {
  ElMessage.warning(`最多只能上传${props.limit}张图片`);
};
</script>

<template>
  <div>
    <el-upload
      ref="uploadRef"
      v-model:file-list="fileList"
      action=""
      :auto-upload="false"
      :on-change="handleChange"
      :on-remove="handleRemove"
      :on-exceed="handleExceed"
      :before-upload="beforeUpload"
      :show-file-list="false"
      :disabled="uploading"
      accept="image/*"
      multiple
      :limit="limit"
    >
      <template #trigger>
        <el-button type="primary" size="small" :disabled="uploading">
          {{ uploading ? "上传中..." : "选择图片" }}
        </el-button>
      </template>
      <template #tip>
        <div class="el-upload__tip">最多上传{{ limit }}张</div>
      </template>
    </el-upload>

    <!-- 预览图片列表 -->
    <div v-if="modelValue && modelValue.length > 0" class="mt-4">
      <div class="text-[12px] text-gray-500">
        预览 ({{ modelValue.length }}/{{ limit }})
      </div>
      <div class="flex flex-wrap gap-2">
        <div v-for="(image, index) in modelValue" :key="index" class="relative">
          <!-- <el-image
            :src="image"
            style="width: 80px; height: 80px; object-fit: cover"
            :preview-src-list="modelValue"
            :initial-index="index"
            preview-teleported
          /> -->
          <OnlineImage :url="image" />
          <div class="absolute top-0 right-0">
            <el-button
              size="small"
              type="danger"
              :icon="Close"
              circle
              @click="handlePreviewRemove(index)"
              :disabled="uploading"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
