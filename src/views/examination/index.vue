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
  "1926449443739601629", // 杨世豪
  "1926449443739601753" //刘汪洋
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
const userInfo: any = localStorage.getItem("user-check-info")
  ? JSON.parse(localStorage.getItem("user-check-info")!)
  : null;
const userId = ref(userInfo?.id ?? "");

// 从路由参数读取选项卡，没有则使用默认值
const activeName = ref<string>("evaluation");

const initActiveName = () => {
  // 从路由参数获取
  const tabFromQuery = route.query.tab as string;
  activeName.value = tabFromQuery || "evaluation";
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
  newTab => {
    if (newTab && typeof newTab === "string") {
      activeName.value = newTab;
    } else if (!newTab) {
      activeName.value = "evaluation";
    }
  }
);

// 监听 tab 变化，同步到路由
watch(activeName, newVal => {
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
  // 检查是否为首次登录进入，强制刷新确保全局样式正确覆盖
  if (route.query.firstLogin === "true") {
    // 同步重写地址栏，确保 reload 时 firstLogin 一定已从 URL 清除，避免死循环
    const newQuery = { ...(route.query as Record<string, string>) };
    delete newQuery.firstLogin;
    window.history.replaceState(
      null,
      "",
      router.resolve({ path: "/examination", query: newQuery }).href
    );
    window.location.reload();
    return;
  }

  initActiveName();
});
</script>

<template>
  <div class="examination-main-container">
    <NavBar />
    <el-tabs
      v-model="activeName"
      type="card"
      class="examination-tabs"
      @tab-click="handleClick"
      stretch
    >
      <el-tab-pane label="考核页面" name="excamination" lazy v-if="false">
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

      <el-tab-pane label="报表导出" name="reportExport" lazy v-if="false">
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
      <el-tab-pane label="自动化考核" name="evaluation" lazy>
        <Evaluation v-if="activeName === 'evaluation'" />
      </el-tab-pane>
      <!-- #endregion 自动化考核 -->
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.examination-main-container {
  padding: 16px;
  padding-top: 70px;

  @media (max-width: 768px) {
    padding: 10px;
    padding-top: 60px;
  }
}

/* 全局样式：对于使用 flex 布局的按钮容器，清除按钮自身的 margin-left */
/* 这样可以完全依靠 gap 来控制间距，避免换行时的左边距问题 */
:deep(.action-bar),
:deep(.controls-bar),
:deep(.search-form .el-form-item:last-child),
:deep(.search-section .el-form-item:last-child) {
  :deep(.el-button) {
    margin-left: 0 !important;
  }
}

.examination-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 0 8px;
  }

  :deep(.el-tabs__nav-wrap) {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 4px;

    /* 隐藏滚动条 */
    &::-webkit-scrollbar {
      display: none;
    }
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  :deep(.el-tabs__nav) {
    display: flex;
    border: none;
  }

  :deep(.el-tabs__item) {
    padding: 12px 20px;
    font-size: 14px;
    font-weight: 500;
    color: #606266;
    border: none;
    transition: all 0.3s ease;
    height: auto;
    line-height: 1.5;

    &.is-active {
      color: #409eff;
      background: #ecf5ff;
      border-radius: 6px;
      font-weight: 600;
    }

    &:hover:not(.is-active) {
      color: #409eff;
      background: #f5f7fa;
      border-radius: 6px;
    }

    @media (max-width: 768px) {
      padding: 10px 14px;
      font-size: 13px;
      white-space: nowrap;
    }
  }

  :deep(.el-tabs__active-bar) {
    display: none;
  }

  :deep(.el-tabs__content) {
    padding-top: 20px;

    @media (max-width: 768px) {
      padding-top: 16px;
    }
  }
}
</style>
