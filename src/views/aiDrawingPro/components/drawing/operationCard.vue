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
            title: "全场满199送",
            badge: "赠"
          },
          body: {
            text: "爵宴狗粮随行装试吃（50g*4）",
            gift_items: {
              layout: "horizontal",
              spacing: "small",
              items: [
                { image_ref: "gift_food_1" },
                { image_ref: "gift_food_2" },
                { image_ref: "gift_food_3" },
                { image_ref: "gift_food_4" }
              ]
            }
          },
          change: "删除整块内容，要和底图和谐"
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
        // ...item.brandLogoImage,
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

        【最高优先级 · 系统约束】
        1. 所有修改必须基于「第 2 张图片（模板图）」进行。
        2. 严禁整体重绘、重新生成、重新排版或重做图片结构。
        3. 未被明确允许修改的任何元素，必须与模板图保持 100% 一致。
        4. 所有抹除操作必须为“局部、精确、可控”，不得误伤其他区域。
        5. 若备注中存在与默认规则冲突的说明，以备注为最高优先级。
        6. 文字里的“\n”，表示换行，不要保留在文字里。

        ────────────────────
        【图片角色说明（非常重要）】
        - 第 1 张图片：产品图片（仅在备注明确要求使用时才可使用）
        - 第 2 张图片：基础模板图（唯一实际修改对象）
        - 第 3 张图片：赠品图片（仅在备注明确要求使用时才可使用）
        - 第 4 张图片：活动 LOGO（仅在备注明确要求使用时才可使用）
        - 第 5 张图片：店铺 LOGO（仅在备注明确要求使用时才可使用）
        - 第 6 张及之后的图片：
          · 为历史生成中结构正确、抹除干净的参考图
          · 仅用于参考效果与干净程度
          · 不作为修改对象

        ────────────────────
        【默认执行规则】
        - 若备注未明确指定“使用某张图片”：
          · 只允许使用第 2 张模板图
          · 其余图片全部忽略，不得引用、不作为素材来源

        ────────────────────
        【必须执行的默认抹除规则】

        1️⃣ 中间左侧红色边框模块（整体删除）：
        - 该区域视为完整功能模块
        - 必须整体抹除：边框、背景、内部文字、图片、角标与装饰
        - 抹除后自然还原为模板背景纹理，不得留痕

        2️⃣ 中间左侧独立产品图片（若存在）：
        - 抹除产品图片本体
        - 不得影响周围背景纹理、装饰线条或文字

        3️⃣ 中间右侧草坪区域：
        - 抹除草坪上的产品图
        - 同时抹除草坪本体
        - 与模板背景自然融合、连续

        4️⃣ 右上角店铺 LOGO：
        - 抹除 LOGO 图形本体
        - 背景自然延展，不得残留轮廓或阴影

        5️⃣ 左上角品牌 / 活动 LOGO 整体区域（重要修改点）：

        【整体抹除定义】
        - 以下元素需作为「同一视觉模块」整体抹除：
          · 品牌 LOGO 图形本体
          · 活动 LOGO 图形本体
          · 两者之间的白色竖向分隔线

        【执行要求】
        - 该区域抹除后：
          · 不得残留任何 LOGO、竖线或装饰痕迹
          · 不得保留原有结构线轮廓
          · 不得出现裁切边、断裂或不自然过渡
        - 顶部绿色背景纹理需连续、自然、无断层
        - 抹除行为不得影响其他顶部装饰结构

        【重要说明】
        - 原模板中的白色竖线：
          · 本次任务中不再视为结构元素
          · 明确属于抹除对象
          · 必须完全移除

        ────────────────────
        【结构保护总则（除明确抹除项外）】
        - 未被列入抹除清单的分隔线、装饰线条：
          · 仍视为模板结构元素
          · 必须完整保留

        ────────────────────
        【文字清晰度强制要求（仅针对已有文字）】
        - 严禁重新渲染、重绘或生成任何已有文字
        - 字体保持模板原样（江城圆体）
        - 印刷级清晰度，笔画清晰、不变形、不粘连

        ────────────────────
        【汉字特殊注意（纠错提示）】
        - “爵”：上中下结构，上部为扁“罒”，非“目”
        - “宴”：宝盖头（宀）下为“日” + “安”

        ────────────────────
        【输入参数】
        - old_dsl: ${old_dsl}
        - new_dsl: ${new_dsl}
        - 备注说明: ${item.remark}

        ────────────────────
        【最终目标】
        - 输出一张结构干净、抹除自然、模板一致的结果图
        - 左上角 LOGO 区域应完全清空，仅保留自然背景
        - 整体效果接近第 6 张及之后提供的优秀参考模板图
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
