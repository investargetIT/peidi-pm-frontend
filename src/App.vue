<template>
  <el-config-provider :locale="currentLocale">
    <router-view />
    <ReDialog />

    <!-- 调试浮层 -->
    <div class="debug-overlay" v-if="debugEnabled">
      <div class="debug-header" @click="minimized = !minimized">
        🔍 URL 调试
        <span style="float: right; cursor: pointer;">{{ minimized ? '展开' : '收起' }}</span>
      </div>
      <div class="debug-content" v-show="!minimized">
        <p><strong>完整 URL:</strong> <span class="debug-url">{{ currentUrl }}</span></p>
        <p><strong>Hash:</strong> <span class="debug-hash">{{ currentHash }}</span></p>
        <p><strong>初始 URL:</strong> <span class="debug-initial">{{ initialUrl }}</span></p>
        <div style="margin-top: 10px;">
          <button @click="saveDebug" style="margin-right: 5px; padding: 4px 8px;">保存</button>
          <button @click="disableDebug" style="padding: 4px 8px; background: #f56c6c; color: white;">禁用</button>
        </div>
      </div>
    </div>
  </el-config-provider>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from "vue";
import { ElConfigProvider } from "element-plus";
import { ReDialog } from "@/components/ReDialog";
import zhCn from "element-plus/es/locale/lang/zh-cn";

export default defineComponent({
  name: "app",
  components: {
    [ElConfigProvider.name]: ElConfigProvider,
    ReDialog
  },
  setup() {
    // 检查是否启用调试模式
    const isDebugEnabled = () => {
      // 方式1: localStorage 有标记
      if (localStorage.getItem("debug_enabled") === "true") return true;
      // 方式2: URL 中有 debug=true 参数
      if (window.location.search.includes("debug=true")) return true;
      if (window.location.hash.includes("debug=true")) return true;
      return false;
    };

    const debugEnabled = ref(isDebugEnabled());
    const minimized = ref(false);
    const currentUrl = ref(window.location.href);
    const currentHash = ref(window.location.hash);
    const initialUrl = ref(localStorage.getItem("debug_initial_url") || "未记录");

    const disableDebug = () => {
      localStorage.removeItem("debug_enabled");
      debugEnabled.value = false;
    };

    const saveDebug = () => {
      const records = JSON.parse(localStorage.getItem("app_debug_records") || "[]");
      records.push({
        time: new Date().toLocaleString(),
        url: window.location.href,
        hash: window.location.hash
      });
      localStorage.setItem("app_debug_records", JSON.stringify(records.slice(-20)));
      alert("已保存调试记录！");
    };

    onMounted(() => {
      // 定期更新
      setInterval(() => {
        currentUrl.value = window.location.href;
        currentHash.value = window.location.hash;
      }, 500);
    });

    return {
      debugEnabled,
      minimized,
      currentUrl,
      currentHash,
      initialUrl,
      saveDebug,
      disableDebug
    };
  },
  computed: {
    currentLocale() {
      return zhCn;
    }
  }
});
</script>

<style>
.debug-overlay {
  position: fixed;
  top: 10px;
  right: 10px;
  width: 350px;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  border-radius: 8px;
  z-index: 9999;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.debug-header {
  padding: 10px 15px;
  background: #409eff;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  font-weight: bold;
}
.debug-content {
  padding: 15px;
}
.debug-url, .debug-hash, .debug-initial {
  display: block;
  word-break: break-all;
  margin-top: 5px;
  padding: 5px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}
.debug-hash {
  color: #67c23a;
}
.debug-initial {
  color: #e6a23c;
}
</style>

