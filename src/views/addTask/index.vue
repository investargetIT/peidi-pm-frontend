<script lang="ts" setup>
import { ref } from "vue";
import addTask from "../classify/addTask.vue";
</script>

<template>
  <div class="container">
    <addTask actionType="new" />
  </div>
</template>

<style scoped lang="scss">
.container {
  padding-right: 130px;
}
</style>
