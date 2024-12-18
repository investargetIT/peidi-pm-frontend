<script setup lang="ts">
// import {
//   getEnum,
//   getAllCate,
//   addPd,
//   updatePd,
//   deletePd,
//   getPagePd
// } from "@/api/user";
import { ref, watch, onMounted } from "vue";
import DemandSchedule from "./DemandSchedule.vue";
</script>

<template>
  <div class="container">
    <DemandSchedule />
  </div>
</template>

<style scoped>
.container {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 800px;
  padding: 54px;
  margin: 0 !important;
}

.addCate {
  position: absolute;
  top: 4px;
  right: 64px;
}

.pagination {
  margin-top: 20px;
}
</style>

<style>
.disabled-row {
  color: #ccc;
  background-color: #f5f7fa;
}
</style>
