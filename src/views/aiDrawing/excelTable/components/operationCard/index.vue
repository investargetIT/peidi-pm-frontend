<script setup lang="ts">
import { inject } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { DSL_SCHEMA } from "../../../dev/constants";
import {
  MAX_PIC_COUNT,
  GRSAI_MODEL_NAME,
  MAX_RETRY_COUNT
} from "../../utils/constants";
import { type ExcelTableItem } from "../../type/index";
import { newAiDraw, downloadFile } from "@/api/aiDraw";
import { th } from "element-plus/es/locale/index.mjs";

const props = defineProps({
  loading: {
    type: Boolean,
    required: true
  },
  tableData: {
    type: Array as PropType<ExcelTableItem[]>,
    required: true
  },
  handleLoadingStatus: {
    type: Function as PropType<(status: boolean) => void>,
    required: true
  },
  isEdit: {
    type: Boolean,
    required: true
  },
  selectedIds: {
    type: Array as PropType<string[]>,
    required: true
  }
});

const fetchAiDrawPage = inject<() => Promise<any>>("fetchAiDrawPage");

//#region 生成图片逻辑
// 点击开始绘图
const handleGenerateImagesClick = (isTemplate: boolean = false) => {
  if (props.selectedIds.length === 0) {
    ElMessage.warning("请勾选要生成图片的配置项！");
    return;
  }

  ElMessageBox.confirm(`确认生成图片？`, "生成图片", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      props.handleLoadingStatus(true);
      callServerGeneratedImages(isTemplate);
    })
    .catch(() => {});
};

//#region 调用线上API生成图片 逻辑交给服务器处理
const callServerGeneratedImages = async (isTemplate: boolean = false) => {
  // 过滤出选中的项
  const selectedItems = props.tableData.filter(item =>
    props.selectedIds.includes(item.uiid)
  );

  // 先等待获取所有的Promise工厂函数
  const factoryPromises = selectedItems.map(async item => {
    let itemTemp = { ...item };
    if (isTemplate) {
      itemTemp.remark = `
      备注优先级最高的需求：
      - 结果图中抹除中间左侧红边框里的的产品图，变成空白。
      - 结果图中抹除中间右侧草坪上的产品图，空出来的位置需要和底图和谐。
      备注优先级低的需求：
      ${item.remark || ""}
    `;
    }

    // 等待formatParamsToPromises完成，获取工厂函数
    return await formatParamsToPromises(itemTemp, item);
  });

  // 等待所有工厂函数准备完成
  const requestFactories = await Promise.all(factoryPromises);

  // console.log("requestFactories", requestFactories);

  // // 然后并行执行所有请求
  Promise.all(requestFactories.map(factory => factory()))
    .then(results => {
      // console.log("所有请求成功:", results);
      ElMessage.success("生图请求已经提交，后台处理中...");
      fetchAiDrawPage();
    })
    .catch(err => {
      console.error("至少有一个请求失败:", err);
      ElMessage.error("至少有一个生图请求失败，请检查配置！" + err.message);
    })
    .finally(() => {
      props.handleLoadingStatus(false);
    });
};

const formatParamsToPromises = async (
  item: ExcelTableItem,
  sourceItem: ExcelTableItem
) => {
  const params = await formatParams();

  async function formatParams() {
    const fullGiftImagesLen = item.fullGiftImages.length;
    const old_dsl = JSON.stringify(DSL_SCHEMA);
    const new_dsl = JSON.stringify(formatPromptDSLSchema());

    function formatPromptDSLSchema() {
      return {
        canvas: {
          size: "1242x1242",
          background: {
            color: "#F6F1E8",
            texture: "traditional_wave_pattern"
          }
        },
        brand: {
          logo: "meatyway",
          position: "top_left"
        },
        event_badge: {
          id: "double_festival",
          type: "image",
          image_ref: "提供的URL里的第2张图",
          position: "top_left",
          anchor: "canvas",
          offset: { x: 200, y: 0 },
          scale: 1.0,
          priority: "high",
          replaceable: true
        },
        badge: {
          type: "official_flagship",
          text: "“官方旗舰店”",
          position: "top_right",
          style: {
            shape: "circle",
            color: "gold_black"
          }
        },
        title: {
          text: `“${item.normalSellingPoints}”`,
          highlight: {
            text: `“${item.highlightedSellingPoints}”`,
            color: "#FF4D2E"
          },
          position: "center_top",
          font: "bold"
        },
        subtitle: {
          text: `“${item.productName}”`,
          style: {
            background: "#1F6B4A",
            color: "white",
            radius: "pill"
          }
        },
        product: {
          image: "提供的URL里的第3张图，把第3张图原封不动放到指定位置即可",
          position: "center",
          shadow: "soft"
        },
        promo_box: {
          position: "left_center",
          border: "red",
          header: {
            title: `“${item.fullGiftTitle}”`,
            badge: `“${item.fullGiftTags}”`
          },
          body: {
            text: `“${item.fullGiftDescription}”`,
            gift_items: {
              layout: "horizontal",
              spacing: "small",
              item: `删除掉原先的图片内容，并且用提供的URL里的第4张到第${4 + fullGiftImagesLen - 1}张图片，只需要把它们做缩放然后原封不动地从左到右，从上到下，堆叠起来，图片上的字体一定要保持原图，不能有改动或变形！`
            }
          }
        },
        price: {
          label: `“${item.handPriceTitle}”`,
          value: `“${item.handPrice}”`,
          position: "bottom_left",
          style: {
            color: "white",
            background: "red",
            font: "bold"
          }
        },
        coupon: {
          text: `“${item.profitPoints}”`,
          position: "bottom_center",
          style: {
            background: "red",
            color: "white"
          }
        },
        activity_time: {
          text: `“${item.activityTime}”`,
          position: "bottom",
          font_size: "small"
        }
      };
    }
    async function formatUrls() {
      const temp = [
        ...item.templateImage,
        ...item.campaignLogoImage,
        ...item.productImage,
        ...item.fullGiftImages
      ];

      const betterTemplateImage = item.betterTemplateImage;
      if (Object.keys(betterTemplateImage).length > 0) {
        temp.push(...Object.values(betterTemplateImage));
      }

      // console.log("图片", temp);

      // 直接创建 Promise 数组，而不是函数数组
      const tempBase64Promises = temp.map(item => {
        return getBase64(item);
      });

      const tempBase64Results = await Promise.all(tempBase64Promises);

      // console.log("base64", tempBase64Results);

      return tempBase64Results;
    }
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

    return {
      model: GRSAI_MODEL_NAME,

      prompt: `
        【最高优先级 · 系统约束】
        1. 本任务是“模板图片修改任务”，不是重新生成图片。
        2. 仅允许修改 new_dsl 与 old_dsl 存在差异的字段。
        3. old_dsl 未提及的任何元素，必须与模板图保持 100% 一致，不得修改。
        4. 严禁重新渲染、重绘或生成任何已有文字内容。
        5. 生成最高清的图片，把小字体放大。
        7. 如果有备注，必须严格按照备注说明执行。

        【模板与图片规则】
        1. 提供的第 1 张图为基础模板图，其结构与元素以 old_dsl 为准。
        2. 提供的第 2 张图用于 event_badge.image_ref，必须完整替换该元素，颜色与样式保持与原图保持一致。
        3. 若传入图片数量 > ${3 + fullGiftImagesLen}，则多余图片为历史合格结果，仅用于参考风格，不作为修改对象。

        【执行指令（仅做差异修改）】
        1. 对比 new_dsl 与 old_dsl，仅修改存在差异的字段对应的图像元素。
        2. 所有修改均应在原图基础上进行“局部替换”，不得影响其他元素。

        【文字清晰度强制要求（仅适用于已有文字）】
        - 已有文字必须保持印刷级清晰度，不得模糊、变形或错字。
        - 字体保持模板图原样（江城圆体），禁止替换字体。
        - 笔画清晰、不粘连，边缘锐利。

        【汉字特殊注意（纠错提示）】
        - “爵”：上中下结构，上部为扁“罒”，非“目”，整体修长。
        - “宴”：宝盖头（宀）下为“日”+“安”。

        【输入参数】
        - old_dsl: ${old_dsl}
        - new_dsl: ${new_dsl}
        - 备注说明: ${item.remark}
      `,

      aspectRatio: "1:1",
      imageSize: item.imageSize,
      urls: await formatUrls(),
      shutProgress: false
    };
  }

  // 返回一个不执行的Promise工厂函数
  return () => {
    return newAiDraw({
      fields: JSON.stringify(sourceItem),
      maxRetries: MAX_RETRY_COUNT,
      remark: JSON.stringify({
        uiid: item.uiid,
        moduleName: "京东模板"
      }),
      size: MAX_PIC_COUNT,
      urlParam: JSON.stringify(params),
      uuid: item.uiid
    })
      .then(res => {
        // console.log("新增画图: ", res);
        return res;
      })
      .catch(err => {
        console.log("err", err);
        throw err; // 重新抛出错误
      });
  };
};
//#endregion
</script>

<template>
  <el-card shadow="never" style="border-radius: 10px" class="mb-[10px]">
    <div class="flex justify-between items-center">
      <p class="text-[14px] text-[#666] font-[500]">
        仅生成勾选的配置项对应的图片，每条数据生成3张图，单次生成时间约为1~5分钟
      </p>
      <div class="flex items-end">
        <el-button
          @click="handleGenerateImagesClick(true)"
          :loading="loading"
          :disabled="isEdit"
        >
          AI智能留白
        </el-button>
        <el-button
          type="primary"
          @click="handleGenerateImagesClick()"
          :loading="loading"
          :disabled="isEdit"
        >
          AI一键创作
        </el-button>
      </div>
    </div>
  </el-card>
</template>
