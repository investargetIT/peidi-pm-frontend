<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import ExcelTable from "./excelTable/index.vue";
import EditDialog from "./editDialog/index.vue";
// 编辑弹窗 引用
const editDialogRef = ref<typeof EditDialog>();

// 生成的模板图 数据
const templateImg = ref(null);
const updateTemplateImg = (img: string) => {
  templateImg.value = img;
  // 打开编辑弹窗
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
