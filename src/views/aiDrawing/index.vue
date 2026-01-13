<script setup lang="ts">
import { provide, ref } from "vue";
import ExcelTable from "./excelTable/index.vue";
import EditDialog from "./editDialog/index.vue";

const editDialogRef = ref<typeof EditDialog>();

// 生成的模板图 /ai/xxx
const templateImg = ref("");

const updateTemplateImg = (img: string) => {
  // console.log("生成的模板图:", img);
  templateImg.value = img;
  editDialogRef.value?.open();
};
provide("updateTemplateImg", updateTemplateImg);
</script>

<template>
  <div>
    <ExcelTable />

    <EditDialog :templateImg="templateImg" ref="editDialogRef" />
  </div>
</template>
