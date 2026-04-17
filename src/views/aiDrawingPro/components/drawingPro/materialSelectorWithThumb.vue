<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { Picture } from "@element-plus/icons-vue";
import { getNameFromObjectName } from "../../utils/general";
import { imageCache } from "../../utils/imageCache";
import { blobManager } from "../../utils/blobManager";
import { downloadFile } from "@/api/aiDraw";

interface MaterialItem {
  id: string;
  objectName: string;
  [key: string]: any;
}

interface Props {
  modelValue?: string;
  materialList?: MaterialItem[];
  placeholder?: string;
  cacheKey?: string;
}

interface Emits {
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  materialList: () => [],
  placeholder: "请选择素材",
  cacheKey: "material_thumbnail"
});

const emit = defineEmits<Emits>();

const selectedValue = ref<string>(props.modelValue);
const thumbnailUrls = ref<Record<string, string>>({});
const loadingThumbnails = ref<Set<string>>(new Set());

watch(
  () => props.modelValue,
  newValue => {
    selectedValue.value = newValue;
  }
);

const handleSelectChange = (value: string) => {
  emit("update:modelValue", value);
  emit("change", value);
};

const loadThumbnail = async (objectName: string) => {
  if (!objectName || loadingThumbnails.value.has(objectName)) {
    return;
  }

  if (thumbnailUrls.value[objectName]) {
    return;
  }

  loadingThumbnails.value.add(objectName);

  try {
    const cacheId = `${props.cacheKey}:${objectName}`;

    let blob: Blob | null = await imageCache.getImageBlob(
      cacheId,
      "compressedBlob"
    );

    if (!blob) {
      const response: any = await downloadFile({ objectName });

      if (response) {
        blob = response;

        const compressedBlob = await compressImage(blob, 0.3);

        await imageCache.storeImage(cacheId, blob, compressedBlob);
      }
    }

    if (blob) {
      const url = blobManager.createBlobURL(cacheId, blob);
      thumbnailUrls.value[objectName] = url;
    }
  } catch (error) {
    console.error("加载缩略图失败:", objectName, error);
  } finally {
    loadingThumbnails.value.delete(objectName);
  }
};

const compressImage = (blob: Blob, quality: number = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      const maxWidth = 200;
      const maxHeight = 200;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = blob.type === "image/png";
        const outputType = isPng ? "image/png" : "image/jpeg";
        const outputQuality = isPng ? 1 : quality;

        canvas.toBlob(
          compressedBlob => {
            if (compressedBlob) {
              resolve(compressedBlob);
            } else {
              resolve(blob);
            }
          },
          outputType,
          outputQuality
        );
      } else {
        resolve(blob);
      }
    };

    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };

    img.src = URL.createObjectURL(blob);
  });
};

onMounted(() => {
  props.materialList.forEach(item => {
    if (item.objectName) {
      loadThumbnail(item.objectName);
    }
  });
});

onUnmounted(() => {
  Object.keys(thumbnailUrls.value).forEach(key => {
    const url = thumbnailUrls.value[key];
    if (url) {
      URL.revokeObjectURL(url);
    }
  });
});
</script>

<template>
  <div class="material-selector">
    <el-select
      v-model="selectedValue"
      :placeholder="placeholder"
      filterable
      @change="handleSelectChange"
      class="w-full"
    >
      <el-option
        v-for="matItem in materialList"
        :key="matItem.id"
        :label="getNameFromObjectName(matItem.objectName)"
        :value="matItem.objectName"
      >
        <div class="material-option">
          <span class="material-name">{{
            getNameFromObjectName(matItem.objectName)
          }}</span>
          <img
            v-if="thumbnailUrls[matItem.objectName]"
            :src="thumbnailUrls[matItem.objectName]"
            class="material-thumbnail"
            loading="lazy"
          />
          <div v-else class="material-thumbnail-placeholder">
            <el-icon><Picture /></el-icon>
          </div>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<style lang="scss" scoped>
.material-selector {
  width: 100%;
}

.material-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.material-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.material-thumbnail-placeholder {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  color: #c0c4cc;
  font-size: 20px;
  flex-shrink: 0;
}

:deep(.el-select-dropdown__item) {
  padding: 8px 12px;
  height: 50px !important;
  line-height: 50px !important;
}

:deep(.el-select-dropdown__item.selected) {
  font-weight: normal;
}
</style>

<style>
.el-select-dropdown__item {
  height: auto;
  line-height: auto;
}
</style>
