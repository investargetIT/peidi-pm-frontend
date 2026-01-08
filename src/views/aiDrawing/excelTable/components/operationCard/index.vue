<script setup lang="ts">
import { ref } from "vue";
import { DSL_SCHEMA } from "@/views/aiDrawing/dev/constants";
import { ElMessage, ElMessageBox } from "element-plus";
import { GRSAI_API_KEY } from "@/views/aiDrawing/excelTable/utils/constants";
import { type ExcelTableItem } from "@/views/aiDrawing/excelTable/type/index";
import {
  MAX_PIC_COUNT,
  GRSAI_MODEL_NAME
} from "@/views/aiDrawing/excelTable/utils/constants";

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

const logsList = ref<string[]>([]);
const addLog = (log: string) => {
  logsList.value.unshift("[" + new Date().toLocaleString() + "] " + log);
};

//#region 生成图片逻辑
const requestList = ref<(() => Promise<any>)[]>([]);
const failedRequestsList = ref<(() => Promise<any>)[]>([]);

const handleGenerateImagesClick = () => {
  if (props.selectedIds.length === 0) {
    ElMessage.warning("请选择要生成图片的配置项！");
    return;
  }

  ElMessageBox.confirm(`确认生成图片？`, "生成图片", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      prepareData();
    })
    .catch(() => {
      // message("Delete operation cancelled", { type: "info" });
    });
};

// 数据准备操作
const prepareData = () => {
  requestList.value = [];
  failedRequestsList.value = [];

  // 过滤出选中的项
  const selectedItems = props.tableData.filter(item =>
    props.selectedIds.includes(item.id)
  );

  selectedItems.forEach(item => {
    for (let i = 0; i < MAX_PIC_COUNT; i++) {
      // 存入Promise工厂函数，但不立即执行
      requestList.value.push(() => sendDrawingRequest(item));
    }
  });

  handleGenerateImages();
};

const handleGenerateImages = async () => {
  props.handleLoadingStatus(true);
  addLog("开始生成图片...");

  try {
    addLog(`共${requestList.value.length}个生成请求开始处理...`);

    // 执行所有Promise工厂函数，获取实际的Promise数组
    const promises = requestList.value.map(factory => factory());

    // 等待所有请求完成（无论成功或失败）
    const results = await Promise.allSettled(promises);

    // 处理每个请求的结果
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        addLog(`请求${index + 1}成功，图片URL: ${result.value.results[0].url}`);
      } else {
        addLog(`请求${index + 1}失败，错误信息: ${result.reason}`);
        // 将失败的请求重新添加到重试列表
        // failedRequestsList.value.push(() => sendDrawingRequest(result.reason.item || props.tableData[Math.floor(index / MAX_PIC_COUNT)]));
      }
    });
  } catch (error: any) {
    console.error("请求失败:", error);
  } finally {
    if (failedRequestsList.value.length > 0) {
      addLog(`共${failedRequestsList.value.length}个请求失败，将重试...`);

      requestList.value = [...failedRequestsList.value];
      failedRequestsList.value = [];
      await handleGenerateImages();
    } else {
      addLog("🎇所有图片生成完成！");
      ElMessage.success("所有图片生成完成！");
      props.handleLoadingStatus(false);
    }
  }
};

// 发送图片生成请求
const sendDrawingRequest = async (item: ExcelTableItem) => {
  const params = formatParams();

  function formatParams() {
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
          text: "官方旗舰店",
          position: "top_right",
          style: {
            shape: "circle",
            color: "gold_black"
          }
        },
        title: {
          text: item.normalSellingPoints,
          highlight: {
            text: item.highlightedSellingPoints,
            color: "#FF4D2E"
          },
          position: "center_top",
          font: "bold"
        },
        subtitle: {
          text: item.productName,
          style: {
            background: "#1F6B4A",
            color: "white",
            radius: "pill"
          }
        },
        product: {
          image: "提供的URL里的第3张图",
          position: "center",
          shadow: "soft"
        },
        promo_box: {
          position: "left_center",
          border: "red",
          header: {
            title: item.fullGiftTitle,
            badge: item.fullGiftTags
          },
          body: {
            text: item.fullGiftDescription,
            gift_items: {
              layout: "horizontal",
              spacing: "small",
              item: "提供的URL里的第4张以及之后的所有图片, 把它们堆叠成有层次感再显示"
            }
          }
        },
        price: {
          label: item.handPriceTitle,
          value: item.handPrice,
          position: "bottom_left",
          style: {
            color: "white",
            background: "red",
            font: "bold"
          }
        },
        coupon: {
          text: item.profitPoints,
          position: "bottom_center",
          style: {
            background: "red",
            color: "white"
          }
        },
        activity_time: {
          text: item.activityTime,
          position: "bottom",
          font_size: "small"
        }
      };
    }
    function formatUrls() {
      const temp = [
        ...item.templateImage,
        ...item.campaignLogoImage,
        ...item.productImage
      ];
      // 判断fullGiftImages达到最大长度，如果没有达到就填充空数据直到达到最大长度
      if (item.fullGiftImages.length < MAX_PIC_COUNT) {
        temp.push(
          ...Array(MAX_PIC_COUNT - item.fullGiftImages.length).fill("")
        );
      }

      const betterTemplateImage = item.betterTemplateImage;
      if (Object.keys(betterTemplateImage).length > 0) {
        temp.push(...Object.values(betterTemplateImage));
      }

      return temp;
    }

    return {
      model: GRSAI_MODEL_NAME,
      prompt: `
          基础模板图为提供的URL里的第1张图，它的DSL为${old_dsl}，DSL没有提及的字段，就必须按照模板图保持原样。
          传入的图片数可能大于${MAX_PIC_COUNT + 3}张，如果大于，则说明是再次生成，此时超过的图片是可以用来当成符合条件的结果图，可以用来参考，照着符合条件的结果图生成。
          根据新DSL和旧DSL的差异来修改模板图，最后输出修改后的模板图。再重申一次，不能修改模板图里DSL没有提及的字段所代表的元素！
          字体选用江城圆体。
          重点：event_badge字段的image_ref字段，它的值为提供的URL里的第2张图，这个地方必须替换掉，颜色和提供的图片要保持一致！
          新的DSL为${new_dsl}。
          其他需要注意的地方：${item.remark}
        `,
      aspectRatio: "1:1",
      imageSize: item.imageSize,
      urls: formatUrls(),
      shutProgress: false
    };
  }

  try {
    const response = await fetch(
      "https://grsai.dakka.com.cn/v1/draw/nano-banana",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GRSAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(params)
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6); // 去掉 "data: " 前缀
          if (dataStr.trim()) {
            try {
              const data = JSON.parse(dataStr);
              // console.log(`${item.id}接收到的数据:`, data);
              // addLog(`${item.id}接收到的数据: ${dataStr}`);

              // 如果生成完成，添加到图片数组
              if (
                data.status === "succeeded" &&
                data.results &&
                data.results.length > 0
              ) {
                addLog(`${item.id}生成成功，图片URL: ${data.results[0].url}`);

                for (const ele of props.tableData) {
                  if (ele.id === item.id) {
                    ele.resultImages.push(data.results[0].url);
                  }
                }
                return data; // 返回成功的结果
              }

              // 如果生成失败，抛出错误
              if (data.status === "failed") {
                addLog(`${item.id}生成失败，错误信息: ${data.error}`);
                throw new Error(data.error);
              }
            } catch (e) {
              failedRequestsList.value.push(() => sendDrawingRequest(item));
              console.error("解析JSON失败:", e, "原始数据:", dataStr);
            }
          }
        }
      }
    }
  } catch (error: any) {
    failedRequestsList.value.push(() => sendDrawingRequest(item));
    console.error(`${item.id}请求失败:`, error);
    // 将错误信息附加item信息，便于重试时使用
    error.item = item;
    throw error;
  }
};
//#endregion
</script>

<template>
  <el-card shadow="never" style="border-radius: 10px" class="mt-[10px]">
    <div class="text-[14px] text-[#0a0a0a] mb-[5px]">操作栏</div>
    <div class="flex justify-between">
      <div
        class="text-[14px] text-[#303133] w-[50%] overflow-auto h-[200px] border border-[#e4e7ed] rounded-[4px] p-[10px] bg-[#f5f7fa]"
      >
        <p class="text-[14px] text-[#0a0a0a] font-[500]">💻日志</p>
        <div v-for="(log, index) in logsList" :key="index">{{ log }}</div>
      </div>
      <div class="flex flex-col items-end w-[10%]">
        <el-button
          type="primary"
          @click="handleGenerateImagesClick"
          :loading="loading"
          :disabled="isEdit"
        >
          开始绘图
        </el-button>
        <p class="text-[12px] text-[#606266] font-[500] mt-[5px]">
          ⚠️仅生成勾选的配置项对应的图片，每条数据生成3张图，每张图片生成时间约为100~200秒。
        </p>
      </div>
    </div>
  </el-card>
</template>
