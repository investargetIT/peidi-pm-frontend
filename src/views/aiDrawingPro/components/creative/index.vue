<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { UploadProps, UploadUserFile } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import {
  downloadFile,
  getMaterialPage,
  newMaterial,
  uploadDraw,
  transferDraw
} from "@/api/aiDraw";
import {
  PictureIcon,
  RefreshIcon,
  DownloadIcon,
  UploadIcon,
  Save2Icon,
  StarIcon
} from "../../assests/svg/index";
import {
  fileToBase64,
  downloadImageFromUrl,
  generateID
} from "../../utils/general";
import { imageCache } from "../../utils/imageCache";
import { blobManager } from "../../utils/blobManager";
import { saveToMaterialLibrary } from "../../utils/operationIogic/saveToMaterialLibrary";
import PictureSizeDailog from "./pictureSizeDailog.vue";
import ResultCard from "./resultCard.vue";

const pictureSizeDailogRef = ref(null);
const resultCardRef = ref(null);

const loading = ref(false);
const aiModel = ref("nano-banana-pro");
const configForm = reactive({
  size: "4K",
  ratio: "auto",
  prompt: ""
});
const resultPictures = ref<string[]>([
  // "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop"
]);
const resultInfo = ref<any>(null);
const selectedPictureIndex = ref<number>(0);

// 添加图片上传相关变量（支持多图）
const fileList = ref<any[]>([]);
const dialogImageUrl = ref("");
const dialogVisible = ref(false);
const MAX_IMAGE_COUNT = 9;

const handleFileChange: UploadProps["onChange"] = (uploadFile, uploadFiles) => {
  if (uploadFiles.length > MAX_IMAGE_COUNT) {
    ElMessage.warning(
      `最多只能上传 ${MAX_IMAGE_COUNT} 张图片，已自动移除超出的图片`
    );
    uploadFiles = uploadFiles.slice(0, MAX_IMAGE_COUNT);
    fileList.value = uploadFiles;
    return false;
  }

  const isImage = uploadFile.raw?.type.startsWith("image/");
  if (!isImage) {
    ElMessage.error("只能上传图片文件!");
    return false;
  }

  const isLt50M = (uploadFile.size || 0) / 1024 / 1024 < 50;
  if (!isLt50M) {
    ElMessage.error("图片大小不能超过50MB!");
    return false;
  }

  fileList.value = uploadFiles;

  return false;
};

const handleRemove: UploadProps["onRemove"] = (uploadFile, uploadFiles) => {
  fileList.value = uploadFiles;
};

const handlePictureCardPreview: UploadProps["onPreview"] = uploadFile => {
  dialogImageUrl.value = uploadFile.url!;
  dialogVisible.value = true;
};

onUnmounted(() => {
  fileList.value.forEach(file => {
    if (file.url && file.url.startsWith("blob:")) {
      URL.revokeObjectURL(file.url);
    }
  });
  resultPictures.value.forEach(pic => {
    if (pic && pic.startsWith("blob:")) {
      URL.revokeObjectURL(pic);
    }
  });
});

const handleGenerateClick = async () => {
  // 检查是否已生成 100 条记录
  if (resultCardRef.value?.isMonthlyLimitReached()) {
    ElMessage.warning("本月已生成 100 条记录，无法继续生成");
    return;
  }

  if (!configForm.prompt) {
    ElMessage.error("提示词不能为空");
    return;
  }

  loading.value = true;
  resultInfo.value = null;

  const paramsContent = await formatParams();

  const promises = [];
  for (let i = 0; i < 4; i++) {
    promises.push(transferDraw({ urlParam: JSON.stringify(paramsContent) }));
  }

  Promise.all(promises)
    .then((results: any[]) => {
      const successCount = results.filter(
        res => res.code === 200 && res.data?.[0]
      ).length;

      if (successCount > 0) {
        const validImages = results
          .filter(res => res.code === 200 && res.data?.[0])
          .map(res => res.data[0]);

        resultPictures.value = validImages;
        selectedPictureIndex.value = 0;

        if (successCount === 4) {
          resultInfo.value = `生成完成，成功 ${successCount}/4`;
          ElMessage.success(resultInfo.value);
        } else {
          resultInfo.value = `生成完成，成功 ${successCount}/4，失败 ${4 - successCount}/4`;
          ElMessage.warning(resultInfo.value);
        }

        // 生成成功几个 就调用几次 addDrawRecord
        const addRecordPromises = resultPictures.value.map((pic, index) => {
          return (
            resultCardRef.value?.addDrawRecord(pic, generateID()) ||
            Promise.resolve()
          );
        });

        Promise.all(addRecordPromises)
          .then(() => {
            resultCardRef.value?.updateData();
          })
          .catch(error => {
            console.error("更新图片记录失败:", error);
          });
      } else {
        resultInfo.value = "生成失败：所有请求均未返回有效结果";
        ElMessage.error("生成失败：所有请求均未返回有效结果");
      }
    })
    .catch((error: any) => {
      console.error("请求失败:", error);
      ElMessage.error(error.message || `生成失败：${error.toString()}`);
    })
    .finally(() => {
      loading.value = false;
    });
};

const formatParams = async () => {
  let base64Urls = [];
  if (fileList.value && fileList.value.length > 0) {
    try {
      const promises = fileList.value.map(file => {
        if (file.raw) {
          return fileToBase64(file as any);
        }
        return Promise.resolve(file.url || "");
      });
      base64Urls = await Promise.all(promises);
    } catch (error) {
      console.error("转换图片为 base64 失败:", error);
      ElMessage.error("图片转换失败:" + error.message);
    }
  }

  return {
    model: aiModel.value,
    prompt: configForm.prompt,
    aspectRatio: configForm.ratio,
    imageSize: configForm.size,
    urls: base64Urls,
    shutProgress: false
  };
};

const handleDownloadClick = () => {
  if (!resultPictures.value[selectedPictureIndex.value]) {
    ElMessage.warning("没有可下载的图片");
    return;
  }
  pictureSizeDailogRef.value?.initDetail(
    resultPictures.value[selectedPictureIndex.value]
  );
};

const handleSaveToMaterialLibraryClick = () => {
  if (!resultPictures.value[selectedPictureIndex.value]) {
    ElMessage.warning("没有可保存的图片");
    return;
  }

  saveToMaterialLibrary(
    resultPictures.value[selectedPictureIndex.value],
    "template"
  );
};

const selectPicture = (index: number) => {
  selectedPictureIndex.value = index;
};

const initCreativeStudio = async (url: string) => {
  try {
    const cachedImageBlob = await imageCache.getImageBlob(url, "originalBlob");

    if (cachedImageBlob) {
      console.log("从缓存加载图片:", url);

      const base64String = await blobManager.blobToBase64(cachedImageBlob);

      const blobUrl = URL.createObjectURL(cachedImageBlob);

      fileList.value = [
        {
          name: url.split("/").pop() || "cached-image",
          url: blobUrl,
          raw: cachedImageBlob
        }
      ];
    } else {
      console.log("缓存中未找到图片，正在从服务器获取:", url);

      const response: any = await downloadFile({ objectName: url });

      const blobUrl = URL.createObjectURL(response);

      fileList.value = [
        {
          name: url.split("/").pop() || "downloaded-image",
          url: blobUrl,
          raw: response
        }
      ];
    }
  } catch (error) {
    console.error("初始化创意工作室失败:", error);
    ElMessage.error("初始化创意工作室失败：" + error.message);
  }
};

defineExpose({
  initCreativeStudio
});
</script>

<template>
  <div>
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="12" :lg="8">
        <el-card
          shadow="never"
          style="border-radius: 10px"
          class="peidi-aiDrawingPro-creative-card-equal-height"
        >
          <div class="flex items-center justify-between mb-[24px]">
            <h2 class="text-xl font-semibold text-[#0a0a0a]">生成器</h2>
            <el-select
              v-model="aiModel"
              placeholder="请选择 AI 模型"
              style="width: 180px"
            >
              <el-option
                label="nano-banana-pro"
                value="nano-banana-pro"
              ></el-option>
              <el-option label="nano-banana" value="nano-banana"></el-option>
              <el-option
                label="nano-banana-fast"
                value="nano-banana-fast"
              ></el-option>
            </el-select>
          </div>

          <el-form :model="configForm" :label-position="'top'">
            <el-form-item label="素材图片">
              <el-upload
                v-model:file-list="fileList"
                action=""
                list-type="picture-card"
                :auto-upload="false"
                :on-change="handleFileChange"
                :on-remove="handleRemove"
                :on-preview="handlePictureCardPreview"
                accept="image/*"
                multiple
                :limit="MAX_IMAGE_COUNT"
              >
                <el-icon class="text-gray-400">
                  <Plus />
                </el-icon>
                <template #tip>
                  <div class="text-xs text-gray-500 mt-[8px]">
                    最多上传 {{ MAX_IMAGE_COUNT }} 张图片，支持 JPG, JPEG, PNG,
                    WEBP 格式
                  </div>
                </template>
              </el-upload>
            </el-form-item>

            <div class="flex items-center justify-between">
              <el-form-item label="图片尺寸" style="width: 50%">
                <el-select
                  v-model="configForm.size"
                  placeholder="请选择图片尺寸"
                  style="width: 160px"
                >
                  <el-option label="1K" value="1K" />
                  <el-option label="2K" value="2K" />
                  <el-option label="4K" value="4K" />
                </el-select>
              </el-form-item>
              <el-form-item label="宽高比" style="width: 50%">
                <el-select
                  v-model="configForm.ratio"
                  placeholder="请选择宽高比"
                  style="width: 160px"
                >
                  <el-option label="自动" value="auto" />
                  <el-option label="1:1" value="1:1" />
                  <el-option label="16:9" value="16:9" />
                  <el-option label="9:16" value="9:16" />
                  <el-option label="4:3" value="4:3" />
                  <el-option label="3:4" value="3:4" />
                  <el-option label="3:2" value="3:2" />
                  <el-option label="2:3" value="2:3" />
                  <el-option label="5:4" value="5:4" />
                  <el-option label="4:5" value="4:5" />
                  <el-option label="21:9" value="21:9" />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item label="提示词">
              <el-input
                v-model="configForm.prompt"
                placeholder="描述你想要生成的图片内容..."
                type="textarea"
                :rows="5"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                color="#000"
                @click="handleGenerateClick"
                style="width: 100%; font-size: 16px; padding: 24px 0"
                :loading="loading"
              >
                <StarIcon
                  color="none"
                  style="width: 16px; height: 16px"
                  v-show="!loading"
                />
                生成图片
              </el-button>
              <el-alert
                v-if="resultInfo"
                :title="resultInfo"
                type="primary"
                :closable="false"
                show-icon
                style="margin-top: 16px"
              />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="12" :lg="9">
        <el-card
          shadow="never"
          style="border-radius: 10px"
          class="peidi-aiDrawingPro-creative-card-equal-height"
        >
          <div class="flex items-center justify-between mb-[16px]">
            <h2 class="text-xl font-semibold text-[#0a0a0a]">预览</h2>
            <div class="flex" v-show="resultPictures.length > 0">
              <el-button
                color="#F3F5F8"
                style="font-size: 13px"
                @click="handleGenerateClick"
              >
                <RefreshIcon color="none" /> 重新生成</el-button
              >
              <el-button
                color="#F3F5F8"
                style="font-size: 13px"
                @click="handleDownloadClick"
              >
                <DownloadIcon color="none" /> 下载</el-button
              >
              <el-button
                type="primary"
                style="font-size: 13px"
                @click="handleSaveToMaterialLibraryClick"
              >
                <Save2Icon color="none" /> 保存到素材库</el-button
              >
            </div>
          </div>

          <div
            class="relative aspect-square rounded-lg overflow-hidden bg-[#eaeff5]"
            v-if="resultPictures.length === 0"
          >
            <div
              class="absolute inset-0 flex flex-col items-center justify-center text-[#0a0a0a]"
            >
              <div
                class="w-16 h-16 rounded-full bg-[#eaeff5] flex items-center justify-center mb-4"
              >
                <PictureIcon color="none" />
              </div>
              <p class="text-sm font-medium">生成的图片将显示在这里</p>
              <p class="text-xs mt-1">请在左侧输入提示词并点击生成</p>
            </div>
          </div>

          <div v-else>
            <div class="grid grid-cols-2 gap-2 mb-3">
              <div
                v-for="(picture, index) in resultPictures"
                :key="index"
                class="relative aspect-square rounded-lg overflow-hidden bg-[#eaeff5] cursor-pointer border-2 transition-all"
                :class="
                  selectedPictureIndex === index
                    ? 'border-[#000]'
                    : 'border-transparent hover:border-gray-300'
                "
                @click="selectPicture(index)"
              >
                <img
                  :alt="`Generated ${index + 1}`"
                  class="w-full h-full object-cover"
                  :src="picture"
                />
                <div
                  v-if="selectedPictureIndex === index"
                  class="absolute top-1 right-1 w-5 h-5 bg-[#000] rounded-full flex items-center justify-center"
                >
                  <svg
                    class="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div
              class="relative aspect-[4/3] rounded-lg overflow-hidden bg-[#eaeff5]"
            >
              <img
                alt="Selected"
                class="w-full h-full object-contain"
                :src="resultPictures[selectedPictureIndex]"
              />
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="24" :md="12" :lg="7">
        <el-card
          shadow="never"
          style="border-radius: 10px"
          class="peidi-aiDrawingPro-creative-card-equal-height"
        >
          <ResultCard ref="resultCardRef" />
        </el-card>
      </el-col>
    </el-row>

    <div>
      <PictureSizeDailog ref="pictureSizeDailogRef" />
    </div>

    <!-- 预览对话框 -->
    <el-dialog v-model="dialogVisible">
      <img w-full :src="dialogImageUrl" alt="Preview Image" />
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-creative-card-equal-height {
  @media (min-width: 768px) {
    & {
      height: 100%;
    }
  }

  @media (max-width: 767px) {
    & {
      height: auto;
      margin-bottom: 20px;
    }
  }
}

:deep(.el-form-item__label) {
  color: #0a0a0a;
}

:deep(.el-upload-list--picture-card) {
  margin-top: 8px;
}

:deep(.el-upload--picture-card) {
  width: 100px;
  height: 100px;
}

:deep(.el-upload-list__item) {
  width: 100px;
  height: 100px;
  margin-right: 8px;
  margin-bottom: 8px;
}
</style>
