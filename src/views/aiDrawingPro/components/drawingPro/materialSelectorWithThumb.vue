<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, h } from "vue";
import { Picture } from "@element-plus/icons-vue";
import { getNameFromObjectName } from "../../utils/general";
import { imageCache } from "../../utils/imageCache";
import { blobManager } from "../../utils/blobManager";
import { downloadFile } from "@/api/aiDraw";

interface MaterialItem {
  id: string;
  objectName: string;
  type?: string;
  [key: string]: any;
}

interface Props {
  modelValue?: string;
  materialList?: MaterialItem[];
  placeholder?: string;
  cacheKey?: string;
  disabled?: boolean;
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

interface TreeNode {
  value: string;
  label: string;
  children?: TreeNode[];
  data?: MaterialItem;
  isLeaf?: boolean;
}

const materialTree = computed<TreeNode[]>(() => {
  const folderMap = new Map<string, TreeNode>();

  props.materialList.forEach(item => {
    let folderPath = "";

    if (item.type) {
      try {
        const typeObj = JSON.parse(item.type);
        folderPath = typeObj.folder || "";
      } catch (e) {
        console.warn("解析type字段失败:", item.type);
      }
    }

    const folders = folderPath ? folderPath.split("/").filter(f => f) : [];
    const rootFolder = folders.length > 0 ? folders[0] : "默认文件夹";

    if (!folderMap.has(rootFolder)) {
      folderMap.set(rootFolder, {
        value: `folder_${rootFolder}`,
        label: rootFolder,
        children: []
      });
    }

    const leafNode: TreeNode = {
      value: item.objectName,
      label: getNameFromObjectName(item.objectName),
      data: item,
      isLeaf: true
    };

    folderMap.get(rootFolder)!.children!.push(leafNode);
  });

  return Array.from(folderMap.values());
});

const renderContent = (h, { node, data }) => {
  if (data.isLeaf && data.data?.objectName) {
    const objectName = data.data.objectName;
    const thumbnailUrl = thumbnailUrls.value[objectName];

    return h("div", { class: "material-option" }, [
      h("span", { class: "material-name" }, data.label),
      thumbnailUrl
        ? h("img", {
            src: thumbnailUrl,
            class: "material-thumbnail",
            loading: "lazy"
          })
        : h("div", { class: "material-thumbnail-placeholder" }, [
            h("el-icon", {}, [h(Picture)])
          ])
    ]);
  }

  return h("span", { class: "tree-folder-label" }, data.label);
};

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

// onUnmounted(() => {
//   Object.keys(thumbnailUrls.value).forEach(key => {
//     const url = thumbnailUrls.value[key];
//     if (url) {
//       URL.revokeObjectURL(url);
//     }
//   });
// });
</script>

<template>
  <div class="material-selector">
    <el-tree-select
      v-model="selectedValue"
      :data="materialTree"
      :render-content="renderContent"
      :placeholder="placeholder"
      filterable
      class="w-full"
      :disabled="disabled"
      value-key="value"
      popper-class="material-selector-popper"
      @change="handleSelectChange"
    />
  </div>
</template>

<style lang="scss">
.material-selector {
  width: 100%;
}

.material-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.material-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-folder-label {
  font-weight: 500;
}

.material-thumbnail {
  width: 60px;
  height: 60px;
  object-fit: contain;
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

.material-selector-popper {
  max-height: 400px;
  overflow-y: auto;

  .el-tree-node__content {
    height: auto !important;
    padding: 8px 0;
  }

  .el-select-dropdown__item {
    height: auto;
    line-height: auto;
  }
}
</style>
