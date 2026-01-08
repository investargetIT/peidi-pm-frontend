<script setup lang="ts">
import { ref } from "vue";
import { type ExcelTableItem } from "@/views/aiDrawing/excelTable/type/index";
import TableDataCard from "@/views/aiDrawing/excelTable/components/tableDataCard/index.vue";
import OperationCard from "@/views/aiDrawing/excelTable/components/operationCard/index.vue";

const loading = ref<boolean>(false);
const handleLoadingStatus = (status: boolean) => {
  loading.value = status;
};

const selectedIds = ref<string[]>([]);
const handleSelectionChange = (val: ExcelTableItem[]) => {
  selectedIds.value = val.map(item => item.id);
  // console.log("选中的id:", selectedIds.value);
};
const tableData = ref<ExcelTableItem[]>([]);
const handleGoodsClick = (row: ExcelTableItem, index: any) => {
  // console.log("点赞点击:", row, index);
  // 遍历tableData，更新点赞状态
  for (const ele of tableData.value) {
    if (ele.id === row.id) {
      // 判断更好的模板数据里是否存在当前图片
      const temp = ele.betterTemplateImage[`${row.id}_${index}`];
      if (temp) {
        // 存在，移除当前图片
        delete ele.betterTemplateImage[`${row.id}_${index}`];
      } else {
        // 不存在，添加到更好的模板数据里
        ele.betterTemplateImage[`${row.id}_${index}`] = row.resultImages[index];
      }
      break;
    }
  }
  // console.log(tableData.value);
};

const isEdit = ref<boolean>(false);
const handleEditStatus = (status: boolean) => {
  isEdit.value = status;
};
</script>

<template>
  <div>
    <TableDataCard
      :loading="loading"
      v-model:tableData="tableData"
      :handleEditStatus="handleEditStatus"
      :handleGoodsClick="handleGoodsClick"
      :handleSelectionChange="handleSelectionChange"
      :selectedIds="selectedIds"
    />

    <OperationCard
      :loading="loading"
      :tableData="tableData"
      :handleLoadingStatus="handleLoadingStatus"
      :isEdit="isEdit"
      :selectedIds="selectedIds"
    />
  </div>
</template>
