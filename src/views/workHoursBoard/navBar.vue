<script setup lang="ts">
import { ElMessage } from "element-plus";
import { onMounted, ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { emitter } from "@/utils/mitt";

const { getLogo } = useNav();

const username = ref("");

const handleExit = () => {
  // 暴力退出 清空cookie
  document.cookie.split(";").forEach(cookie => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });

  window.location.href = window.location.origin + "/#/workHoursBoard";
};

onMounted(() => {
  emitter.on("logout", () => {
    handleExit();
  });
  // 从localStorage中获取用户名 ddUserInfo对象里的name
  const ddUserInfo = JSON.parse(localStorage.getItem("ddUserInfo") || "{}");
  if (ddUserInfo.name) {
    username.value = ddUserInfo.name;
  }
});
</script>

<template>
  <div class="work-hours-navbar">
    <div class="navbar-left">
      <img class="navbar-logo" :src="getLogo()" alt="logo" />
      <span class="navbar-title">工时看板</span>
    </div>

    <div class="navbar-right">
      <el-dropdown trigger="click">
        <span class="el-dropdown-link">
          <div class="navbar-user">
            {{ username }}
          </div>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleExit">
              <span class="dropdown-text">退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.work-hours-navbar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 50px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 -2px 4px rgb(0 0 0 / 50%);

  @media (max-width: 768px) {
    height: 46px;
  }
}

.navbar-left {
  display: flex;
  align-items: center;
  padding-left: 20px;
  gap: 12px;

  @media (max-width: 768px) {
    padding-left: 12px;
  }
}

.navbar-logo {
  height: 32px;

  @media (max-width: 768px) {
    height: 28px;
  }
}

.navbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;

  @media (max-width: 768px) {
    font-size: 14px;
  }
}

.navbar-right {
  padding-right: 20px;

  @media (max-width: 768px) {
    padding-right: 12px;
  }
}

.navbar-user {
  font-size: 16px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;

  &:hover {
    background-color: #f5f7fa;
  }

  @media (max-width: 768px) {
    font-size: 14px;
    height: 46px;
    padding: 0 12px;
  }
}

.dropdown-text {
  font-size: 14px;
  padding: 5px 0;
}

:deep(.el-tooltip__trigger:focus-visible) {
  outline: unset;
}
</style>
