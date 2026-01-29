<script setup lang="ts">
import { storageLocal } from "@pureadmin/utils";
import { ElMessage } from "element-plus";
import { onMounted, reactive, ref } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { emitter } from "@/utils/mitt"; // 添加mitt导入

const { getLogo } = useNav();

const username = ref("");

const handleExit = () => {
  // 暴力退出 清空cookie
  document.cookie.split(";").forEach(cookie => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });

  window.location.href = window.location.origin + "/#/examination";
};

onMounted(() => {
  emitter.on("logout", () => {
    handleExit(); // 使用现有的退出逻辑
  });
  // 从localStorage中获取用户名 ddUserInfo对象里的name
  const ddUserInfo = JSON.parse(localStorage.getItem("ddUserInfo") || "{}");
  if (ddUserInfo.name) {
    username.value = ddUserInfo.name;
  }
});
</script>

<template>
  <div class="peidi-examination-navbar">
    <div>
      <img class="h-[32px] ml-[20px]" :src="getLogo()" alt="logo" />
    </div>

    <div class="mr-[20px]">
      <el-dropdown trigger="click">
        <span class="el-dropdown-link">
          <div
            class="peidi-examination-navbar-user text-[16px] h-[50px] flex items-center justify-center px-[20px]"
          >
            {{ username }}
          </div>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="handleExit">
              <span class="text-[14px] py-[5px]">退出登录</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.peidi-examination-navbar {
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
  // 底部阴影
  box-shadow: 0 -2px 4px rgb(0 0 0 / 50%);

  .peidi-examination-navbar-user {
    &:hover {
      background-color: #f5f7fa;
    }
  }
}

.el-tooltip__trigger:focus-visible {
  outline: unset;
}
</style>
