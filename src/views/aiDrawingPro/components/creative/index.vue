<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
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
import { fileToBase64, downloadImageFromUrl } from "../../utils/general";
import { imageCache } from "../../utils/imageCache";
import { blobManager } from "../../utils/blobManager";

const loading = ref(false);
const aiModel = ref("nano-banana-pro");
const configForm = reactive({
  size: "4K",
  ratio: "auto",
  prompt: ""
});
const resultPicture = ref("");
// https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop

// 添加图片上传相关变量
const uploadedImage = ref(null); // element-plus的file对象
const imageUrl = ref("");

// 处理文件上传
const handleFileChange = file => {
  // console.log("file", file);

  const isImage = file.raw.type.startsWith("image/");
  if (!isImage) {
    ElMessage.error("只能上传图片文件!");
    return false;
  }

  // 检查文件大小 (例如限制为5MB)
  const isLt5M = file.size / 1024 / 1024 < 50;
  if (!isLt5M) {
    ElMessage.error("图片大小不能超过50MB!");
    return false;
  }

  // 创建URL对象用于预览
  const url = URL.createObjectURL(file.raw);

  // 如果之前有上传的图片，释放旧的URL对象
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }

  // 更新上传的图片和URL
  uploadedImage.value = file;
  imageUrl.value = url;

  return false; // 阻止自动上传
};

onUnmounted(() => {
  // 释放上传图片的URL
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
  // 释放结果图片的URL（如果有的话）
  if (resultPicture.value && resultPicture.value.startsWith("blob:")) {
    URL.revokeObjectURL(resultPicture.value);
  }
});

//#region 调用AI接口逻辑
// 直接对接AI服务器的方法，保留原始逻辑，以后可能会用到
// const handleGenerateClickToGrsai = async () => {
//   if (!configForm.prompt) {
//     ElMessage.error("提示词不能为空");
//     return;
//   }

//   loading.value = true;

//   const params = await formatParams();
//   // console.log("params", params, uploadedImage.value, imageUrl.value);
//   // return;

//   try {
//     // 使用Fetch API来处理SSE流式响应
//     const response = await fetch(
//       "https://grsai.dakka.com.cn/v1/draw/nano-banana",
//       {
//         method: "POST",
//         headers: {
//           Authorization: "Bearer key",
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify(params)
//       }
//     );

//     // 删除这行调试代码，因为 response.text() 会消耗流
//     // console.log(
//     //   "AI response:",
//     //   await response.text(),
//     //   await response.headers.get("content-type")
//     // );

//     if (!response.ok) {
//       throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
//     }

//     const reader = response.body?.getReader();
//     if (!reader) {
//       throw new Error("无法读取响应流");
//     }

//     const decoder = new TextDecoder();
//     let buffer = "";

//     while (true) {
//       const { done, value } = await reader.read();

//       if (done) break;

//       buffer += decoder.decode(value, { stream: true });
//       const lines = buffer.split("\n");

//       console.log("lines:", lines);
//       if (lines.length > 0 && lines[0].includes("code")) {
//         ElMessage.error("错误: " + lines[0]);
//       }

//       // 保留最后一行（可能不完整）
//       buffer = lines.pop() || "";

//       for (const line of lines) {
//         if (line.startsWith("data: ")) {
//           const dataStr = line.slice(6); // 去掉 "data: " 前缀
//           if (dataStr.trim()) {
//             try {
//               const data = JSON.parse(dataStr);
//               console.log("接收到的数据:", data);

//               // 如果生成完成，显示图片
//               if (
//                 data.status === "succeeded" &&
//                 data.results &&
//                 data.results.length > 0
//               ) {
//                 resultPicture.value = data.results[0].url;
//                 ElMessage.success("生成完成");
//               }

//               // 如果生成失败，显示错误信息
//               if (data.status === "failed") {
//                 throw new Error(
//                   `生成失败: ${data.error || data.failure_reason || "未知错误"}`
//                 );
//               }
//             } catch (e) {
//               console.error("解析JSON失败:", e, "原始数据:", dataStr);
//               // 如果解析失败，尝试检查是否是错误消息
//               throw new Error(`解析JSON失败: ${e.message}`);
//             }
//           }
//         }
//       }
//     }
//   } catch (error: any) {
//     console.error("请求失败:", error);
//     ElMessage.error(error.message || `请求失败: ${error.toString()}`);
//   } finally {
//     loading.value = false;
//   }
// };

const handleGenerateClick = async () => {
  if (!configForm.prompt) {
    ElMessage.error("提示词不能为空");
    return;
  }

  loading.value = true;

  const paramsContent = await formatParams();
  // console.log("params", params, uploadedImage.value, imageUrl.value);
  // return;

  transferDraw({ urlParam: JSON.stringify(paramsContent) })
    .then((res: any) => {
      if (res.code === 200) {
        // console.log("生成成功:", res);
        if (res.data?.[0]) {
          resultPicture.value = res.data?.[0];
          ElMessage.success("生成完成");
        } else {
          ElMessage.error("生成失败:" + "Gemini timeout...");
        }
      } else {
        ElMessage.error("生成失败:" + res.message);
      }
    })
    .catch((error: any) => {
      console.error("请求失败:", error);
      ElMessage.error(error.message || `生成失败: ${error.toString()}`);
    })
    .finally(() => {
      loading.value = false;
    });
};

const formatParams = async () => {
  // 如果有上传的图片，将其转换为base64格式
  let base64Urls = [];
  if (uploadedImage.value) {
    try {
      const base64 = await fileToBase64(uploadedImage.value);
      base64Urls = [base64];
    } catch (error) {
      console.error("转换图片为base64失败:", error);
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
//#endregion

// 下载图片
const handleDownloadClick = () => {
  const msg = ElMessage({
    message: "图片下载中，请稍后...",
    duration: 0
  });
  downloadImageFromUrl(resultPicture.value)
    .then(() => {
      ElMessage.success("图片已下载");
    })
    .catch(() => {
      ElMessage.error("图片下载失败");
    })
    .finally(() => msg.close());
};

// 保存到素材库
const handleSaveToMaterialLibraryClick = () => {
  ElMessageBox.prompt("请输入模板素材名称", "保存到素材库", {
    confirmButtonText: "保存",
    cancelButtonText: "取消",
    inputPattern: /.+/,
    inputErrorMessage: "请输入模板素材名称",
    beforeClose: async (action, instance, done) => {
      try {
        if (action === "confirm") {
          const materialName = instance?.inputValue;
          // console.log("materialName:", materialName);

          instance.confirmButtonLoading = true;

          // 获取素材列表 - 获取全部素材（设置一个较大的pageSize）
          const materialListResponse: any = await getMaterialPage({
            pageNo: 1,
            pageSize: 1,
            searchStr: JSON.stringify({
              searchName: "objectName",
              searchType: "like",
              searchValue: "/" + materialName + "."
            })
          });

          if (materialListResponse.data?.total > 0) {
            ElMessage.error("素材名称已存在");
            instance.confirmButtonLoading = false;
            return;
          }

          // 将当前图片URL转换为File对象进行上传
          const response = await fetch(resultPicture.value);
          const blob = await response.blob();

          // 获取文件扩展名
          const contentType = blob.type;
          let extension = "";
          if (contentType === "image/jpeg") {
            extension = ".jpg";
          } else if (contentType === "image/png") {
            extension = ".png";
          } else if (contentType === "image/gif") {
            extension = ".gif";
          } else if (contentType === "image/webp") {
            extension = ".webp";
          } else {
            // 根据URL推断扩展名
            const urlExt = resultPicture.value.substring(
              resultPicture.value.lastIndexOf(".")
            );
            extension = urlExt.includes(".") ? urlExt : ".png";
          }

          // 创建新的File对象，使用用户输入的名称
          const file = new File([blob], materialName + extension, {
            type: contentType
          });

          const formData = new FormData();
          formData.append("file", file);

          // console.log("formData:", formData);

          // 上传图片到服务器
          const uploadRes: any = await uploadDraw(formData);

          if (uploadRes.code === 200) {
            // 上传成功后创建新素材记录
            const newMaterialRes: any = await newMaterial({
              objectName: uploadRes.data,
              type: JSON.stringify({ mtype: "template" })
            });

            if (newMaterialRes.code === 200) {
              ElMessage.success(`模板素材 "${materialName}" 已保存到素材库`);
              instance.confirmButtonLoading = false;
              done();
            } else {
              ElMessage.error("添加素材失败:" + newMaterialRes.msg);
              instance.confirmButtonLoading = false;
            }
          } else {
            ElMessage.error("图片上传失败:" + uploadRes.msg);
            instance.confirmButtonLoading = false;
          }
        } else {
          done();
        }
      } catch (error: any) {
        console.error("保存到素材库失败:", error);
        ElMessage.error("保存失败: " + error.message);
      }
    }
  })
    .then(({ value }) => {})
    .catch(() => {});
};

/**
 * 初始化创意工作室
 * @param url 图片URL /ai/1.png
 */
const initCreativeStudio = async (url: string) => {
  // console.log("initCreativeStudio:", url);

  try {
    // 首先尝试从 IndexedDB 缓存获取图片
    const cachedImageBlob = await imageCache.getImageBlob(url, "originalBlob");

    if (cachedImageBlob) {
      // 如果缓存中有图片，直接使用
      console.log("从缓存加载图片:", url);

      // 使用封装的 blobManager 工具类将 Blob 转换为 Base64
      const base64String = await blobManager.blobToBase64(cachedImageBlob);

      uploadedImage.value = {
        raw: cachedImageBlob,
        name: url.split("/").pop() || "cached-image",
        base64: base64String // 也可以存储 base64 字符串
      };

      // 创建 Blob URL 用于预览
      const blobUrl = URL.createObjectURL(cachedImageBlob);
      if (imageUrl.value) {
        URL.revokeObjectURL(imageUrl.value); // 释放之前的 URL
      }
      imageUrl.value = blobUrl;
    } else {
      // 如果缓存中没有图片，则通过 API 获取
      console.log("缓存中未找到图片，正在从服务器获取:", url);

      // 从服务器下载图片
      const response: any = await downloadFile({ objectName: url });

      // 将下载的图片 Blob 转换为 Base64
      const reader = new FileReader();
      reader.onload = async function () {
        uploadedImage.value = {
          raw: response,
          name: url.split("/").pop() || "downloaded-image"
        };

        // 创建 Blob URL 用于预览
        const blobUrl = URL.createObjectURL(response);
        if (imageUrl.value) {
          URL.revokeObjectURL(imageUrl.value); // 释放之前的 URL
        }
        imageUrl.value = blobUrl;
      };
      reader.onerror = function () {
        console.error("读取图片失败");
        ElMessage.error("读取图片失败");
      };
      reader.readAsDataURL(response);
    }
  } catch (error) {
    console.error("初始化创意工作室失败:", error);
    ElMessage.error("初始化创意工作室失败: " + error.message);
  }
};

defineExpose({
  initCreativeStudio
});
</script>

<template>
  <div>
    <el-row :gutter="20">
      <el-col :xs="24" :sm="24" :md="12" :lg="9">
        <el-card
          shadow="never"
          style="border-radius: 10px"
          class="peidi-aiDrawingPro-creative-card-equal-height"
        >
          <div class="flex items-center justify-between mb-[24px]">
            <h2 class="text-xl font-semibold text-[#0a0a0a]">生成器</h2>
            <el-select
              v-model="aiModel"
              placeholder="请选择AI模型"
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
            <el-form-item>
              <el-upload
                drag
                action=""
                style="width: 100%"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="handleFileChange"
                accept="image/*"
              >
                <!-- 如果没有上传图片则显示上传提示 -->
                <div v-if="!imageUrl" class="flex flex-col items-center">
                  <el-icon class="el-icon--upload">
                    <UploadIcon color="none" />
                  </el-icon>
                  <div class="el-upload__text">
                    <p class="text-[#0a0a0a] font-medium text-[16px]">
                      点击上传图片
                    </p>
                    <p class="text-sm text-[#5b646f] mt-1">或拖拽图片到此处</p>
                    <p class="text-xs text-[#5b646f] mt-2">
                      支持 JPG, JPEG, PNG, WEBP 格式
                    </p>
                  </div>
                </div>

                <!-- 如果已上传图片则显示图片 -->
                <div v-else class="w-full h-full">
                  <img
                    :src="imageUrl"
                    alt="Uploaded image"
                    class="max-h-32 rounded-lg object-contain mb-3"
                  />
                  <p class="text-sm text-[#5b646f]">点击重新上传</p>
                </div>

                <template #tip></template>
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
            <div class="flex" v-show="resultPicture">
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
            v-if="!resultPicture"
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
          <div
            class="relative aspect-square rounded-lg overflow-hidden bg-[#eaeff5]"
            v-else
          >
            <img
              alt="Generated"
              class="w-full h-full object-contain"
              :src="resultPicture"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-creative-card-equal-height {
  /* 在 md 尺寸及以上（>= 768px）使卡片高度一致 */
  @media (min-width: 768px) {
    & {
      height: 100%;
    }
  }

  /* 在 xs 尺寸下（< 768px）允许卡片自适应高度 */
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
</style>
