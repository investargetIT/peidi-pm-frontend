<script setup lang="ts">
import AiDrawingDev from "@/views/aiDrawing/dev/index.vue";
</script>

<template>
  <div>
    <el-tabs type="border-card">
      <el-tab-pane label="AI绘图" name="aiDrawingDev">
        <AiDrawingDev />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>