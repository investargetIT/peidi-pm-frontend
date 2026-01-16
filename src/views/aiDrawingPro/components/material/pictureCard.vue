<script setup lang="ts">
import OnlineImg from "../../common/onlineImg.vue";
import { getNameFromObjectName } from "../../utils/general/index";

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <div>
    <el-card style="width: 240px">
      <template #header>
        <span>{{ getNameFromObjectName(props.data.objectName) }}</span>
      </template>

      <div class="flex justify-center items-center">
        <OnlineImg :url="props.data.objectName" size="180px" />
      </div>
    </el-card>
  </div>
</template>
