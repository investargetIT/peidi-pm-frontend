<script setup lang="ts">
import { ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

interface Props {
  modelValue?: string[] | null
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  limit: 5
})

const emit = defineEmits<{
  'update:modelValue': [value: string[] | null]
}>()

const uploadRef = ref()
const fileList = ref<any[]>([])

// 将文件转换为 base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

// 处理文件选择
const handleChange = async (file: any, fileList: any[]) => {
  if (file.raw) {
    try {
      const base64 = await fileToBase64(file.raw)
      const currentImages = props.modelValue ? [...props.modelValue] : []
      currentImages.push(base64)
      emit('update:modelValue', currentImages)
    } catch (error) {
      console.error('文件转换失败:', error)
    }
  }
}

// 处理文件移除
const handleRemove = (file: any, fileList: any[]) => {
  if (props.modelValue) {
    const currentImages = [...props.modelValue]
    const index = fileList.findIndex(f => f.uid === file.uid)
    if (index > -1) {
      currentImages.splice(index, 1)
      emit('update:modelValue', currentImages.length > 0 ? currentImages : null)
    }
  }
}

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    fileList.value = []
  }
}, { deep: true })

// 限制上传数量
const beforeUpload = (file: any) => {
  const currentCount = fileList.value.length;
  if (currentCount >= props.limit) {
    console.warn(`最多只能上传${props.limit}张图片`)
    return false
  }
  return true
}
</script>

<template>
  <div>
    <el-upload ref="uploadRef" v-model:file-list="fileList" action="" :auto-upload="false" :on-change="handleChange"
      :on-remove="handleRemove" :before-upload="beforeUpload" :show-file-list="true" accept="image/*" multiple
      :limit="limit">
      <template #trigger>
        <el-button type="primary">选择图片</el-button>
      </template>
      <template #tip>
        <div class="el-upload__tip">
          支持 jpg、png 等图片格式，最多可上传{{ limit }}张图片
        </div>
      </template>
    </el-upload>

    <!-- 预览图片列表 -->
    <div v-if="modelValue && modelValue.length > 0" class="mt-4">
      <div class="text-sm text-gray-500 mb-2">图片预览 ({{ modelValue.length }}/{{ limit }})</div>
      <div class="flex flex-wrap gap-2">
        <div v-for="(image, index) in modelValue" :key="index" class="relative">
          <el-image :src="image" style="width: 80px; height: 80px; object-fit: cover;" :preview-src-list="modelValue"
            :initial-index="index" />
          <div class="absolute top-0 right-0">
            <el-button size="small" type="danger" :icon="Close" circle
              @click="handleRemove(fileList[index], fileList)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>