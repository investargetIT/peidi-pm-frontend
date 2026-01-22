<script setup lang="ts">
import { onMounted } from "vue";
import { testAllIPs } from "@/utils/chaohuiapi_pro";

onMounted(() => {
  testAllIPs();
});
</script>

<template>
  <div>debug</div>
</template>
