<script setup lang="ts">
import { reactive, ref } from "vue";
import DevUpLoad from "./components/devUpLoad.vue";
import { DSL_SCHEMA } from "./constants";

const loading = ref(false);
const nanoImgUrls = ref<string[]>([]); // 改为数组存储多张图片
const progress = ref(0); // 添加进度状态
const status = ref(""); // 添加状态显示

const aiDrawingForm = reactive({
  templateImage: [] as string[], // 现在这里存储的是图片的base64字符串数组
  imageSize: "2K" as string, // 输出图像大小
  campaignLogoImage: [] as string[], // 活动LOGO图片
  highlightedSellingPoints: "特色冻干工艺" as string, // 产品卖点-高亮
  normalSellingPoints: "特色冻干工艺 蜜汁鸡肉冻干" as string, // 产品卖点-全部
  productName: "鸡肉冻干 200g" as string, // 产品名
  productImage: [] as string[], // 产品图片
  fullGiftTitle: "全场满399送" as string, // 全场满赠-标题
  fullGiftDescription: "爵宴狗粮随行装试吃（150g*4）" as string, // 全场满赠-描述
  fullGiftTags: "送" as string, // 全场满赠-标签
  fullGiftImages: [] as string[], // 全场满赠-图片
  handPriceTitle: "到手价" as string, // 到手价-标题
  handPrice: "￥39.5" as string, // 到手价-价格
  profitPoints: "会员抢券 全场满399-20" as string, // 利益点
  activityTime: "活动时间：1/15 00:00:00 - 1/25 23:59:59" as string // 活动时间
});

const handleSubmit = async () => {
  loading.value = true;
  progress.value = 0;
  status.value = "开始生成图片...";
  nanoImgUrls.value = []; // 清空之前的图片
  console.log("提交表单", aiDrawingForm);
  // return;

  try {
    // 创建3个并发请求
    const requests = [];
    for (let i = 0; i < 1; i++) {
      requests.push(sendDrawingRequest(i));
    }

    // 等待所有请求完成（无论成功或失败）
    const results = await Promise.allSettled(requests);

    // 处理每个请求的结果
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`图片${index + 1}生成成功`);
      } else {
        console.error(`图片${index + 1}生成失败:`, result.reason);
      }
    });

    status.value = "所有图片生成完成！";
  } catch (error: any) {
    console.error("请求失败:", error);
    status.value = `请求失败: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// 发送单个绘图请求
const sendDrawingRequest = async (index: number) => {
  const params = formatParams();

  try {
    const response = await fetch(
      "https://grsai.dakka.com.cn/v1/draw/nano-banana",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer sk-f1a82e4ffc184a92a8422c593ce44b25",
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
              console.log(`图片${index + 1}接收到的数据:`, data);

              // 更新进度和状态
              progress.value = data.progress || 0;
              status.value = `图片${index + 1}: ${data.status || ""}`;

              // 如果生成完成，添加到图片数组
              if (
                data.status === "succeeded" &&
                data.results &&
                data.results.length > 0
              ) {
                // 确保数组长度足够
                while (nanoImgUrls.value.length <= index) {
                  nanoImgUrls.value.push("");
                }
                nanoImgUrls.value[index] = data.results[0].url;
                status.value = `图片${index + 1}生成完成！`;
              }

              // 如果生成失败，显示错误信息
              if (data.status === "failed") {
                status.value = `图片${index + 1}生成失败: ${data.error || data.failure_reason || "未知错误"}`;
              }
            } catch (e) {
              console.error("解析JSON失败:", e, "原始数据:", dataStr);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error(`图片${index + 1}请求失败:`, error);
    status.value = `图片${index + 1}请求失败: ${error.message}`;
    throw error; // 重新抛出错误以便外层处理
  }

  function formatParams() {
    const old_dsl = JSON.stringify(DSL_SCHEMA);
    const new_dsl = JSON.stringify(formatPromptDSLSchema());

    return {
      model: "nano-banana-pro",
      prompt: `
    模板图为提供的URL里的第1张图，它的DSL为${old_dsl}，DSL没有提及的字段，就必须按照模板图保持原样。
    根据新DSL和旧DSL的差异来修改模板图，最后输出修改后的模板图。再重申一次，不能修改模板图里DSL没有提及的字段所代表的元素！
    重点：event_badge字段的image_ref字段，它的值为提供的URL里的第2张图，这个地方必须替换掉，颜色和提供的图片要保持一致！
    新的DSL为${new_dsl}。
    `,
      aspectRatio: "1:1",
      imageSize: aiDrawingForm.imageSize,
      urls: formatUrls(),
      shutProgress: false
    };
  }
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
        text: aiDrawingForm.normalSellingPoints,
        highlight: {
          text: aiDrawingForm.highlightedSellingPoints,
          color: "#FF4D2E"
        },
        position: "center_top",
        font: "bold"
      },
      subtitle: {
        text: aiDrawingForm.productName,
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
          title: aiDrawingForm.fullGiftTitle,
          badge: aiDrawingForm.fullGiftTags
        },
        body: {
          text: aiDrawingForm.fullGiftDescription,
          gift_items: {
            layout: "horizontal",
            spacing: "small",
            item: "提供的URL里的第4张以及之后的所有图片, 把它们堆叠成有层次感再显示"
          }
        }
      },
      price: {
        label: aiDrawingForm.handPriceTitle,
        value: aiDrawingForm.handPrice,
        position: "bottom_left",
        style: {
          color: "white",
          background: "red",
          font: "bold"
        }
      },
      coupon: {
        text: aiDrawingForm.profitPoints,
        position: "bottom_center",
        style: {
          background: "red",
          color: "white"
        }
      },
      activity_time: {
        text: aiDrawingForm.activityTime,
        position: "bottom",
        font_size: "small"
      }
    };
  }
  function formatUrls() {
    return [
      ...aiDrawingForm.templateImage,
      ...aiDrawingForm.campaignLogoImage,
      ...aiDrawingForm.productImage,
      ...aiDrawingForm.fullGiftImages
    ];
  }
};
</script>

<template>
  <div>
    <el-row :gutter="10">
      <el-col :xs="24" :sm="12">
        <el-card shadow="never">
          <!-- <div class="h-[calc(100vh)] overflow-auto"> -->
          <div>
            <el-form
              :model="aiDrawingForm"
              label-width="auto"
              style="max-width: 600px"
            >
              <el-form-item label="模板图片">
                <DevUpLoad v-model="aiDrawingForm.templateImage" :limit="1" />
              </el-form-item>
              <el-form-item label="输出图像大小">
                <el-select
                  v-model="aiDrawingForm.imageSize"
                  placeholder="请选择输出图像大小"
                >
                  <el-option label="1K" value="1K" />
                  <el-option label="2K" value="2K" />
                  <el-option label="4K" value="4K" />
                </el-select>
              </el-form-item>
              <el-form-item label="活动LOGO图片">
                <DevUpLoad
                  v-model="aiDrawingForm.campaignLogoImage"
                  :limit="1"
                />
              </el-form-item>
              <el-form-item label="产品卖点-高亮">
                <el-input
                  v-model="aiDrawingForm.highlightedSellingPoints"
                  placeholder="特色酥骨工艺"
                />
              </el-form-item>
              <el-form-item label="产品卖点-全部">
                <el-input
                  v-model="aiDrawingForm.normalSellingPoints"
                  placeholder="特色酥骨工艺 蜜汁兔脊"
                />
              </el-form-item>
              <el-form-item label="产品名">
                <el-input
                  v-model="aiDrawingForm.productName"
                  placeholder="兔脊骨120g"
                />
              </el-form-item>
              <el-form-item label="产品图片">
                <DevUpLoad v-model="aiDrawingForm.productImage" :limit="1" />
              </el-form-item>
              <el-form-item label="全场满赠-标题">
                <el-input
                  v-model="aiDrawingForm.fullGiftTitle"
                  placeholder="全场满199送"
                />
              </el-form-item>
              <el-form-item label="全场满赠-描述">
                <el-input
                  v-model="aiDrawingForm.fullGiftDescription"
                  placeholder="爵宴狗粮随行装试吃（50g*4）"
                />
              </el-form-item>
              <el-form-item label="全场满赠-标签">
                <el-input
                  v-model="aiDrawingForm.fullGiftTags"
                  placeholder="赠"
                />
              </el-form-item>
              <el-form-item label="全场满赠-图片">
                <DevUpLoad v-model="aiDrawingForm.fullGiftImages" :limit="5" />
              </el-form-item>
              <el-form-item label="到手价-标题">
                <el-input
                  v-model="aiDrawingForm.handPriceTitle"
                  placeholder="到手价"
                />
              </el-form-item>
              <el-form-item label="到手价-价格">
                <el-input
                  v-model="aiDrawingForm.handPrice"
                  placeholder="￥34.3"
                />
              </el-form-item>
              <el-form-item label="利益点">
                <el-input
                  v-model="aiDrawingForm.profitPoints"
                  placeholder="会员抢券 全场满199-15"
                />
              </el-form-item>
              <el-form-item label="活动时间">
                <el-input
                  v-model="aiDrawingForm.activityTime"
                  placeholder="活动时间：12/15 00:00:00 - 12/25 23:59:59"
                />
              </el-form-item>

              <el-form-item>
                <el-button
                  type="primary"
                  @click="handleSubmit"
                  :loading="loading"
                  >生成图片</el-button
                >
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <el-card shadow="never" class="mt-[20px]">
          <div>
            <pre class="text-sm">{{ JSON.stringify(DSL_SCHEMA, null, 2) }}</pre>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12">
        <el-card shadow="never">
          <div>生成图片：</div>
          <div class="flex flex-wrap gap-4">
            <div
              v-for="(imgUrl, index) in nanoImgUrls"
              :key="index"
              class="image-container"
            >
              <div class="text-sm mb-2">图片 {{ index + 1 }}</div>
              <el-image
                :src="imgUrl"
                :alt="`图片${index + 1}`"
                :preview-src-list="nanoImgUrls.filter(url => url)"
                :initial-index="index"
                style="width: 200px; height: auto; object-fit: cover"
              />
              <div v-if="!imgUrl && loading" class="text-gray-400 text-sm mt-2">
                生成中...
              </div>
            </div>
          </div>
          <!-- 添加进度显示 -->
          <div v-if="loading" style="margin-top: 10px">
            <el-progress
              :percentage="progress"
              :status="status.includes('完成') ? 'success' : ''"
            />
            <div style="margin-top: 5px; font-size: 12px; color: #666">
              {{ status }}
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
