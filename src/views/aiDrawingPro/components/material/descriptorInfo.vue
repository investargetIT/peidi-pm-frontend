<script setup lang="ts">
import { ElMessage, FormInstance, FormRules } from "element-plus";
import { nextTick, reactive, ref } from "vue";
import { updateMaterial, transferGemini, downloadFile } from "@/api/aiDraw";
import { Pointer } from "@element-plus/icons-vue";
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
  descriptor: "",
  mapping: ""
});
const rules = reactive<FormRules>({});

const initDetailForm = (data: any) => {
  materialData.value = data;
  dialogVisible.value = true;
  geminiLoading.value = false;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    const descriptorInfo = JSON.parse(materialData.value.type)?.descriptorInfo;
    if (descriptorInfo) {
      Object.keys(descriptorInfo).forEach(key => {
        ruleForm[key] = descriptorInfo[key];
      });
    }
  });
};

defineExpose({ initDetailForm });

const submitForm = async (formEl: FormInstance | undefined) => {
  // console.log("描述词:", materialData.value);
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
          descriptorInfo: ruleForm
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
const handleGenerateDescriptor = async () => {
  // 转换图片为 base64
  let base64Url1: any = "";
  let base64Url2: any = "";

  try {
    [base64Url1, base64Url2] = await Promise.all([
      getBase64("ai/draw/origin/京东模板_test_26191136.png"),
      getBase64(materialData.value.objectName)
    ]);
  } catch (error) {
    console.error("图片转 base64 失败:", error);
    return;
  }

  // 任务需求
  const TASK_REQUIREMENT = `
我需要做一个通用模板图（第一张图）和全新模板图（第二张图）的配置表映射
即把通用模板图的配置表单的参数映射过去，这样我就可以根据通用模板图的表单来给全新模板图出图，请你给出一份供AI使用的映射内容 和 一份 表单参数对照表（告诉用户表单中文名对应全新模板图哪块位置）

可参考的映射内容：
const new_descriptor = \`
【必须执行的抹除规则】 1. 抹除正中央的产品大图（一堆骨头咬胶及木碗），还原米色背景。 2. 抹除右侧白色赠品框内的产品小图（狗粮包装），注意！保留白色框体、粉色 Header 块及黄色的价值标签框。 3. 抹除顶部右上角的日期文字，还原粉色背景。 【文本映射与排版规则（必须将变量替换为实际文本内容！）】 1. 顶部主大字映射：将原黑色粗体字“磨牙洁齿 安抚情绪”替换为变量 {item.normalSellingPoints}，保持居中排版与大字号。 2. 主标题下方小字映射：将原“多口味迷你咬胶50支”替换为变量 {item.productName}，保持居中黑字。 3. 右上角活动时间映射：将原粉色背景上的白字“活动售卖 02/24 00:00 - ...”替换为变量 {item.activityTime}，保持右对齐白字。 4. 右侧赠品框映射： - 顶部粉色区域白字“前100名赠”替换为：{item.fullGiftTitle} - 底部白底区域黑字“赠编织球7只”替换为：{item.fullGiftDescription} 5. 左下角价格映射： - 将原白色小字“预估到手价 ¥”替换为：{item.handPriceTitle} - 将原巨大的白色数字“94”替换为变量 {item.handPrice} 中的数字部分（去掉¥符号，保持超大字号展示）。 6. 右下角营销词映射： - 提取 {item.profitPoints} 中的信息进行拆分排版（或全部放上），覆盖原粉色底白字的“官方立减享85折”和黄色底黑字的“下单立减24”区域。保持字体居中、清晰。
\`

可参考的表单参数对照表：
const new_descriptor_mapping = \`
产品图片: 新模板的左侧产品图
产品名： 新模板的顶部标题
产品卖点-高亮：新模板的顶部标题下的描述文字
到手价-标题：新模板的左下角的预估到手价标题
到手价-价格：新模板的左下角的价格
利益点：新模板的右下角的下单立减24
活动时间：新模板的右上角的活动售卖时间

若通用模板的表单上述参数不足数量不足，则告知用户在补充描述里填写，比如：
请在补充描述里填写表单：
活动售卖：新模板右上角的活动售卖标题
官方立减享85折：新模板右下角的粉底标题
\`

请你给出效果最好的映射内容和表单参数对照表，表单参数对照表越简洁越好，只是告知用户需要填写哪些参数（用中文表示），返回的形式是：

\`\`\`javascript
const result = {
  "new_descriptor": "新模板描述",
  "new_descriptor_mapping": "新模板描述参数对照表"
}
\`\`\`

让我可以解析result
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
            text: `
${TASK_REQUIREMENT}

第一张图 通用模板图片
第二张图 全新模板图片

已经实现的内容：
根据通用模板图片生成配置表单，表单参数如下：
const EXCEL_TABLE_ITEM_DEFAULT = {
  status: 1,
  uuid: null,
  uiid: null,
  id: "",
  templateImage: [] as string[], // 现在这里存储的是图片的base64字符串数组
  imageSize: "4K" as string, // 输出图像大小
  campaignLogoImage: [] as string[], // 活动LOGO图片
  highlightedSellingPoints: "特色酥骨工艺" as string, // 产品卖点-高亮
  normalSellingPoints: "特色酥骨工艺 蜜汁兔脊" as string, // 产品卖点-全部
  productName: "兔脊骨120g" as string, // 产品名
  productImage: [] as string[], // 产品图片
  fullGiftTitle: "全场满199送" as string, // 全场满赠-标题
  fullGiftDescription: "爵宴狗粮随行装试吃（50g*4）" as string, // 全场满赠-描述
  fullGiftTags: "赠" as string, // 全场满赠-标签
  fullGiftImages: [] as string[], // 全场满赠-图片
  handPriceTitle: "到手价" as string, // 到手价-标题
  handPrice: "￥34.3" as string, // 到手价-价格
  profitPoints: "会员抢券 全场满199-15" as string, // 利益点
  activityTime: "活动时间：12/15 00:00:00 - 12/25 23:59:59" as string, // 活动时间
  remark: "" as string, // 备注
  resultImages: [] as string[], // 生成的图片
  betterTemplateImage: {} as object, // 更好的模板图
  shopLogoImage: [] as string[], // 店铺LOGO
  brandLogoImage: [] as string[], // 品牌LOGO
  descriptor: "" as string, // 描述词
  mapping: "" as string // 参数对照
};

已经实现一份通用prompt:
const prompt = \`
你是一名专业的电商主图设计与模板排版 AI。
当前任务是【模板图片修改 / 文本与图像替换任务】，不是重新生成整张图片。

【最高优先级・系统约束】
1. [descriptor 描述词] 具有绝对最高优先级，它定义了当前模板的具体结构和修改映射。
2. [remark 补充说明] 具有第二优先级，用于补充描述或特殊要求。
3. 所有修改必须基于「第 2 张图片（模板图）」进行。
4. 严禁整体重绘、重新生成、重新排版或改变未提及的图片结构。
5. 所有抹除操作必须为"局部、精确、可控"，抹除后需自然还原底图背景，不得留痕。
6. 替换文本时，必须使用输入参数中对应的【真实变量值】，绝对禁止直接将英文变量名（如 item.productName）作为文字印在图片上！
7. 文本渲染要求印刷级清晰度，字体风格与排版对齐方式需跟随原模板相应位置的设定。如果文字含有"\n"，代表换行，不要将"\n"印出。

────────────────────
【图片角色说明】
- 第 1 张图片：产品主图素材（仅在用户明确要求使用时才可使用）
- 第 2 张图片：基础模板图（唯一实际修改底板）
- 第 3 张图片：赠品图片素材（仅在用户明确要求使用时才可使用）
- 第 4 张图片：活动 LOGO 素材（仅在用户明确要求使用时才可使用）
- 第 5 张图片：店铺/品牌 LOGO 素材（仅在用户明确要求使用时才可使用）
- 第 6 张及之后的图片：历史优秀参考图（仅供参考画质和干净度）

────────────────────
【动态表单参数字典】（核心数据源）
以下是你将会接收到的数据内容定义，请根据 [descriptor 描述词] 的指令，提取以下对应的值填入图片：
- imageSize: 图片分辨率要求
- highlightedSellingPoints: 核心高亮卖点（短词）
- normalSellingPoints: 常规产品卖点/主标题
- productName: 产品名称/规格（副标题）
- fullGiftTitle: 赠品模块的主标题（如"全场满199送"）
- fullGiftDescription: 赠品具体描述（如"狗粮试吃装"）
- fullGiftTags: 赠品角标（如"赠"）
- handPriceTitle: 价格前缀文案（如"到手价"）
- handPrice: 具体的金额数字（如"￥34.3"）
- profitPoints: 利益点/优惠券文案（如"全场满199-15"）
- activityTime: 活动时间范围说明
- remark: 补充说明，如“主题色变成绿色”

────────────────────
【输入参数】
- 表单数据载荷：{item}  (此处包含上述字典的具体值)
- 模板专属 descriptor 描述词：{item.descriptor}

────────────────────
【执行准则】
请严格按照【模板专属 descriptor 描述词】中的“区域抹除要求”和“元素映射关系”，提取【表单数据载荷】中的真实文字内容，替换到模板的指定位置。
\`

针对通用模板，有一份专属的描述词：
const descriptor = \`
【必须执行的抹除规则】 1. 抹除中间左侧红色边框模块（整体抹除边框、背景、内部文字、图片，还原为绿底）。 2. 抹除中间独立产品图及下方阴影。 3. 抹除中间右侧草坪及草坪上的产品图，还原绿底。 4. 抹除右上角圆形店铺 LOGO 及其底色。 5. 整体抹除左上角品牌与活动 LOGO 区域（包括 LOGO 本身及中间的竖线），还原绿底。 【文本映射与排版规则（必须将变量替换为实际文本内容！）】 1. 顶部主标题映射：将原“特色酥骨工艺 蜜汁兔脊”替换为变量 {item.normalSellingPoints}。其中如果包含变量 {item.highlightedSellingPoints} 的内容，该部分文字需标为橙红色。注意：排版时右侧不能越过右上角原圆形 LOGO 的占位区域，过长需换行或缩小。 2. 标题下方绿色胶囊框文字映射：将原“兔脊骨120g”替换为变量 {item.productName}。注意：承载该文字的绿色背景方块必须完整保留，且必须为纯绿色，不准变色。 3. 底部红色价格栏映射：左下角文字替换为“{item.handPriceTitle} {item.handPrice}”。 4. 底部红色优惠栏映射：正下方文字替换为 {item.profitPoints}。 5. 底部黑色小字映射：替换为 {item.activityTime}。
\`
`
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

  geminiLoading.value = true;
  transferGemini({
    urlParam: JSON.stringify(params)
  })
    .then((res: any) => {
      // console.log("中转gemini模型:", res);
      if (res.code === 200) {
        const content = res.data;
        console.log("截取后的内容:", content);

        try {
          const codeBlockMatch = content.match(/```javascript\s*([\s\S]*?)```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            let codeContent = codeBlockMatch[1].trim();

            codeContent = codeContent.replace(/const\s+result\s*=\s*/, "");

            codeContent = codeContent.replace(/`([^`]*)`/g, (match, p1) => {
              return JSON.stringify(p1);
            });

            const result = JSON.parse(codeContent);

            console.log("解析出的 result:", result);

            if (result.new_descriptor) {
              ruleForm.descriptor = result.new_descriptor.trim();
            }

            if (result.new_descriptor_mapping) {
              ruleForm.mapping = result.new_descriptor_mapping.trim();
            }

            ElMessage.success("生成描述词成功");
          } else {
            throw new Error("未找到 JavaScript 代码块");
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
      title="描述词"
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
            :loading="geminiLoading"
            @click="handleGenerateDescriptor"
          >
            生成描述词
          </el-button>
        </el-form-item>
        <el-form-item label="描述词" prop="descriptor">
          <el-input v-model="ruleForm.descriptor" type="textarea" :rows="16" />
        </el-form-item>
        <el-form-item label="参数对照" prop="mapping">
          <el-input v-model="ruleForm.mapping" type="textarea" :rows="12" />
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
  </div>
</template>
