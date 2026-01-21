<script setup lang="ts">
import { onMounted, ref } from "vue";
import Examination from "./examination.vue";
import ReportExport from "./reportExport.vue";
import FileUpload from "./fileUpload.vue";
import NavBar from "./navBar.vue";
import type { TabsPaneContext } from "element-plus";
import { storageLocal } from "@pureadmin/utils";

const DEV_ID = [
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1887377779519434753" // 王家琦
];

const PERMISSION_ID_LIST = {
  // 报表导出
  reportExport: [
    ...DEV_ID,
    "1897890298264596481", // 林双叶
    "1870023775338692610", // 大树
    "1869635118983348225" // 肖嘉玲
  ],
  // 文件上传
  fileUpload: [
    ...DEV_ID,
    "1848656573381541890", // 方云
    "1874711258007646210" // 范振吉
  ]
};

const activeName = ref("excamination");
const userInfo: any = storageLocal().getItem("user-check-info");
const userId = ref(userInfo?.id ?? "");

const handleClick = (tab: TabsPaneContext, event: Event) => {
  // console.log(tab, event)
};

const checkPermission = (name: string) => {
  return userId.value ? PERMISSION_ID_LIST[name].includes(userId.value) : false;
};
</script>

<template>
  <div class="px-[20px] py-[20px] pt-[70px]">
    <NavBar />
    <el-tabs
      v-model="activeName"
      type="card"
      class="demo-tabs"
      @tab-click="handleClick"
    >
      <el-tab-pane label="考核页面" name="excamination" lazy>
        <Examination v-if="activeName === 'excamination'" />
      </el-tab-pane>

      <el-tab-pane
        label="数据上传"
        name="fileUpload"
        lazy
        v-if="checkPermission('fileUpload')"
      >
        <FileUpload
          v-if="activeName === 'fileUpload'"
          :userId="userId"
          :DEV_ID="DEV_ID"
        />
      </el-tab-pane>

      <el-tab-pane
        label="报表导出"
        name="reportExport"
        lazy
        v-if="checkPermission('reportExport')"
      >
        <ReportExport v-if="activeName === 'reportExport'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.demo-tabs > .el-tabs__content {
  padding: 32px;
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>
