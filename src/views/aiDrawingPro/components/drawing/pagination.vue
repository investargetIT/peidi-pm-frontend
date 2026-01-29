<script setup lang="ts">
import { PropType } from "vue";

const props = defineProps({
  paginationConfig: {
    type: Object as PropType<{
      currentPage: number;
      pageSize: number;
      total: number;
    }>,
    required: true
  },
  loadingTableData: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits<{
  "update:paginationConfig": [
    value: {
      currentPage: number;
      pageSize: number;
      total: number;
    }
  ];
}>();

const handleCurrentChange = (currentPage: number) => {
  emit("update:paginationConfig", {
    ...props.paginationConfig,
    currentPage
  });
};

const handleSizeChange = (pageSize: number) => {
  emit("update:paginationConfig", {
    ...props.paginationConfig,
    pageSize
  });
};
</script>

<template>
  <div class="w-full flex justify-end mt-[24px]">
    <el-pagination
      :current-page="props.paginationConfig.currentPage"
      :page-size="props.paginationConfig.pageSize"
      :page-sizes="[3, 5, 10]"
      size="small"
      background
      layout="total, sizes, prev, pager, next"
      :total="props.paginationConfig.total"
      @current-change="handleCurrentChange"
      @size-change="handleSizeChange"
      :disabled="props.loadingTableData"
    />
  </div>
</template>
