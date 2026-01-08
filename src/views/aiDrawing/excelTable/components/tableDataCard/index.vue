<script setup lang="ts">
import { ref } from 'vue';
import { type ExcelTableItem } from "@/views/aiDrawing/excelTable/type/index";
import { EXCEL_TABLE_ITEM_DEFAULT, MAX_PIC_COUNT } from "@/views/aiDrawing/excelTable/utils/constants";
import { generateID } from "@/views/aiDrawing/excelTable/utils/tools";
import DevUpLoad from '@/views/aiDrawing/dev/components/devUpLoad.vue';
import {
  Check,
  Close,
  Delete,
  Edit,
  Back,
  DArrowRight,
  Download,
  Refresh,
  RefreshLeft,
  RefreshRight,
  Right,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue';
import { LineMdLoadingTwotoneLoop } from '@/views/aiDrawing/excelTable/svg/index';

const props = defineProps({
  loading: {
    type: Boolean,
    required: true
  },
  tableData: {
    type: Array as PropType<ExcelTableItem[]>,
    required: true
  },
  handleEditStatus: {
    type: Function as PropType<(status: boolean) => void>,
    required: true
  }
})

const emit = defineEmits<{
  'update:tableData': [value: ExcelTableItem[]]
}>()

//#region 动态编辑表格逻辑
const editingRowIndex = ref<number | null>(null);
const editingRowData = ref<ExcelTableItem | null>(null);

const handleAddRow = () => {
  const newData = [...props.tableData];
  newData.push(JSON.parse(JSON.stringify({ ...EXCEL_TABLE_ITEM_DEFAULT, id: generateID() })));
  emit('update:tableData', newData);
}

const handleEditRow = (index: number) => {
  props.handleEditStatus(true);
  editingRowIndex.value = index;
  editingRowData.value = JSON.parse(JSON.stringify(props.tableData[index]));
}

const handleSaveRow = (index: number) => {
  if (editingRowData.value) {
    const newData = [...props.tableData];
    newData[index] = editingRowData.value;
    emit('update:tableData', newData);
    editingRowIndex.value = null;
    editingRowData.value = null;
    props.handleEditStatus(false);
  }
}

const handleCancelEdit = () => {
  editingRowIndex.value = null;
  editingRowData.value = null;
  props.handleEditStatus(false);
}

const handleDeleteRow = (index: number) => {
  const newData = [...props.tableData];
  newData.splice(index, 1);
  emit('update:tableData', newData);

  if (editingRowIndex.value === index) {
    editingRowIndex.value = null;
    editingRowData.value = null;
    props.handleEditStatus(false);
  } else if (editingRowIndex.value !== null && editingRowIndex.value > index) {
    editingRowIndex.value--;
  }
}
//#endregion

const handleDownload = (src: string) => {
  const suffix = src.slice(src.lastIndexOf('.'))
  const filename = Date.now() + suffix

  fetch(src)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      URL.revokeObjectURL(blobUrl)
      link.remove()
    })

}
</script>

<template>
  <el-card shadow="never" style="border-radius: 10px">
    <div class="text-[14px]  text-[#0a0a0a] mb-[5px]">AI绘图参数配置表</div>

    <el-table :data="tableData" style="width: 100%" border size="small" :header-cell-style="{
      background: '#f5f6f7',
      color: '#0a0a0a',
      fontWeight: '500',
      fontSize: '12px',
    }">
      <el-table-column type="index" width="50" label="序号" />

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
      <el-table-column :resizable="false" prop="imageSize" label="输出分辨率" width="100">
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
      <el-table-column :resizable="false" prop="resultImages" label="结果图片" width="120" fixed="right">
        <template #default="{ row, $index }">
          <div v-for="(image, index) in row.fullGiftImages" :key="index">
            <el-image :src="image" fit="contain" class="w-[50px] h-[50px]" :preview-src-list="row.fullGiftImages"
              :initial-index="(index as number)" preview-teleported show-progress>
              <template #toolbar="{ actions, prev, next, reset, activeIndex, setActiveItem }">
                <el-icon @click="prev">
                  <Back />
                </el-icon>
                <el-icon @click="next">
                  <Right />
                </el-icon>
                <el-icon @click="setActiveItem(row.fullGiftImages.length - 1)">
                  <DArrowRight />
                </el-icon>
                <el-icon @click="actions('zoomOut')">
                  <ZoomOut />
                </el-icon>
                <el-icon @click="actions('zoomIn', { enableTransition: false, zoomRate: 2 })">
                  <ZoomIn />
                </el-icon>
                <el-icon @click="
                  actions('clockwise', { rotateDeg: 180, enableTransition: false })
                  ">
                  <RefreshRight />
                </el-icon>
                <el-icon @click="actions('anticlockwise')">
                  <RefreshLeft />
                </el-icon>
                <el-icon @click="reset">
                  <Refresh />
                </el-icon>
                <el-icon @click="handleDownload(image)">
                  <Download />
                </el-icon>
              </template>
            </el-image>
          </div>
          <div class=" flex items-center" v-if="loading && row.resultImages.length < MAX_PIC_COUNT">
            <div class="w-[24px] h-[24px]">
              <LineMdLoadingTwotoneLoop />
            </div>
            <div class="text-[12px]">生成中...</div>
          </div>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="125" fixed="right">
        <template #default="{ $index }">
          <template v-if="editingRowIndex === $index">
            <el-button type="primary" size="default" @click="handleSaveRow($index)" text :icon="Check">
            </el-button>
            <el-button type="danger" size="default" @click="handleCancelEdit" text :icon="Close">
            </el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="default" @click="handleEditRow($index)"
              :disabled="editingRowIndex !== null || loading" text :icon="Edit">
            </el-button>
            <el-button type="danger" size="default" @click="handleDeleteRow($index)"
              :disabled="editingRowIndex !== null || loading" text :icon="Delete">
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
    <el-button style="width: 100%; display: flex; justify-content: flex-start" @click="handleAddRow"
      :disabled="editingRowIndex !== null || loading">
      <span class="text-[14px] text-[#0a0a0a]">+ 添加数据</span>
    </el-button>
  </el-card>
</template>
