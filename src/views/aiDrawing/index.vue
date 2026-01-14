<script setup lang="ts">
import { provide, ref } from "vue";
import ExcelTable from "./excelTable/index.vue";
import EditDialog from "./editDialog/index.vue";
import Assembling from "./assembling/index.vue";
import { ExcelTableItem } from "./excelTable/type";

const editDialogRef = ref<typeof EditDialog>();
const assemblingRef = ref<typeof Assembling>();

// 生成的模板图 /ai/xxx
const templateImg = ref("");
const templateRow = ref<ExcelTableItem>();

const updateTemplateImg = (
  img: string,
  openDialogIndex: number = 0,
  row: ExcelTableItem
) => {
  // console.log("生成的模板图:", img);
  templateImg.value = img;
  templateRow.value = row;
  if (openDialogIndex === 0) {
    editDialogRef.value?.open(row);
  } else if (openDialogIndex === 1) {
    assemblingRef.value?.open();
  }
};
provide("updateTemplateImg", updateTemplateImg);
</script>

<template>
  <div>
    <ExcelTable />

    <EditDialog :templateImg="templateImg" ref="editDialogRef" />

    <Assembling
      :templateImg="templateImg"
      :templateRow="templateRow"
      ref="assemblingRef"
    />
  </div>
</template>
