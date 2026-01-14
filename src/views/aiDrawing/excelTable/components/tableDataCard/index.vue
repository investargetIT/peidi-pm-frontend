<script setup lang="ts">
import { inject, ref } from "vue";
import { ElMessageBox } from "element-plus";
import DevUpLoad from "@/views/aiDrawing/dev/components/devUpLoad.vue";
import { Check, Close, Delete, Edit } from "@element-plus/icons-vue";
import { type ExcelTableItem } from "../../type/index";
import { EXCEL_TABLE_ITEM_DEFAULT } from "../../utils/constants";
import { generateID } from "../../utils/tools";
import {
  LineMdLoadingTwotoneLoop,
  IconParkSolidGoodTwo,
  RiImageEditFill,
  FluentSave32Filled
} from "../../svg/index";
import OnlineImage from "../onlineImage/index.vue";

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
  },
  handleGoodsClick: {
    type: Function as PropType<(row: ExcelTableItem, index: any) => void>,
    required: true
  },
  handleSelectionChange: {
    type: Function as PropType<(val: ExcelTableItem[]) => void>,
    required: true
  },
  selectedIds: {
    type: Array as PropType<string[]>,
    required: true
  }
});

const emit = defineEmits<{
  "update:tableData": [value: ExcelTableItem[]];
}>();

const updateTemplateImg = inject<Function>("updateTemplateImg");
const handleEditImage = (row: ExcelTableItem, index: number | string) => {
  updateTemplateImg(row.resultImages[index], 0, row);
};
const handleSaveImage = (row: ExcelTableItem, index: number | string) => {
  updateTemplateImg(row.resultImages[index], 1, row);
};

//#region 动态编辑表格逻辑
const editingRowIndex = ref<number | null>(null);
const editingRowData = ref<ExcelTableItem | null>(null);

const handleAddRow = () => {
  const newData = [...props.tableData];
  newData.unshift(
    JSON.parse(
      JSON.stringify({
        ...EXCEL_TABLE_ITEM_DEFAULT,
        uiid: generateID()
      })
    )
  );
  emit("update:tableData", newData);
};

const handleEditRow = (index: number) => {
  props.handleEditStatus(true);
  editingRowIndex.value = index;
  editingRowData.value = JSON.parse(JSON.stringify(props.tableData[index]));
};

const handleSaveRow = (index: number) => {
  if (editingRowData.value) {
    const newData = [...props.tableData];
    newData[index] = editingRowData.value;
    emit("update:tableData", newData);
    editingRowIndex.value = null;
    editingRowData.value = null;
    props.handleEditStatus(false);
  }
};

const handleCancelEdit = () => {
  editingRowIndex.value = null;
  editingRowData.value = null;
  props.handleEditStatus(false);
};

const handleDeleteRow = (index: number) => {
  ElMessageBox.confirm("确认删除吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      const newData = [...props.tableData];
      newData.splice(index, 1);
      emit("update:tableData", newData);

      if (editingRowIndex.value === index) {
        editingRowIndex.value = null;
        editingRowData.value = null;
        props.handleEditStatus(false);
      } else if (
        editingRowIndex.value !== null &&
        editingRowIndex.value > index
      ) {
        editingRowIndex.value--;
      }
    })
    .catch(() => {
      // 取消删除
    });
};
//#endregion

// 禁用勾选状态
const selectable = (row: ExcelTableItem, index: number) => {
  return !(props.loading || row.status === 0);
};
</script>

<template>
  <el-card shadow="never" style="border-radius: 10px">
    <el-button
      style="width: 100%; display: flex; justify-content: flex-start"
      @click="handleAddRow"
      :disabled="editingRowIndex !== null || loading"
    >
      <span class="text-[14px] text-[#0a0a0a]">+ 添加数据</span>
    </el-button>

    <el-table
      :data="tableData"
      style="width: 100%"
      border
      size="small"
      empty-text="点击上方按钮 添加数据"
      @selection-change="props.handleSelectionChange"
      :header-cell-style="{
        background: '#f5f7fa',
        color: '#0a0a0a',
        fontWeight: '500',
        fontSize: '12px'
      }"
      row-key="uiid"
    >
      <el-table-column
        type="selection"
        :selectable="selectable"
        width="30"
        fixed="left"
      />

      <!-- 模板图片 -->
      <el-table-column
        :resizable="false"
        prop="templateImage"
        label="模板图片"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <DevUpLoad v-model="editingRowData!.templateImage" :limit="1" />
          </template>
          <template v-else>
            <div v-for="(image, index) in row.templateImage" :key="index">
              <OnlineImage :url="image" />
            </div>
          </template>
        </template>
      </el-table-column>

      <!-- 输出图像大小 -->
      <el-table-column
        :resizable="false"
        prop="imageSize"
        label="输出分辨率"
        width="100"
      >
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
      <el-table-column
        :resizable="false"
        prop="campaignLogoImage"
        label="活动LOGO图片"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <DevUpLoad v-model="editingRowData!.campaignLogoImage" :limit="1" />
          </template>
          <template v-else>
            <div v-for="(image, index) in row.campaignLogoImage" :key="index">
              <OnlineImage :url="image" />
            </div>
          </template>
        </template>
      </el-table-column>

      <!-- 产品卖点-高亮 -->
      <el-table-column
        :resizable="false"
        prop="highlightedSellingPoints"
        label="产品卖点-高亮"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.highlightedSellingPoints"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.highlightedSellingPoints }}
          </template>
        </template>
      </el-table-column>

      <!-- 产品卖点-全部 -->
      <el-table-column
        :resizable="false"
        prop="normalSellingPoints"
        label="产品卖点-全部"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.normalSellingPoints"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.normalSellingPoints }}
          </template>
        </template>
      </el-table-column>

      <!-- 产品名 -->
      <el-table-column
        :resizable="false"
        prop="productName"
        label="产品名"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.productName"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.productName }}
          </template>
        </template>
      </el-table-column>

      <!-- 产品图片 -->
      <el-table-column
        :resizable="false"
        prop="productImage"
        label="产品图片"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <DevUpLoad v-model="editingRowData!.productImage" :limit="1" />
          </template>
          <template v-else>
            <div v-for="(image, index) in row.productImage" :key="index">
              <OnlineImage :url="image" />
            </div>
          </template>
        </template>
      </el-table-column>

      <!-- 全场满赠-标题 -->
      <el-table-column
        :resizable="false"
        prop="fullGiftTitle"
        label="全场满赠-标题"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.fullGiftTitle"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.fullGiftTitle }}
          </template>
        </template>
      </el-table-column>

      <!-- 全场满赠-描述 -->
      <el-table-column
        :resizable="false"
        prop="fullGiftDescription"
        label="全场满赠-描述"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.fullGiftDescription"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.fullGiftDescription }}
          </template>
        </template>
      </el-table-column>

      <!-- 全场满赠-标签 -->
      <el-table-column
        :resizable="false"
        prop="fullGiftTags"
        label="全场满赠-标签"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.fullGiftTags"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.fullGiftTags }}
          </template>
        </template>
      </el-table-column>

      <!-- 全场满赠-图片 -->
      <el-table-column
        :resizable="false"
        prop="fullGiftImages"
        label="全场满赠-图片"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <DevUpLoad v-model="editingRowData!.fullGiftImages" :limit="5" />
          </template>
          <template v-else>
            <div v-for="(image, index) in row.fullGiftImages" :key="index">
              <OnlineImage :url="image" />
            </div>
          </template>
        </template>
      </el-table-column>

      <!-- 到手价-标题 -->
      <el-table-column
        :resizable="false"
        prop="handPriceTitle"
        label="到手价-标题"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.handPriceTitle"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.handPriceTitle }}
          </template>
        </template>
      </el-table-column>

      <!-- 到手价-价格 -->
      <el-table-column
        :resizable="false"
        prop="handPrice"
        label="到手价-价格"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.handPrice"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.handPrice }}
          </template>
        </template>
      </el-table-column>

      <!-- 利益点 -->
      <el-table-column
        :resizable="false"
        prop="profitPoints"
        label="利益点"
        width="120"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.profitPoints"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.profitPoints }}
          </template>
        </template>
      </el-table-column>

      <!-- 活动时间 -->
      <el-table-column
        :resizable="false"
        prop="activityTime"
        label="活动时间"
        width="150"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.activityTime"
              placeholder=""
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.activityTime }}
          </template>
        </template>
      </el-table-column>

      <!-- 备注 -->
      <el-table-column
        :resizable="false"
        prop="remark"
        label="补充描述"
        width="150"
        fixed="right"
      >
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-input
              v-model="editingRowData!.remark"
              type="textarea"
              :rows="3"
            />
          </template>
          <template v-else>
            {{ row.remark }}
          </template>
        </template>
      </el-table-column>

      <!-- 结果图片 -->
      <el-table-column
        :resizable="false"
        prop="resultImages"
        label="结果图片"
        width="150"
        fixed="right"
      >
        <template #default="{ row, $index }">
          <div v-for="(image, index) in row.resultImages" :key="index">
            <div class="flex justify-around items-center mb-[8px]">
              <OnlineImage :url="image" />

              <div class="flex flex-col justify-around items-center gap-[12px]">
                <el-button
                  text
                  @click="props.handleGoodsClick(row, index)"
                  size="small"
                >
                  <IconParkSolidGoodTwo
                    class="w-[16px] h-[16px]"
                    color="#ccc"
                    v-show="!row.betterTemplateImage[`${row.uiid}_${index}`]"
                  />
                  <IconParkSolidGoodTwo
                    class="w-[16px] h-[16px]"
                    color="green"
                    v-show="row.betterTemplateImage[`${row.uiid}_${index}`]"
                  />
                </el-button>

                <el-button
                  text
                  @click="handleEditImage(row, index)"
                  size="small"
                >
                  <RiImageEditFill class="w-[16px] h-[16px]" color="#000" />
                </el-button>

                <el-button
                  text
                  size="small"
                  @click="handleSaveImage(row, index)"
                >
                  <FluentSave32Filled class="w-[16px] h-[16px]" color="#000" />
                </el-button>
              </div>
            </div>
          </div>

          <div
            class="flex items-center"
            v-if="
              (loading && props.selectedIds.includes(row.uiid)) ||
              row.status === 0
            "
          >
            <div class="w-[24px] h-[24px]">
              <LineMdLoadingTwotoneLoop />
            </div>
            <div class="text-[12px]">生成中...</div>
          </div>

          <div v-if="row.status === 2">
            <p class="text-[12px] text-red-500">生成失败！</p>
          </div>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="125" fixed="right">
        <template #default="{ $index, row }">
          <template v-if="editingRowIndex === $index">
            <el-button
              type="primary"
              size="default"
              @click="handleSaveRow($index)"
              text
              :icon="Check"
            >
            </el-button>
            <el-button
              type="danger"
              size="default"
              @click="handleCancelEdit"
              text
              :icon="Close"
            >
            </el-button>
          </template>
          <template v-else>
            <el-button
              type="primary"
              size="default"
              @click="handleEditRow($index)"
              :disabled="
                editingRowIndex !== null || loading || row.status === 0
              "
              text
              :icon="Edit"
            >
            </el-button>
            <el-button
              v-if="!row.uuid"
              type="danger"
              size="default"
              @click="handleDeleteRow($index)"
              :disabled="editingRowIndex !== null || loading"
              text
              :icon="Delete"
            >
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style lang="scss" scoped>
:deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
