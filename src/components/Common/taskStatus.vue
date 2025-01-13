<template>
  <div
    :class="{
      item: true,
  low: statusName == '待处理',
  middle: statusName == '进行中',
  high: statusName == '已完成',
  close: statusName == '已关闭',
      
    }"
  >
    {{ statusName }}
  </div>
</template>

<script setup lang="ts">
const { statusName } = defineProps(["statusName"]);
</script>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 22px;
  font-weight: 500;
  border-radius: 10px;
  color: #000;
}

.low {
  background-color: #f7e1d6;
}

.middle {
  background-color: #eebda7;
}
.close{
  background-color: #f23c3e;
}
.high {
  background-color: #e89a79;
}
</style>
