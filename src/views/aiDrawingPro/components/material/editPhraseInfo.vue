<script setup lang="ts">
import {
  ElMessage,
  FormInstance,
  FormRules,
  genFileId,
  UploadInstance,
  UploadProps,
  UploadRawFile
} from "element-plus";
import { nextTick, reactive, ref, watch } from "vue";
import {
  updateMaterial,
  transferGemini,
  downloadFile,
  uploadDraw
} from "@/api/aiDraw";
import { Pointer } from "@element-plus/icons-vue";
import { generateID } from "../../utils/general/index";
import { el } from "element-plus/es/locale/index.mjs";
// import imageUrl1 from "@/views/debug/assets/绘图1.png";
// import imageUrl2 from "@/views/debug/assets/绘图2.jpg";

const props = defineProps({
  fetchMaterialPage: {
    type: Function,
    required: true
  }
});

//#region 图片预览
const previewImageUrl = ref("");
const previewVisible = ref(false);
const handlePictureCardPreview: UploadProps["onPreview"] = uploadFile => {
  previewImageUrl.value = uploadFile.url!;
  previewVisible.value = true;
};
//#endregion

const dialogVisible = ref(false);
const loading = ref(false);
const geminiLoading = ref(false);

const materialData = ref(null);

// 编辑词显示模式 详情模式 和 可视化模式
const editPhraseMode = ref<"details" | "visual">("visual");
const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  editPhraseInfo: "",
  imageUrl: "",
  image: null,
  editPhraseInfoPrompt: ""
});
// 解析后的编辑词数组（用于可视化模式）
const editPhraseList = ref<any[]>([]);

const rules = reactive<FormRules>({
  image: [{ required: true, message: "请上传模板标记图", trigger: "change" }]
});

const initDetailForm = (data: any) => {
  materialData.value = data;
  dialogVisible.value = true;
  geminiLoading.value = false;
  ruleForm.image = null;
  editPhraseList.value = [];

  nextTick(() => {
    uploadRef.value?.clearFiles();
    ruleFormRef.value?.resetFields();

    const editPhraseInfo = JSON.parse(materialData.value.type)?.editPhraseInfo;
    if (editPhraseInfo) {
      Object.keys(editPhraseInfo).forEach(key => {
        ruleForm[key] = editPhraseInfo[key];
      });

      // 解析编辑词数组
      if (ruleForm.editPhraseInfo) {
        try {
          editPhraseList.value = JSON.parse(ruleForm.editPhraseInfo);
        } catch (error) {
          console.error("解析编辑词失败:", error);
          editPhraseList.value = [];
        }
      }

      if (editPhraseInfo.imageUrl) {
        // 请求回来的图片 填充到ruleForm.imageUrl
        downloadFile({ objectName: editPhraseInfo.imageUrl })
          .then((res: any) => {
            const file = new File([res], "template.png", { type: res.type });
            Object.defineProperty(file, "uid", {
              value: generateID(),
              writable: false,
              configurable: true
            });
            ruleForm.image = file;

            uploadRef.value?.clearFiles();
            uploadRef.value?.handleStart(file as UploadRawFile);
          })
          .catch(error => {
            console.error("加载模板标记图失败:", error);
            ElMessage.error("加载模板标记图失败");
          });
      }
    }
  });
};

defineExpose({ initDetailForm });

const submitForm = async (formEl: FormInstance | undefined) => {
  console.log("编辑词:", materialData.value, ruleForm);
  // return;
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      loading.value = true;
      // console.log("ruleForm:", ruleForm, materialData.value);
      const type = JSON.parse(materialData.value.type);
      const temp = {
        ...materialData.value,
        type: JSON.stringify({
          ...type,
          editPhraseInfo: { ...ruleForm, image: null }
        })
      };
      // console.log("submitForm:", temp);
      updateMaterial(temp)
        .then((res: any) => {
          if (res.code === 200) {
            ElMessage.success("编辑词保存成功");
            props.fetchMaterialPage();
            dialogVisible.value = false;
          } else {
            ElMessage.error("保存编辑词失败:" + res?.msg);
          }
        })
        .catch(error => {
          ElMessage.error("保存编辑词失败:" + error.message);
        })
        .finally(() => {
          loading.value = false;
        });
    } else {
      // console.log("error submit!", fields);
    }
  });
};

//#region 图片上传相关
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

// 将img上传到服务器 并填充imageUrl
const uploadImageToSever = () => {
  // 上传图片到服务器 重命名图片为 加入唯一标识
  const formData = new FormData();
  // 获取文件扩展名
  const originalName = ruleForm.image.name;
  const extension = originalName.includes(".")
    ? originalName.substring(originalName.lastIndexOf("."))
    : "";

  // 创建新的File对象，保持原文件的类型
  const newFile = new File([ruleForm.image], generateID() + extension, {
    type: ruleForm.image.type,
    lastModified: ruleForm.image.lastModified
  });

  formData.append("file", newFile);

  return uploadDraw(formData)
    .then((res: any) => {
      if (res.code === 200) {
        ruleForm.imageUrl = res.data;
      } else {
        ElMessage.error("图片上传失败:" + res.msg);
        throw new Error("图片上传失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("图片上传失败:" + error.message);
      throw error;
    });
};
//#endregion

//#region 调用AI相关
// 获取图片数据
async function getBase64(url: string) {
  return new Promise((resolve, reject) => {
    downloadFile({ objectName: url })
      .then((res: any) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // console.log("getBase64", reader.result);
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(reader.error);
        };
        reader.readAsDataURL(res);
      })
      .catch(reject);
  });
}
const handleGenerateDescriptorInfo = async () => {
  // 校验表单
  const valid = await ruleFormRef.value?.validate();
  if (!valid) {
    return;
  }
  geminiLoading.value = true;

  try {
    await uploadImageToSever();
  } catch (error) {
    geminiLoading.value = false;
    return;
  }

  // 转换图片为 base64
  let base64Url1: any = "";
  let base64Url2: any = "";

  try {
    [base64Url1, base64Url2] = await Promise.all([
      getBase64(materialData.value.objectName),
      getBase64(ruleForm.imageUrl)
    ]);
  } catch (error) {
    console.error("图片转 base64 失败:", error);
    return;
  }

  // 任务需求
  const TASK_REQUIREMENT = `
第一张图是模板图，第二张图是进行了标记的模板图。
请返回给我一个可以在模板图上渲染方块（包含方块信息）的参数数组，
我用来告诉用户哪些地方是可以修改的，你还应该告诉我里面的内容，比如产品卖点 可以修改卖点文案 内容为特色酥骨工艺。
特别注意如果type为text时，content中的label需要加上name前置，比如"产品卖点_卖点文案"。
参考格式：
[
  {
    id: "event_logo",
    name: "活动logo",
    type: "image",
    rect: {
      x: 0.275,
      y: 0.06,
      width: 0.125,
      height: 0.065
    }
  },
  {
    id: "product_selling_point",
    name: "1.产品卖点",
    content: [
      {
        label: "产品卖点_卖点文案",
        text: "特色酥骨工艺"
      },
    ]
    type: "text",
    rect: {
      x: 0.06,
      y: 0.23,
      width: 0.65,
      height: 0.075
    }
  },
]

\'
`;

  const params = {
    model: "gemini-3.1-pro",
    stream: true,
    messages: [
      {
        role: "system",
        content: "你是一名专业的电商主图设计与模板复用 AI"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${TASK_REQUIREMENT}`
          },
          {
            type: "image_url",
            image_url: {
              url: base64Url1
            }
          },
          {
            type: "image_url",
            image_url: {
              url: base64Url2
            }
          }
        ]
      }
    ]
  };

  transferGemini({
    urlParam: JSON.stringify(params)
  })
    .then((res: any) => {
      // console.log("中转gemini模型:", res);
      if (res.code === 200) {
        const content = res.data;
        console.log("截取后的内容:", content);

        try {
          const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            const jsonArray = JSON.parse(jsonBlockMatch[1].trim());

            console.log("解析出的数组:", jsonArray);

            ruleForm.editPhraseInfo = JSON.stringify(jsonArray, null, 2);
            editPhraseList.value = jsonArray;

            ElMessage.success("生成编辑词成功");
          } else {
            throw new Error("未找到 JSON 代码块");
          }
        } catch (error) {
          console.error("解析 AI 返回内容失败:", error);
          ElMessage.error("解析 AI 返回内容失败：" + (error as Error).message);
        }
      } else {
        ElMessage.error("生成编辑词失败:" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("生成编辑词失败:" + err.message);
    })
    .finally(() => {
      geminiLoading.value = false;
    });
};
//#endregion

// 监听 editPhraseList 变化，同步更新 ruleForm.editPhraseInfo
watch(
  editPhraseList,
  newVal => {
    ruleForm.editPhraseInfo = JSON.stringify(newVal, null, 2);
  },
  { deep: true }
);

// 监听 ruleForm.editPhraseInfo 变化，同步更新 editPhraseList
watch(
  () => ruleForm.editPhraseInfo,
  newVal => {
    if (newVal) {
      try {
        editPhraseList.value = JSON.parse(newVal);
      } catch (error) {
        console.error("解析编辑词失败:", error);
      }
    }
  }
);
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="编辑词"
      width="600"
      :close-on-click-modal="false"
      append-to-body
      align-center
    >
      <el-form
        ref="ruleFormRef"
        style="max-width: 600px"
        :model="ruleForm"
        :rules="rules"
        label-width="auto"
      >
        <el-form-item label="模板标记图" prop="image">
          <el-upload
            ref="uploadRef"
            action=""
            :auto-upload="false"
            list-type="picture-card"
            :limit="1"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            class="peidi-aiDrawingPro-material-editPhraseInfo-upload"
            :on-preview="handlePictureCardPreview"
          >
            <template #trigger>
              <el-icon><Plus /></el-icon>
            </template>

            <template #tip>
              <div class="el-upload__tip">
                限制上传1张图片，新图片会覆盖旧图片，大小不超过50MB
              </div>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item label="编辑词" prop="editPhraseInfo">
          <div class="w-full">
            <el-button
              :icon="Pointer"
              type="primary"
              :loading="geminiLoading"
              @click="handleGenerateDescriptorInfo"
            >
              点击AI自动生成编辑词
            </el-button>
          </div>

          <p class="text-xs text-gray-500 mt-2">
            编辑词不需要手动输入，点击AI自动生成即可，若不满意可重复生成
          </p>
          <p class="text-xs text-red-500 mt-2">
            *编辑词更改后需要重新导出配置表
          </p>

          <div class="mt-3 w-full">
            <el-radio-group v-model="editPhraseMode" text-color="#fff">
              <el-radio-button label="可视化模式" value="visual" />
              <el-radio-button label="详情模式" value="details" />
            </el-radio-group>
          </div>

          <div v-show="editPhraseMode === 'visual'" class="mt-3 w-full">
            <div
              class="max-h-96 overflow-y-auto border border-gray-200 rounded p-4"
            >
              <div
                v-for="(item, index) in editPhraseList"
                :key="item.id || index"
                class="mb-4 pb-4 border-b last:border-b-0"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700">
                    {{ index + 1 }}. {{ item.name }}
                  </span>
                  <el-tag
                    size="small"
                    :type="item.type === 'image' ? 'success' : 'primary'"
                  >
                    {{ item.type === "image" ? "图片" : "文本" }}
                  </el-tag>
                </div>

                <!-- 编辑 name -->
                <div class="mb-2">
                  <label class="text-xs text-gray-500 block mb-1">名称</label>
                  <el-input
                    v-model="item.name"
                    placeholder="请输入名称"
                    size="small"
                  />
                </div>

                <!-- 编辑 content 中的 label（仅当 type 为 text 且有 content 时） -->
                <div
                  v-if="
                    item.type === 'text' &&
                    item.content &&
                    item.content.length > 0
                  "
                >
                  <label class="text-xs text-gray-500 block mb-1"
                    >文案标签</label
                  >
                  <div
                    v-for="(contentItem, cIndex) in item.content"
                    :key="cIndex"
                    class="mb-2"
                  >
                    <el-input
                      v-model="contentItem.label"
                      :placeholder="`请输入标签（第${Number(cIndex) + 1}项）`"
                      size="small"
                    />
                    <el-input
                      v-if="contentItem.text !== undefined"
                      v-model="contentItem.text"
                      :placeholder="`请输入文案内容（第${Number(cIndex) + 1}项）`"
                      size="small"
                      class="mt-1"
                    />
                  </div>
                </div>

                <!-- 显示位置信息（只读） -->
                <div v-if="item.rect" class="mt-2 text-xs text-gray-400">
                  位置: x={{ item.rect.x }}, y={{ item.rect.y }}, 宽={{
                    item.rect.width
                  }}, 高={{ item.rect.height }}
                </div>
              </div>

              <div
                v-if="editPhraseList.length === 0"
                class="text-center text-gray-400 py-8"
              >
                暂无编辑词数据，请点击"点击AI自动生成编辑词"
              </div>
            </div>
          </div>

          <el-input
            v-show="editPhraseMode === 'details'"
            v-model="ruleForm.editPhraseInfo"
            class="mt-3"
            type="textarea"
            :rows="16"
            placeholder="编辑词不需要手动输入，点击AI自动生成即可"
          />
        </el-form-item>

        <el-form-item label="第一优先级提示词" prop="editPhraseInfoPrompt">
          <p class="text-xs text-gray-500">
            该模板全局通用的第一优先级提示词，批量生成时自动带入，不需要手动输入
          </p>
          <el-input
            v-model="ruleForm.editPhraseInfoPrompt"
            class="mt-3"
            type="textarea"
            :rows="4"
          />
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

    <el-dialog v-model="previewVisible" title="图片预览">
      <img w-full :src="previewImageUrl" alt="图片预览" />
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-material-editPhraseInfo-upload {
  // :deep(.el-upload-list__item-preview) {
  //   display: none !important;
  // }
  // :deep(.el-upload-list__item-delete) {
  //   margin-left: 0;
  // }
}
</style>
