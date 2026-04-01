<script setup lang="ts">
import { onMounted, ref } from "vue";
import { IMG_CONFIG } from "./utils/config";
import imageUrl1 from "@/views/debug/assets/绘图1.png";
import imageUrl2 from "@/views/debug/assets/绘图2.jpg";
import { ElMessage } from "element-plus";
import { downloadFile, getMaterialPage, transferDraw } from "@/api/aiDraw";
import { imageCache } from "../../utils/imageCache";
import { blobManager } from "../../utils/blobManager";
import ResultImg from "./resultImg.vue";
import TableCard from "./tableCard.vue";
import { getNameFromObjectName } from "../../utils/general";
import MaterialSelectorWithThumb from "./materialSelectorWithThumb.vue";
import { FORMAT_PROMPT } from "./utils/prompt";

const resultImgRef = ref(null);

const loading = ref(false);
const errorMsg = ref("");
const timerInterval = ref<number>(0);
let timerId: number | null = null;

const fileList = ref<any[]>([]);
const imageConfig = ref<any>([]);
const imageName = ref("");

const materialList = ref<any>({});

/**
 * 画布尺寸配置（单位：px）
 */
const CANVAS_SIZE = 500;

/**
 * 当前选中的元素 ID
 */
const selectedId = ref<string | null>(null);

/**
 * 表单数据对象，存储所有元素的最终数据
 * key: 元素 ID 或 元素 ID_字段标签
 * value: 元素值（图片 base64 或文本内容）
 */
const formData = ref<Record<string, any>>({});

/**
 * AI引用状态存储
 * key: 元素 ID
 * value: AI引用状态（true 或 false）
 */
const aiReferenceStatus = ref<Record<string, boolean>>({});

/**
 * 是否保留状态存储
 * key: 元素 ID
 * value: 是否填充状态
 */
const isKeepStatus = ref<Record<string, boolean>>({});

/**
 * 临时图片数据存储（预览用，未确认）
 * key: 元素 ID
 * value: 图片 base64 字符串
 */
const tempImageData = ref<Record<string, string>>({});

/**
 * 图片选择模式：'upload' | 'material'
 * key: 元素 ID
 * value: 当前选择的模式
 */
const imageSelectMode = ref<Record<string, "upload" | "material">>({});

/**
 * 素材选择器的临时值（仅用于绑定 el-select）
 * key: 元素 ID
 * value: 选中的 objectName
 */
const tempMaterialSelect = ref<Record<string, string>>({});

/**
 * 右侧卡片元素的引用集合，用于滚动定位
 */
const cardRefs = ref<Record<string, any>>({});

/**
 * 格式化时间为 mm:ss 格式
 */
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * 初始化表单数据
 * 根据 IMG_CONFIG 配置为每个元素设置默认值
 */
const initFormData = () => {
  imageConfig.value.forEach(item => {
    if (item.content) {
      item.content.forEach(field => {
        formData.value[`${item.id}_${field.label}`] = field.text;
      });
    } else if (item.type === "image") {
      formData.value[item.id] = null;
      tempImageData.value[item.id] = "";
      aiReferenceStatus.value[item.id] = false;
      isKeepStatus.value[item.id] = false;
      imageSelectMode.value[item.id] = "upload";
      tempMaterialSelect.value[item.id] = "";
    }
  });
};

const fetchMaterialPage = () => {
  return getMaterialPage({
    pageNo: 1,
    pageSize: 9999
  })
    .then((res: any) => {
      if (res.code === 200) {
        const materialListTemp = {};
        res.data.records.forEach((item: any) => {
          const mtype = JSON.parse(item.type)?.mtype;
          if (mtype) {
            if (!materialListTemp[mtype]) {
              materialListTemp[mtype] = [item];
            } else {
              materialListTemp[mtype].push(item);
            }
          }
        });

        materialList.value = materialListTemp;
      } else {
        ElMessage.error("获取素材库失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("获取素材库失败:" + error.message);
    });
};

onMounted(() => {
  // fetchMaterialPage();
  // initFormData();
});

/**
 * 处理元素选中/取消选中
 * @param id - 元素 ID
 */
const handleSelectItem = (id: string) => {
  selectedId.value = selectedId.value === id ? null : id;

  if (selectedId.value && cardRefs.value[id]) {
    const cardElement = cardRefs.value[id];
    cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

/**
 * 处理图片选择（预览）
 * @param itemId - 元素 ID
 * @param file - 选择的文件对象
 */
const handleImageSelect = (itemId: string, file: File) => {
  const reader = new FileReader();
  reader.onload = e => {
    tempImageData.value[itemId] = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

/**
 * 确认上传图片
 * @param itemId - 元素 ID
 */
const handleConfirmUpload = (itemId: string) => {
  if (tempImageData.value[itemId]) {
    formData.value[itemId] = tempImageData.value[itemId];
    tempImageData.value[itemId] = "";
  }
};

/**
 * 取消上传图片
 * @param itemId - 元素 ID
 */
const handleCancelUpload = (itemId: string) => {
  tempImageData.value[itemId] = "";
};

/**
 * 从素材库选择图片
 * @param itemId - 元素 ID
 * @param objectName - 素材的对象名称
 */
const handleSelectFromMaterial = async (itemId: string, objectName: string) => {
  if (!objectName) return;

  try {
    // 调用 API 下载文件，获取 blob
    const response: any = await downloadFile({ objectName });

    // 将 blob 转换为 base64
    const base64String = await blobManager.blobToBase64(response);

    // 存储 base64 到 formData
    formData.value[itemId] = base64String;
    tempImageData.value[itemId] = "";

    ElMessage.success("已选择素材");
  } catch (error) {
    console.error("素材加载失败:", error);
    ElMessage.error("素材加载失败：" + error.message);
  }
};

/**
 * 删除已上传的图片
 * @param itemId - 元素 ID
 */
const handleDeleteImage = (itemId: string) => {
  formData.value[itemId] = null;
  tempMaterialSelect.value[itemId] = "";
  aiReferenceStatus.value[itemId] = false;
  isKeepStatus.value[itemId] = false;
  // ElMessage.success("图片已删除");
};

// ==================== AI 生成功能 ====================
const prompt = ref<string>("");
const demoMode = ref<boolean>(false);

const generateImage = async () => {
  // const testB4 = await imageToBase64(imageUrl2);
  // resultImgRef.value?.initResultImg(
  //   imageConfig.value,
  //   { ...formData.value },
  //   testB4,
  //   aiReferenceStatus.value
  // );
  // return;

  // if (!prompt.value.trim()) {
  //   ElMessage.warning("请输入提示词");
  //   return;
  // }

  const { prompt_, config_, urls_ } = handleGenerateImage();

  testTransferDraw(formatPrompt(prompt_, config_), urls_);
};

const handleGenerateImage = () => {
  console.log(
    "生成图片:",
    prompt.value,
    formData.value,
    aiReferenceStatus.value,
    isKeepStatus.value
  );

  // return;
  const urls_: string[] = [];

  const result = imageConfig.value.map(item => {
    const baseItem = {
      id: item.id,
      name: item.name,
      type: item.type,
      rect: item.rect
    };

    if (item.type === "text" && item.content) {
      const updatedContent = item.content.map(field => ({
        label: field.label,
        text: formData.value[`${item.id}_${field.label}`] || field.text
      }));
      return {
        ...baseItem,
        content: updatedContent
      };
    }

    if (item.type === "image") {
      if (formData.value[item.id] && aiReferenceStatus.value[item.id]) {
        urls_.push(formData.value[item.id]);
        return {
          ...baseItem,
          image: `第${urls_.length + 1}张图`
        };
      }
      if (!formData.value[item.id] && isKeepStatus.value[item.id]) {
        return {
          ...baseItem,
          image: null,
          keep: true
        };
      } else {
        return {
          ...baseItem,
          image: null,
          keep: false
        };
      }
    }

    return baseItem;
  });

  console.log("生成图片:", prompt.value);
  console.log("拼接后的配置数据:", result);
  console.log("图片素材:", urls_);

  return {
    prompt_: prompt.value,
    config_: result,
    urls_: urls_
  };
};

const formatPrompt = (prompt: string, config: any[]) => {
  const temp = FORMAT_PROMPT(
    JSON.stringify(imageConfig.value),
    JSON.stringify(config)
  );
  return temp + "\n" + prompt;
};

// 将图片 URL 转换为 base64
const imageToBase64 = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法获取 canvas 上下文"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL("image/png");
      resolve(base64);
    };
    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };
    img.src = imageUrl;
  });
};
// 测试中转模型
const testTransferDraw = async (prompt: string, urlList: string[]) => {
  // 转换图片为 base64
  let base64Url1 = "";
  let base64Url2 = "";

  try {
    [base64Url1, base64Url2] = await Promise.all([
      imageToBase64(imageUrl1),
      imageToBase64(imageUrl2)
    ]);
  } catch (error) {
    console.error("图片转 base64 失败:", error);
    return;
  }

  // 转换blob为base64
  const base64Url1_ = await blobManager.blobToBase64(fileList.value[0].raw);

  const params = {
    model: "nano-banana-2",
    prompt: prompt,
    aspectRatio: "auto",
    imageSize: "4K",
    shutProgress: false,
    urls: [base64Url1_, ...urlList]
  };

  console.log("请求参数：", params);
  // await loadTestResultImage();
  // return;
  loading.value = true;
  errorMsg.value = "";

  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  timerInterval.value = 0;
  timerId = window.setInterval(() => {
    timerInterval.value += 1;
  }, 1000);

  transferDraw({
    urlParam: JSON.stringify(params)
  })
    .then(async (res: any) => {
      console.log("中转gemini模型:", res);
      if (res.code === 200) {
        if (!res.data?.[0]) {
          ElMessage.error("生成失败: 图片URL为空");
          return;
        }

        const resultUrl = res.data?.[0]; // 绝对路径

        try {
          const base64String = await imageToBase64(resultUrl);

          const processedFormData = { ...formData.value };
          Object.keys(aiReferenceStatus.value).forEach(key => {
            if (aiReferenceStatus.value[key]) {
              processedFormData[key] = null;
            }
          });

          resultImgRef.value?.initResultImg(
            imageConfig.value,
            processedFormData,
            base64String, // 使用 base64 而不是绝对路径
            aiReferenceStatus.value
          );
        } catch (error) {
          console.error("图片转 base64 失败:", error);
          ElMessage.error("图片处理失败:" + error.message);
        }
      } else {
        errorMsg.value = res?.msg || "生成失败";
      }
    })
    .finally(() => {
      loading.value = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    });
};

// 测试加载结果图片
const loadTestResultImage = async () => {
  const testImageUrl =
    "https://fuss10.elemecdn.com/e/5d/4a731a90594a4af544c0c25941171jpeg.jpeg";

  try {
    const base64String = await imageToBase64(testImageUrl);

    const processedFormData = { ...formData.value };
    Object.keys(aiReferenceStatus.value).forEach(key => {
      if (aiReferenceStatus.value[key]) {
        processedFormData[key] = null;
      }
    });

    resultImgRef.value?.initResultImg(
      imageConfig.value,
      processedFormData,
      base64String,
      aiReferenceStatus.value
    );

    ElMessage.success("测试图片已加载");
  } catch (error) {
    console.error("测试图片加载失败:", error);
    ElMessage.error("测试图片加载失败:" + error.message);
  }
};

const initDrawingPro = async (data: any) => {
  console.log("初始化绘图Pro:", data);
  imageName.value = data?.objectName || "";
  // 根据data.objectName 的相对路径 得到 图片的url，有缓存先拿缓存
  try {
    const url = data?.objectName;
    // 1. 首先尝试从 IndexedDB 缓存获取图片
    const cachedImageBlob = await imageCache.getImageBlob(url, "originalBlob");

    if (cachedImageBlob) {
      // 2. 如果缓存中有图片，直接使用
      // console.log("从缓存加载图片:", url);
      // ... 处理缓存图片
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
      // 3. 如果缓存中没有图片，则通过 API 获取
      // console.log("缓存中未找到图片，正在从服务器获取:", url);

      // 4. 使用 downloadFile API，传入 objectName 参数
      const response: any = await downloadFile({ objectName: url });
      // ... 处理下载的图片
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
    console.error("初始化失败:", error);
    ElMessage.error("初始化失败：" + error.message);
  }
  // 解析data.type 得到editPhraseInfo
  try {
    const editPhraseInfo = JSON.parse(data.type)?.editPhraseInfo || {};
    // console.log("解析的editPhraseInfo:", editPhraseInfo);
    imageConfig.value = JSON.parse(editPhraseInfo.editPhraseInfo) || [];
  } catch (error) {
    console.error("解析data.type失败:", error);
    ElMessage.error("编辑词解析失败：" + error.message);
  }
  initFormData();
};

// 清空批量操作表单数据
const tableCardRef = ref(null);
const clearTableCard = async () => {
  tableCardRef.value?.closeClearAll();
  await fetchMaterialPage();
};

defineExpose({
  initDrawingPro,
  clearTableCard
});
</script>

<template>
  <div>
    <el-card
      shadow="never"
      style="border-radius: 10px; background-color: #f5f7fa"
    >
      <template #header>
        <div class="card-header">
          <span>
            <span>演示模式</span>
            <span class="text-sm text-gray-500">
              (实时编辑预览单张模板图，可调整模板图价格、活动时间等元素，确认效果后可批量生成)
            </span>
          </span>
        </div>
      </template>
      <div class="text-base font-bold text-gray-800">
        {{ imageName }}
      </div>
      <el-row>
        <!-- 左侧：图片展示区域 -->
        <el-col :xs="24" :sm="24" :md="16">
          <div
            class="w-full h-full flex flex-col items-center justify-center"
            :style="{ flexShrink: 0, minWidth: `${CANVAS_SIZE}px` }"
          >
            <div class="text-center text-gray-500 text-sm mb-4">
              点击画布中的元素区域即可在右侧编辑
            </div>
            <div
              class="relative"
              :style="{
                width: `${CANVAS_SIZE}px`,
                height: `${CANVAS_SIZE}px`,
                flexShrink: 0,
                minWidth: `${CANVAS_SIZE}px`,
                minHeight: `${CANVAS_SIZE}px`
              }"
            >
              <img
                v-if="fileList[0]?.url"
                :src="fileList[0]?.url || ''"
                alt="图片"
                :style="{
                  width: `${CANVAS_SIZE}px`,
                  height: `${CANVAS_SIZE}px`
                }"
                class="rounded-lg shadow-md"
              />
              <div v-else>请从素材库中选择模板图片</div>

              <div
                v-for="item in imageConfig"
                :key="item.id"
                :style="{
                  left: `${item.rect.x * CANVAS_SIZE}px`,
                  top: `${item.rect.y * CANVAS_SIZE}px`,
                  width: `${item.rect.width * CANVAS_SIZE}px`,
                  height: `${item.rect.height * CANVAS_SIZE}px`
                }"
                @click.stop="handleSelectItem(item.id)"
                :class="[
                  'absolute cursor-pointer transition-all duration-200 p-1 text-sm font-medium rounded',
                  selectedId === item.id
                    ? 'bg-blue-500 border-2 border-blue-700 text-white shadow-lg scale-[1.02]'
                    : 'bg-red-500 bg-opacity-60 border border-red-700 text-white hover:bg-opacity-80'
                ]"
              >
                {{ item.name }}
                <span v-if="selectedId === item.id" class="ml-1">✓</span>
              </div>
            </div>
          </div>
        </el-col>

        <!-- 右侧：元素编辑区域 -->
        <el-col :xs="24" :sm="24" :md="8">
          <div class="p-4">
            <div class="text-base font-bold mb-4 text-gray-800">元素编辑</div>
            <el-scrollbar height="500px">
              <div class="space-y-4">
                <div
                  v-for="item in imageConfig"
                  :key="item.id"
                  :ref="el => (cardRefs[item.id] = el)"
                  :class="[
                    'p-3 rounded-lg border-2 transition-all duration-200',
                    selectedId === item.id
                      ? 'bg-blue-50 border-blue-500 shadow-md'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  ]"
                >
                  <div
                    class="font-semibold mb-2 text-green-700 cursor-pointer flex justify-between items-center"
                    @click.stop="handleSelectItem(item.id)"
                  >
                    <span>{{ item.name }}</span>
                    <span v-if="selectedId === item.id" class="text-blue-600"
                      >✓ 已选中</span
                    >
                  </div>

                  <div v-if="item.type === 'image'" class="ml-2">
                    <!-- 模式切换 -->
                    <div class="flex gap-2 mb-2">
                      <el-button
                        size="small"
                        :type="
                          imageSelectMode[item.id] === 'upload' ? 'primary' : ''
                        "
                        :plain="imageSelectMode[item.id] !== 'upload'"
                        @click="imageSelectMode[item.id] = 'upload'"
                        class="flex-1"
                      >
                        📤 本地上传
                      </el-button>
                      <el-button
                        size="small"
                        :type="
                          imageSelectMode[item.id] === 'material'
                            ? 'primary'
                            : ''
                        "
                        :plain="imageSelectMode[item.id] !== 'material'"
                        @click="imageSelectMode[item.id] = 'material'"
                        class="flex-1"
                      >
                        🗂️ 素材库选择
                      </el-button>
                    </div>

                    <!-- 本地上传模式 -->
                    <div v-if="imageSelectMode[item.id] === 'upload'">
                      <el-upload
                        :file-list="[]"
                        :auto-upload="false"
                        :show-file-list="false"
                        :on-change="
                          (file: any) => handleImageSelect(item.id, file.raw)
                        "
                        accept="image/*"
                        class="w-full"
                      >
                        <div
                          class="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-500 transition-colors cursor-pointer hover:bg-gray-50"
                        >
                          <div v-if="tempImageData[item.id]" class="relative">
                            <img
                              :src="tempImageData[item.id]"
                              class="max-h-[120px] max-w-full mx-auto rounded"
                            />
                            <div class="flex justify-center gap-2 mt-2">
                              <el-button
                                type="primary"
                                size="small"
                                @click.stop="handleConfirmUpload(item.id)"
                                >确认</el-button
                              >
                              <el-button
                                type="danger"
                                size="small"
                                @click.stop="handleCancelUpload(item.id)"
                                >取消</el-button
                              >
                            </div>
                          </div>
                          <div v-else-if="formData[item.id]" class="relative">
                            <img
                              :src="formData[item.id]"
                              class="max-h-[120px] max-w-full mx-auto rounded"
                            />
                            <div class="absolute top-1 right-1">
                              <el-button
                                type="danger"
                                size="small"
                                circle
                                @click.stop="handleDeleteImage(item.id)"
                              >
                                <el-icon><Delete /></el-icon>
                              </el-button>
                            </div>
                            <div class="text-sm text-gray-600 mt-2">
                              点击重新上传
                            </div>
                          </div>
                          <div v-else class="py-3">
                            <div class="text-gray-400 mb-1 text-xl">📁</div>
                            <div class="text-xs text-gray-500">
                              点击上传图片
                            </div>
                          </div>
                        </div>
                      </el-upload>
                    </div>

                    <!-- 素材库选择模式 -->
                    <div v-else-if="imageSelectMode[item.id] === 'material'">
                      <MaterialSelectorWithThumb
                        v-model="tempMaterialSelect[item.id]"
                        :material-list="materialList['componentMaterial'] || []"
                        placeholder="请选择素材"
                        :cache-key="`material_thumb:${item.id}`"
                        @change="
                          value => handleSelectFromMaterial(item.id, value)
                        "
                      />

                      <div
                        v-if="formData[item.id] && !tempImageData[item.id]"
                        class="mt-2"
                      >
                        <div class="relative inline-block">
                          <img
                            :src="formData[item.id]"
                            class="max-h-[120px] max-w-full rounded border-2 border-blue-200"
                          />
                          <div class="absolute top-1 right-1">
                            <el-button
                              type="danger"
                              size="small"
                              circle
                              @click.stop="handleDeleteImage(item.id)"
                            >
                              <el-icon><Delete /></el-icon>
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="formData[item.id]"
                      class="text-sm text-gray-500 mt-3 flex items-center"
                    >
                      <span>AI 引用</span>
                      <el-tooltip
                        effect="dark"
                        content="开启后由 AI 负责渲染图片"
                        placement="top-start"
                        :show-after="250"
                      >
                        <el-icon class="mr-2 cursor-pointer"
                          ><QuestionFilled
                        /></el-icon>
                      </el-tooltip>

                      <el-switch v-model="aiReferenceStatus[item.id]" />
                    </div>

                    <div
                      v-else
                      class="text-sm text-gray-500 mt-3 flex items-center"
                    >
                      <span>是否保留</span>
                      <el-tooltip
                        effect="dark"
                        content="开启后会自动保留图片，不被 AI 擦除"
                        placement="top-start"
                        :show-after="250"
                      >
                        <el-icon class="mr-2 cursor-pointer"
                          ><QuestionFilled
                        /></el-icon>
                      </el-tooltip>

                      <el-switch v-model="isKeepStatus[item.id]" />
                    </div>
                  </div>

                  <div v-else-if="item.content" class="space-y-2 ml-2">
                    <div
                      v-for="(field, index) in item.content"
                      :key="index"
                      class="text-sm"
                    >
                      <span class="text-gray-600 mr-2 font-medium"
                        >{{ field.label }}:</span
                      >
                      <el-input
                        v-model="formData[`${item.id}_${field.label}`]"
                        size="small"
                        class="w-[200px]"
                        placeholder="请输入内容"
                      />
                    </div>
                  </div>

                  <div v-else class="text-sm text-gray-500 ml-2">
                    <span class="text-gray-600 mr-2 font-medium">类型:</span>
                    <span class="text-gray-900">{{ item.type }}</span>
                  </div>
                </div>

                <!-- AI 生成面板 -->
                <div class="mt-6 ai-generate-panel rounded-xl p-5">
                  <div class="mb-3" v-if="false">
                    <div class="panel-title mb-2 flex items-center">
                      <span class="mr-2">✨</span>
                      描述你想要的 Banner 内容
                    </div>
                    <div class="panel-example">
                      例如：生成一张宠物食品促销
                      Banner，绿色主题，包含产品图和价格标签...
                    </div>
                  </div>

                  <el-input
                    v-model="prompt"
                    type="textarea"
                    :rows="3"
                    placeholder="效果不好时才输入更详细的描述，否则请保持为空..."
                    class="w-full mb-4"
                    v-if="true"
                  />

                  <div
                    class="flex items-center justify-between mb-4 p-3 bg-white/60 rounded-lg"
                    v-if="false"
                  >
                    <span class="text-sm text-gray-600"
                      >演示模式（使用示例图片测试）</span
                    >
                    <el-switch v-model="demoMode" size="large" />
                  </div>

                  <el-button
                    type="primary"
                    size="large"
                    class="w-full generate-button"
                    @click="generateImage"
                    :loading="loading"
                    :disabled="!fileList[0]?.url"
                  >
                    <i class="el-icon-star"></i> ✨立即生成
                    <span
                      v-if="loading && timerInterval > 0"
                      class="ml-2 text-sm"
                    >
                      ({{ formatTime(timerInterval) }})
                    </span>
                  </el-button>

                  <div class="panel-footer mt-3 text-center" v-if="false">
                    💡 输入提示词，生成的图片将保留在此处
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <div class="mt-4" v-if="fileList[0]?.url">
        <ResultImg ref="resultImgRef" :errorMsg="errorMsg" />
      </div>
    </el-card>

    <div class="mt-4" v-if="fileList[0]?.url">
      <TableCard
        :imageConfig="imageConfig"
        :imageName="imageName"
        ref="tableCardRef"
        :fileList="fileList"
        :materialList="materialList"
      />
    </div>
  </div>
</template>

<style scoped>
/* 图标样式 */
.el-icon-star {
  margin-right: 6px;
}

/* AI 生成面板样式优化 */
.ai-generate-panel {
  background: linear-gradient(135deg, #f6f8ff 0%, #edf2ff 100%);
  border: 1px solid #e0e7ff;
  box-shadow: 0 2px 12px rgba(100, 116, 255, 0.1);
  transition: all 0.3s ease;
}

.ai-generate-panel:hover {
  box-shadow: 0 4px 16px rgba(100, 116, 255, 0.15);
  transform: translateY(-2px);
}

/* 标题样式 */
.panel-title {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

/* 提示文字样式 */
.panel-hint {
  color: #64748b;
  line-height: 1.6;
}

/* 示例文字样式 */
.panel-example {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

/* 输入框样式优化 */
:deep(.el-textarea__inner) {
  border: 1px solid #cbd5e1 !important;
  transition: all 0.2s ease;
  resize: none;
}

:deep(.el-textarea__inner:hover) {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

:deep(.el-textarea__inner:focus) {
  border-color: #4f46e5 !important;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

/* 开关样式优化 */
:deep(.el-switch) {
  --el-switch-on-color: #6366f1;
  --el-switch-off-color: #cbd5e1;
}

/* 生成按钮样式优化 */
.generate-button {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  font-weight: 600;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  transition: all 0.3s ease;
}

.generate-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
}

.generate-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

/* 底部提示文字 */
.panel-footer {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}

/* 滚动条美化 */
:deep(.el-scrollbar__bar) {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.el-scrollbar__thumb) {
  background-color: rgba(0, 0, 0, 0.2);
  transition: background-color 0.2s ease;
}

:deep(.el-scrollbar__thumb:hover) {
  background-color: rgba(0, 0, 0, 0.3);
}
</style>
