<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import NavBar from "./navBar.vue";

// 引入全局样式（覆盖主应用样式）
import "../aiDrawingPro/style/reset.scss";

const route = useRoute();
const router = useRouter();

onMounted(() => {
  // 检查是否为首次登录进入，强制刷新确保全局样式正确覆盖
  if (route.query.firstLogin === "true") {
    const newQuery = { ...route.query };
    delete newQuery.firstLogin;
    router.replace({ query: newQuery }).then(() => {
      window.location.reload();
    });
    return;
  }
});
</script>

<template>
  <div class="work-hours-board-container">
    <NavBar />
    <div class="work-hours-content">
      <!-- 工时看板内容开发区域 -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.work-hours-board-container {
  width: 100%;
  height: 100%;
}

.work-hours-content {
  padding-top: 50px;
  height: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding-top: 46px;
  }
}
</style>
