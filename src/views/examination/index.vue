<script setup lang="ts">
import { ref } from 'vue'
import Examination from './excamination.vue'
import ReportExport from './reportExport.vue'

import type { TabsPaneContext } from 'element-plus'

const activeName = ref('excamination')

const handleClick = (tab: TabsPaneContext, event: Event) => {
  console.log(tab, event)
}
</script>

<template>
  <el-tabs v-model="activeName" type="card" class="demo-tabs" @tab-click="handleClick">
    <el-tab-pane label="考核页面" name="excamination" lazy>
      <Examination />
    </el-tab-pane>
    <el-tab-pane label="报表导出" name="reportExport" lazy v-if="false">
      <ReportExport />
    </el-tab-pane>
  </el-tabs>
</template>

<style lang="scss" scoped>
.demo-tabs>.el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>