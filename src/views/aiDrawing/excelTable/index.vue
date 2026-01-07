<script setup lang="ts">
import { ref } from 'vue';
import DevUpLoad from '@/views/aiDrawing/dev/components/devUpLoad.vue';
import { DSL_SCHEMA } from '@/views/aiDrawing/dev/constants';
import { ElMessage } from 'element-plus';

const API_KEY = "sk-f1a82e4ffc184a92a8422c593ce44b25"
const generateUUID = () => new Date().getTime().toString(36) + Math.random().toString(36).substring(2);

const loading = ref<boolean>(false);
const logsList = ref<string[]>([]);
const addLog = (log: string) => {
  logsList.value.unshift("[" + new Date().toLocaleString() + "] " + log);
}

export interface ExcelTableItem {
  id: string,
  templateImage: string[],
  imageSize: string,
  campaignLogoImage: string[],
  highlightedSellingPoints: string,
  normalSellingPoints: string,
  productName: string,
  productImage: string[],
  fullGiftTitle: string,
  fullGiftDescription: string,
  fullGiftTags: string,
  fullGiftImages: string[],
  handPriceTitle: string,
  handPrice: string,
  profitPoints: string,
  activityTime: string,
  resultImages: string[],
}

const EXCEL_TABLE_ITEM_DEFAULT: ExcelTableItem = {
  id: '',
  templateImage: [] as string[], // 现在这里存储的是图片的base64字符串数组
  imageSize: '2K' as string, // 输出图像大小
  campaignLogoImage: [] as string[], // 活动LOGO图片
  highlightedSellingPoints: '特色冻干工艺' as string, // 产品卖点-高亮
  normalSellingPoints: '特色冻干工艺 蜜汁鸡肉冻干' as string, // 产品卖点-全部
  productName: '鸡肉冻干 200g' as string, // 产品名
  productImage: [] as string[], // 产品图片
  fullGiftTitle: '全场满399送' as string, // 全场满赠-标题
  fullGiftDescription: '爵宴狗粮随行装试吃（150g*4）' as string, // 全场满赠-描述
  fullGiftTags: '送' as string, // 全场满赠-标签
  fullGiftImages: [] as string[], // 全场满赠-图片
  handPriceTitle: '到手价' as string, // 到手价-标题
  handPrice: '￥39.5' as string, // 到手价-价格
  profitPoints: '会员抢券 全场满399-20' as string, // 利益点
  activityTime: '活动时间：1/15 00:00:00 - 1/25 23:59:59' as string, // 活动时间
  resultImages: [],
}

const tableData = ref<ExcelTableItem[]>([]);

//#region 动态编辑表格逻辑
const editingRowIndex = ref<number | null>(null);
const editingRowData = ref<ExcelTableItem | null>(null);

const handleAddRow = () => {
  tableData.value.push(JSON.parse(JSON.stringify({ ...EXCEL_TABLE_ITEM_DEFAULT, id: generateUUID() })));
}

const handleEditRow = (index: number) => {
  editingRowIndex.value = index;
  editingRowData.value = JSON.parse(JSON.stringify(tableData.value[index]));
}

const handleSaveRow = (index: number) => {
  if (editingRowData.value) {
    tableData.value[index] = editingRowData.value;
    editingRowIndex.value = null;
    editingRowData.value = null;
  }
}

const handleCancelEdit = () => {
  editingRowIndex.value = null;
  editingRowData.value = null;
}

const handleDeleteRow = (index: number) => {
  tableData.value.splice(index, 1);
  if (editingRowIndex.value === index) {
    editingRowIndex.value = null;
    editingRowData.value = null;
  } else if (editingRowIndex.value !== null && editingRowIndex.value > index) {
    editingRowIndex.value--;
  }
}
//#endregion

//#region 生成图片逻辑
const requestList = ref<Promise<any>[]>([]);
const failedRequestsList = ref<Promise<any>[]>([]);

const handleGenerateImagesClick = () => {
  requestList.value = [];
  failedRequestsList.value = [];

  tableData.value.forEach((item) => {
    for (let i = 0; i < 3; i++) {
      requestList.value.push(sendDrawingRequest(item));
    }
  })

  handleGenerateImages();
}

const handleGenerateImages = async () => {
  loading.value = true;
  addLog("开始生成图片...");

  try {
    addLog(`共${requestList.value.length}个请求开始处理...`);

    // 等待所有请求完成（无论成功或失败）
    const results = await Promise.allSettled(requestList.value);

    // 处理每个请求的结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        addLog(`处理每个请求的结果: 请求${result}成功，图片URL: ${result.value.results[0].url}`);
      } else {
        addLog(`处理每个请求的结果: 请求${result}失败，错误信息: ${result.reason}`);
      }
    });
  } catch (error: any) {
    console.error('请求失败:', error);
  } finally {
    if (failedRequestsList.value.length > 0) {
      addLog(`共${failedRequestsList.value.length}个请求失败，将重试...`);

      requestList.value = JSON.parse(JSON.stringify(failedRequestsList.value));
      failedRequestsList.value = [];
      await handleGenerateImages();
    } else {
      addLog("👍所有图片生成完成！");
      ElMessage.success('所有图片生成完成！');
    }
  }
}
// 发送图片生成请求
const sendDrawingRequest = async (item: ExcelTableItem) => {
  const params = formatParams();

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
      imageSize: item.imageSize,
      urls: formatUrls(),
      shutProgress: false,
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
      return [
        ...item.templateImage,
        ...item.campaignLogoImage,
        ...item.productImage,
        ...item.fullGiftImages,
      ]
    }
  }

  try {
    const response = await fetch('https://grsai.dakka.com.cn/v1/draw/nano-banana', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6); // 去掉 "data: " 前缀
          if (dataStr.trim()) {
            try {
              const data = JSON.parse(dataStr);
              console.log(`${item.id}接收到的数据:`, data);
              addLog(`${item.id}接收到的数据: ${dataStr}`);

              // 如果生成完成，添加到图片数组
              if (data.status === 'succeeded' && data.results && data.results.length > 0) {
                addLog(`${item.id} 生成成功，图片URL: ${data.results[0].url}`);

                for (const ele of tableData.value) {
                  if (ele.id === item.id) {
                    ele.resultImages.push(data.results[0].url);
                  }
                }
              }

              // 如果生成失败，显示错误信息
              if (data.status === 'failed') {
                addLog(`${item.id} 生成失败，错误信息: ${data.error}`);

                failedRequestsList.value.push(sendDrawingRequest(item));
              }
            } catch (e) {
              console.error('解析JSON失败:', e, '原始数据:', dataStr);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error(`${item.id}请求失败:`, error);
    failedRequestsList.value.push(sendDrawingRequest(item));
    throw error; // 重新抛出错误以便外层处理
  }
}
//#endregion
</script>

<template>
  <div>
    <el-card shadow="never" style="border-radius:10px;">
      <el-table :data="tableData" style="width: 100%" border size="small">
        <el-table-column type="index" width="50" />

        <!-- 模板图片 -->
        <el-table-column :resizable="false" prop="templateImage" label="模板图片" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <DevUpLoad v-model="editingRowData!.templateImage" :limit="1" />
            </template>
            <template v-else>
              <div v-for="(image, index) in row.templateImage" :key="index">
                <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.templateImage"
                  :initial-index="(index as number)" preview-teleported />
              </div>
            </template>
          </template>
        </el-table-column>

        <!-- 输出图像大小 -->
        <el-table-column :resizable="false" prop="imageSize" label="输出图像大小" width="100">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-select v-model="editingRowData!.imageSize" placeholder="">
                <el-option label="1K" value="1K" />
                <el-option label="2K" value="2K" />
                <el-option label="4K" value="4K" />
              </el-select>
            </template>
            <template v-else>
              {{ row.imageSize }}
            </template>
          </template>
        </el-table-column>

        <!-- 活动LOGO图片 -->
        <el-table-column :resizable="false" prop="campaignLogoImage" label="活动LOGO图片" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <DevUpLoad v-model="editingRowData!.campaignLogoImage" :limit="1" />
            </template>
            <template v-else>
              <div v-for="(image, index) in row.campaignLogoImage" :key="index">
                <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.campaignLogoImage"
                  :initial-index="(index as number)" preview-teleported />
              </div>
            </template>
          </template>
        </el-table-column>

        <!-- 产品卖点-高亮 -->
        <el-table-column :resizable="false" prop="highlightedSellingPoints" label="产品卖点-高亮" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.highlightedSellingPoints" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.highlightedSellingPoints }}
            </template>
          </template>
        </el-table-column>

        <!-- 产品卖点-全部 -->
        <el-table-column :resizable="false" prop="normalSellingPoints" label="产品卖点-全部" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.normalSellingPoints" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.normalSellingPoints }}
            </template>
          </template>
        </el-table-column>

        <!-- 产品名 -->
        <el-table-column :resizable="false" prop="productName" label="产品名" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.productName" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.productName }}
            </template>
          </template>
        </el-table-column>

        <!-- 产品图片 -->
        <el-table-column :resizable="false" prop="productImage" label="产品图片" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <DevUpLoad v-model="editingRowData!.productImage" :limit="1" />
            </template>
            <template v-else>
              <div v-for="(image, index) in row.productImage" :key="index">
                <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.productImage"
                  :initial-index="(index as number)" preview-teleported />
              </div>
            </template>
          </template>
        </el-table-column>

        <!-- 全场满赠-标题 -->
        <el-table-column :resizable="false" prop="fullGiftTitle" label="全场满赠-标题" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.fullGiftTitle" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.fullGiftTitle }}
            </template>
          </template>
        </el-table-column>

        <!-- 全场满赠-描述 -->
        <el-table-column :resizable="false" prop="fullGiftDescription" label="全场满赠-描述" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.fullGiftDescription" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.fullGiftDescription }}
            </template>
          </template>
        </el-table-column>

        <!-- 全场满赠-标签 -->
        <el-table-column :resizable="false" prop="fullGiftTags" label="全场满赠-标签" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.fullGiftTags" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.fullGiftTags }}
            </template>
          </template>
        </el-table-column>

        <!-- 全场满赠-图片 -->
        <el-table-column :resizable="false" prop="fullGiftImages" label="全场满赠-图片" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <DevUpLoad v-model="editingRowData!.fullGiftImages" :limit="5" />
            </template>
            <template v-else>
              <div v-for="(image, index) in row.fullGiftImages" :key="index">
                <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.fullGiftImages"
                  :initial-index="(index as number)" preview-teleported />
              </div>
            </template>
          </template>
        </el-table-column>

        <!-- 到手价-标题 -->
        <el-table-column :resizable="false" prop="handPriceTitle" label="到手价-标题" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.handPriceTitle" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.handPriceTitle }}
            </template>
          </template>
        </el-table-column>

        <!-- 到手价-价格 -->
        <el-table-column :resizable="false" prop="handPrice" label="到手价-价格" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.handPrice" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.handPrice }}
            </template>
          </template>
        </el-table-column>

        <!-- 利益点 -->
        <el-table-column :resizable="false" prop="profitPoints" label="利益点" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.profitPoints" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.profitPoints }}
            </template>
          </template>
        </el-table-column>

        <!-- 活动时间 -->
        <el-table-column :resizable="false" prop="activityTime" label="活动时间" width="120">
          <template #default="{ row, $index }">
            <template v-if="editingRowIndex === $index">
              <el-input v-model="editingRowData!.activityTime" placeholder="" type="textarea" :rows="3" />
            </template>
            <template v-else>
              {{ row.activityTime }}
            </template>
          </template>
        </el-table-column>

        <!-- 结果图片 -->
        <el-table-column :resizable="false" prop="resultImages" label="结果图片" width="120">
          <template #default="{ row, $index }">
            <div v-for="(image, index) in row.resultImages" :key="index">
              <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.resultImages"
                :initial-index="(index as number)" preview-teleported />
            </div>
          </template>
        </el-table-column>

        <!-- 操作列 -->
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ $index }">
            <template v-if="editingRowIndex === $index">
              <el-button type="primary" size="small" @click="handleSaveRow($index)">
                保存
              </el-button>
              <el-button size="small" @click="handleCancelEdit">
                取消
              </el-button>
            </template>
            <template v-else>
              <el-button type="primary" size="small" @click="handleEditRow($index)"
                :disabled="editingRowIndex !== null || loading">
                编辑
              </el-button>
              <el-button type="danger" size="small" @click="handleDeleteRow($index)"
                :disabled="editingRowIndex !== null || loading">
                删除
              </el-button>
            </template>
          </template>
        </el-table-column>

        <template #append>
          <div class="w-full">
            <el-button style="width: 100%;" @click="handleAddRow" :disabled="editingRowIndex !== null || loading">
              添加行
            </el-button>
          </div>
        </template>
      </el-table>
    </el-card>

    <el-card shadow="never" style="border-radius:10px;" class="mt-[10px]">
      <div class="flex justify-between">
        <div
          class="text-[14px] text-[#303133] w-[80%] overflow-auto h-[200px] border border-[#e4e7ed] rounded-[4px] p-[10px] bg-[#f5f7fa]">
          <div v-for="(log, index) in logsList" :key="index">{{ log }}</div>
        </div>
        <el-button type="primary" @click="handleGenerateImagesClick" :loading="loading"
          :disabled="editingRowIndex !== null">
          生成图片
        </el-button>
      </div>
    </el-card>
  </div>
</template>