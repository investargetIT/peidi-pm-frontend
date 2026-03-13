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
import { nextTick, reactive, ref } from "vue";
import {
  updateMaterial,
  transferGemini,
  downloadFile,
  uploadDraw
} from "@/api/aiDraw";
import { Pointer } from "@element-plus/icons-vue";
import { generateID } from "../../utils/general/index";
// import imageUrl1 from "@/views/debug/assets/绘图1.png";
// import imageUrl2 from "@/views/debug/assets/绘图2.jpg";

const props = defineProps({
  fetchMaterialPage: {
    type: Function,
    required: true
  }
});

const dialogVisible = ref(false);
const loading = ref(false);
const geminiLoading = ref(false);

const materialData = ref(null);

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  editPhraseInfo: "",
  imageUrl: "",
  image: null
});
const rules = reactive<FormRules>({
  image: [{ required: true, message: "请上传模板标记图", trigger: "change" }]
});

const initDetailForm = (data: any) => {
  materialData.value = data;
  dialogVisible.value = true;
  geminiLoading.value = false;
  ruleForm.image = null;

  nextTick(() => {
    uploadRef.value?.clearFiles();
    ruleFormRef.value?.resetFields();

    const editPhraseInfo = JSON.parse(materialData.value.type)?.editPhraseInfo;
    if (editPhraseInfo) {
      Object.keys(editPhraseInfo).forEach(key => {
        ruleForm[key] = editPhraseInfo[key];
      });

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
            ElMessage.success("描述词保存成功");
            props.fetchMaterialPage();
            dialogVisible.value = false;
          } else {
            ElMessage.error("保存描述词失败:" + res?.msg);
          }
        })
        .catch(error => {
          ElMessage.error("保存描述词失败:" + error.message);
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
我用来告诉用户哪些地方是可以修改的，你还应该告诉我里面的内容，比如产品卖点 可以修改卖点文案 内容为特色酥骨工艺
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
        label: "卖点文案",
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

            ElMessage.success("生成描述词成功");
          } else {
            throw new Error("未找到 JSON 代码块");
          }
        } catch (error) {
          console.error("解析 AI 返回内容失败:", error);
          ElMessage.error("解析 AI 返回内容失败：" + (error as Error).message);
        }
      } else {
        ElMessage.error("生成描述词失败:" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("生成描述词失败:" + err.message);
    })
    .finally(() => {
      geminiLoading.value = false;
    });
};
//#endregion
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
        <el-form-item label="" prop="">
          <el-button
            :icon="Pointer"
            type="primary"
            @click="handleGenerateDescriptorInfo"
            :loading="geminiLoading"
          >
            生成编辑词
          </el-button>
        </el-form-item>

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
          <el-input
            type="textarea"
            :rows="16"
            v-model="ruleForm.editPhraseInfo"
          />
        </el-form-item>

        <el-form-item>
          <div class="flex justify-end w-full">
            <el-button
              type="primary"
              @click="submitForm(ruleFormRef)"
              :loading="loading"
            >
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-material-editPhraseInfo-upload {
  :deep(.el-upload-list__item-preview) {
    display: none !important;
  }
  :deep(.el-upload-list__item-delete) {
    margin-left: 0;
  }
}
</style>
