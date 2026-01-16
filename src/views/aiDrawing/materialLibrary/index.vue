<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MATERIAL_LIBRARY_TABS } from "./config";
import TableCard from "./components/tableCard/index.vue";

const materialLibraryVisible = ref(false);
const activeTab = ref(MATERIAL_LIBRARY_TABS[0].name);

onMounted(() => {
  materialLibraryVisible.value = false;
});
</script>

<template>
  <div>
    <el-dialog
      v-model="materialLibraryVisible"
      title="素材库"
      width="1200"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-tabs type="border-card" v-model="activeTab">
        <el-tab-pane
          v-for="tab in MATERIAL_LIBRARY_TABS"
          :label="tab.label"
          :name="tab.name"
        >
          <TableCard :tab="tab" />
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>
