<script setup lang="ts">
import { inject } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import RiImageAddLine from "@iconify-icons/ri/image-add-line";
import { DSL_SCHEMA } from "../../config/schema";
import {
  MAX_PIC_COUNT,
  GRSAI_MODEL_NAME,
  MAX_RETRY_COUNT
} from "../../config/drawing";
import { type ExcelTableItem } from "../../type/drawing";
import { newAiDraw, downloadFile } from "@/api/aiDraw";

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
const handleGenerateImagesClick = () => {
  if (props.selectedIds.length === 0) {
    ElMessage.warning("请勾选要生成图片的配置项！");
    return;
  }

  ElMessageBox.confirm(`确认开始生成图片？`, "生成图片", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      props.handleLoadingStatus(true);
      callServerGeneratedImages();
    })
    .catch(() => {});
};

//#region 调用线上API生成图片 逻辑交给服务器处理
const callServerGeneratedImages = async () => {
  // 过滤出选中的项
  const selectedItems = props.tableData.filter(item =>
    props.selectedIds.includes(item.uiid)
  );

  // 先等待获取所有的Promise工厂函数
  const factoryPromises = selectedItems.map(async item => {
    let itemTemp = { ...item };

    itemTemp.remark = `
      备注优先级最高的需求：
      - 结果图中抹除中间左侧红边框里的的产品图，变成空白。
      - 结果图中抹除中间右侧草坪上的产品图，空出来的位置需要和底图和谐。
      备注优先级低的需求：
      ${item.remark || ""}
    `;

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
      ElMessage.success("生成图片请求已经提交，后台处理中...");
      fetchAiDrawPage();
    })
    .catch(err => {
      console.error("至少有一个请求失败:", err);
      ElMessage.error("至少有一个请求失败:" + err.message);
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
          position: "top_left",
          change: "删除掉图片，要和底图和谐"
        },
        event_badge: {
          id: "double_festival",
          type: "image",
          image_ref: "double_festival_logo",
          position: "top_left",
          anchor: "canvas",
          offset: { x: 200, y: 0 },
          scale: 1.0,
          priority: "high",
          replaceable: true,
          change: "删除掉图片，要和底图和谐"
        },
        badge: {
          type: "official_flagship",
          text: "“官方旗舰店”",
          position: "top_right",
          style: {
            shape: "circle",
            color: "gold_black"
          },
          change: "删除掉图片，要和底图和谐"
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
          image: "rabbit_spine_honey_pack",
          position: "center",
          shadow: "soft",
          change: "删除掉图片，要和底图和谐"
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
              items: [
                { image_ref: "gift_food_1" },
                { image_ref: "gift_food_2" },
                { image_ref: "gift_food_3" },
                { image_ref: "gift_food_4" }
              ],
              change: "删除掉图片，要和底图和谐"
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
        ...item.productImage,
        ...item.templateImage,
        ...item.fullGiftImages,
        ...item.campaignLogoImage,
        ...item.brandLogoImage,
        ...item.shopLogoImage
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
        你是一名专业的电商主图设计与模板复用 AI。
        当前任务是【模板图片修改 / 清洗任务】，不是重新生成图片。

        ====================
        一、最高优先级 · 系统约束（必须严格遵守）
        ====================
        1. 本任务是“模板图片修改任务”，不是重新生成图片。
        2. 仅允许修改 new_dsl 与 old_dsl 存在差异的字段所对应的图像元素。
        3. old_dsl 未提及的任何元素，必须与模板图保持 100% 一致，不得修改。
        4. 严禁重新渲染、重绘或生成任何已有文字内容。
        5. 所有文字必须保持原有排版结构与字体风格（江城圆体）。
        6. 抹除操作仅针对图片类元素，不得误删文字、色块或结构元素。
        7. 若存在备注说明，备注说明优先级仅次于本系统约束，必须严格执行。

        ====================
        二、结构保护总则（极其重要）
        ====================
        - 模板中的分隔线、分割条、边界线、辅助线，均视为【结构元素】。
        - 结构元素：
          · 不属于 LOGO
          · 不属于图片素材
          · 不属于装饰贴图
        - 在任何抹除、替换、清理操作中，结构元素必须优先保护。
        - 任何误删、遮挡、重绘结构元素的行为，均视为严重错误。

        ====================
        三、总体目标
        ====================
        在保持模板整体版式、色彩体系、文字结构与信息层级完全不变的前提下，
        抹除指定的图片类元素，使模板成为可长期复用的“干净母版”。

        核心原则：
        - 文字信息必须完整保留（文字可后续修改，但不得被误删）
        - 仅抹除图片、贴图、LOGO 等图像素材
        - 抹除区域需与原背景自然融合，不得出现涂抹、断层或异常痕迹

        ====================
        四、图片输入与使用规则（非常重要）
        ====================
        已传入图片说明：

        1️⃣ 第 1 张：产品图片（默认不使用，除非备注中明确要求）
        2️⃣ 第 2 张：基础模板图（✅ 默认唯一用于修改与输出的模板）
        3️⃣ 第 3 张：赠品图片（默认不使用）
        4️⃣ 第 4 张：活动 LOGO（默认不使用）
        5️⃣ 第 5 张：品牌 LOGO（默认不使用）
        6️⃣ 第 6 张：店铺 LOGO（默认不使用）
        7️⃣ 第 7 张及之后的所有图片：
          - 为历史生成中效果良好、结构成熟的【优质模板参考图】
          - 仅用于参考抹除方式、背景融合方式与结构合理性
          - ❌ 不得直接复制、粘贴或替换其中任何元素
          - ❌ 不作为输出图或素材来源

        默认规则：
        - 若备注中未明确指定使用某张图片，则只允许使用第 2 张模板图
        - 其余图片一律视为“不可直接使用素材”

        ====================
        五、需要抹除的模板元素（精确执行）
        ====================

        1️⃣ 模板图【中间左侧红色边框区域】：
        - 抹除其中所有【图片类元素】（赠品图片、产品图片、插画贴图等）
        - 必须完整保留：
          · 所有文字内容
          · 数字、符号
          · “赠”字角标
          · 文案底色、红色边框与排版结构

        2️⃣ 模板图【中间左侧】若存在独立产品图片：
        - 仅抹除产品图片本体
        - 不得影响周围文字、边框或背景

        3️⃣ 模板图【中间右侧】：
        - 抹除草坪上的产品图片
        - 同时抹除该产品所依附的草坪区域
        - 抹除后该区域需自然过渡为背景，不得残留草坪纹理、阴影或边缘痕迹

        4️⃣ 模板图【右上角】：
        - 抹除店铺 LOGO
        - 背景需连续、自然，不得出现突兀色块

        5️⃣ 模板图【左上角】（重点规则）：
        - 抹除品牌 LOGO（仅 LOGO 图形本体，不包含任何分隔结构）
        - 抹除活动 LOGO / 活动标识（仅 LOGO 图形本体，不包含任何分隔结构）
        - 品牌 LOGO 与活动 LOGO 之间的白色分隔线：
          · 属于模板固定【结构元素】
          · 非 LOGO、非装饰、非图片素材
          · 必须完整保留
          · 位置、长度、粗细、颜色均不得发生任何变化
          · 抹除蒙版不得覆盖该分隔线
          · 若该分隔线被删除、遮挡或重绘，视为严重违规
        - 不得影响顶部背景纹理与装饰结构

        ====================
        六、文字清晰度与汉字纠错强制要求
        ====================
        - 所有已有文字必须保持印刷级清晰度
        - 不得模糊、变形、错字或笔画粘连
        - 字体保持模板原样（江城圆体）

        【汉字特殊注意（纠错提示）】
        - “爵”：上中下结构，上部为扁“罒”，非“目”，整体修长
        - “宴”：宝盖头（宀）下为“日” + “安”

        ====================
        七、输入参数（仅作为执行依据）
        ====================
        - old_dsl: ${old_dsl}
        - new_dsl: ${new_dsl}
        - 备注说明: ${item.remark}

        ====================
        八、最终输出要求
        ====================
        - 仅输出修改后的模板图
        - 不新增任何未说明的元素
        - 输出结果必须为可长期复用的“干净模板母版”
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
        // console.log("newAiDraw: ", res);
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
          @click="handleGenerateImagesClick()"
          :loading="loading"
          :disabled="isEdit"
          type="primary"
        >
          <template #icon>
            <IconifyIconOffline :icon="RiImageAddLine" />
          </template>
          开始绘图
        </el-button>
      </div>
    </div>
  </el-card>
</template>
