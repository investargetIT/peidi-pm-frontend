<script setup lang="ts">
import { ref } from 'vue';
import { type ExcelTableItem } from "@/views/aiDrawing/excelTable/type/index";
import TableDataCard from '@/views/aiDrawing/excelTable/components/tableDataCard/index.vue';
import OperationCard from '@/views/aiDrawing/excelTable/components/operationCard/index.vue';

const loading = ref<boolean>(false);
const handleLoadingStatus = (status: boolean) => {
  loading.value = status;
}

const tableData = ref<ExcelTableItem[]>([]);

const isEdit = ref<boolean>(false);
const handleEditStatus = (status: boolean) => {
  isEdit.value = status;
}

</script>

<template>
  <div>
    <TableDataCard :loading="loading" v-model:tableData="tableData" :handleEditStatus="handleEditStatus" />

    <OperationCard :loading="loading" :tableData="tableData" :handleLoadingStatus="handleLoadingStatus"
      :isEdit="isEdit" />
  </div>
</template>