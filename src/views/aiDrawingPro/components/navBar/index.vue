<script setup lang="ts">
import { onMounted } from "vue";
import { emitter } from "@/utils/mitt"; // 添加mitt导入

const handleExit = () => {
  // 暴力退出 清空cookie
  document.cookie.split(";").forEach(cookie => {
    document.cookie = cookie
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });

  window.location.href = window.location.origin + "/#/aiDrawingApp";
};

onMounted(() => {
  emitter.on("logout", () => {
    handleExit(); // 使用现有的退出逻辑
  });
});
</script>

<template>
  <div></div>
</template>
