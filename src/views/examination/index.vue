<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Examination from "./examination.vue";
import ReportExport from "./reportExport.vue";
import FileUpload from "./fileUpload.vue";
import Designer from "./designer.vue";
import Evaluation from "./evaluation/index.vue";
import NavBar from "./navBar.vue";
import type { TabsPaneContext } from "element-plus";
import "../aiDrawingPro/style/reset.scss";

const DEV_ID = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1887377779519434753", // 王家琦
  "1926449443739601629" // 杨世豪
];

const MANAGER_ID = [
  "1926449443739598857", // 陈董
  "1869688287188811777" // Lucy 廖丽萍
];

const PERMISSION_ID_LIST = {
  // 报表导出
  reportExport: [
    ...DEV_ID,
    ...MANAGER_ID,
    "1897890298264596481", // 林双叶
    "1870023775338692610", // 大树
    "1869635118983348225", // 肖嘉玲
    "1926449443739601538" // 王晓莹
  ],
  // 文件上传
  fileUpload: [
    ...DEV_ID,
    ...MANAGER_ID,
    "1848656573381541890", // 方云
    "1874711258007646210" // 范振吉
  ],
  designer: [
    ...DEV_ID,
    ...MANAGER_ID,
    "1926449443739601538", // 王晓莹
    "1874713377599172609", // 熊玉葵
    "1874741663670775810" // 廖佳晨
  ],
  evaluation: [
    ...DEV_ID,
    "1870023775338692610", // 任琪琳
    "1874711258007646210", // 范振吉
    "1874730426438299649", // 付阳
    "1879443024278761474", // 邓苏
    "1874004550054621185", // 孙舒欣
    "1926449443739598911", // 梁钰
    "1896774351940268034", // 黄向前
    "1894225776978997250", // 张震西
    "1877650921123000321", // 周环寰
    "1874806470939815937", // 王小龙
    "1848656573381541890" // 方云
  ]
};

const route = useRoute();
const router = useRouter();
const userInfo: any = localStorage.getItem("user-check-info") ? JSON.parse(localStorage.getItem("user-check-info")!) : null;
const userId = ref(userInfo?.id ?? "");

// 从路由参数读取选项卡，没有则使用默认值
const activeName = ref<string>("excamination");

const initActiveName = () => {
  // 从路由参数获取
  const tabFromQuery = route.query.tab as string;
  activeName.value = tabFromQuery || "excamination";
};

const handleClick = (tab: TabsPaneContext, event: Event) => {
  // 更新路由参数
  router.replace({
    query: {
      ...route.query,
      tab: tab.props.name
    }
  });
};

const checkPermission = (name: string) => {
  return userId.value ? PERMISSION_ID_LIST[name].includes(userId.value) : false;
};

// 监听路由参数变化
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && typeof newTab === "string") {
      activeName.value = newTab;
    } else if (!newTab) {
      activeName.value = "excamination";
    }
  }
);

// 监听 tab 变化，同步到路由
watch(activeName, (newVal) => {
  if (newVal !== route.query.tab) {
    router.replace({
      query: {
        ...route.query,
        tab: newVal
      }
    });
  }
});

onMounted(() => {
  initActiveName();
});
</script>

<template>
  <div class="px-[20px] py-[20px] pt-[70px]">
    <NavBar />
    <el-tabs
      v-model="activeName"
      type="card"
      class="demo-tabs peidi-el-tabs-modern-tabs"
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

      <el-tab-pane
        label="设计考核"
        name="designer"
        lazy
        v-if="checkPermission('designer')"
      >
        <Designer v-if="activeName === 'designer'" />
      </el-tab-pane>

      <!-- #region 自动化考核 -->
      <el-tab-pane
        label="自动化考核"
        name="evaluation"
        lazy
        v-if="checkPermission('evaluation')"
      >
        <Evaluation v-if="activeName === 'evaluation'" />
      </el-tab-pane>
      <!-- #endregion 自动化考核 -->
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
