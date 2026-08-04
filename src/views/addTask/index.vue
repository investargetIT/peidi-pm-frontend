<script lang="ts" setup>
import addTask from "../classify/addTask.vue";
</script>

<template>
  <div class="container">
    <addTask actionType="new" autoSaveKey="peidi_task_draft" />
  </div>
</template>

<style scoped lang="scss">
.container {
  padding-right: 130px;
}
</style>
