<template>
  <div
    :class="{
      item: true,
      low: level == '低',
      middle: level == '中',
      high: level == '高'
    }"
  >
    {{ level }}
  </div>
</template>

<script setup lang="ts">
const { level } = defineProps(["level"]);
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 22px;
  font-weight: 500;
  border-radius: 10px;
}

.low {
  color: #000;
  background-color: #f2f2f3;
}

.middle {
  color: #1a1818;
  background-color: #d6d6e7;
}

.high {
  color: #fff;
  background-color: #f23c3e;
}
</style>
