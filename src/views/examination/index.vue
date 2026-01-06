<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Examination from './excamination.vue'
import ReportExport from './reportExport.vue'
import NavBar from './navBar.vue'

import type { TabsPaneContext } from 'element-plus'
import { storageLocal } from '@pureadmin/utils'

const PERMISSION_ID_LIST = [
  '1897890298264596481', // 林双叶
  '1870023775338692610', // 大树
  '1926449443739600965', // 沈皓钰
  '1850741012504838145', // 张思宇
  '1887377779519434753', // 王家琦
]
const hasExportPermission = ref(false);

const activeName = ref('excamination')

const handleClick = (tab: TabsPaneContext, event: Event) => {
  // console.log(tab, event)
}

const checkPermission = () => {
  const temp: any = storageLocal().getItem('user-check-info');
  // console.log("injectPermissionIdList", temp);
  hasExportPermission.value = temp?.id ? PERMISSION_ID_LIST.includes(temp.id) : false;
}

onMounted(() => {
  checkPermission();
})
</script>

<template>
  <div class="px-[20px] py-[20px] pt-[70px]">
    <NavBar />
    <el-tabs v-model="activeName" type="card" class="demo-tabs" @tab-click="handleClick">
      <el-tab-pane label="考核页面" name="excamination" lazy>
        <Examination v-if="activeName === 'excamination'" />
      </el-tab-pane>
      <el-tab-pane label="报表导出" name="reportExport" lazy v-if="hasExportPermission">
        <ReportExport v-if="activeName === 'reportExport'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.demo-tabs>.el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>