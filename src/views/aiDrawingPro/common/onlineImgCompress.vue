<script setup lang="ts">
const props = defineProps({
  url: {
    type: String,
    default: ""
  },
  size: {
    type: String,
    default: "120px"
  }
});
</script>

<template>
  <div>
    <div>
      <!-- <el-image
        :src="compressedImageUrl"
        fit="contain"
        preview-teleported
 
        :style="{ width: props.size, height: props.size }"
      >
      </el-image> -->
    </div>
  </div>
</template>
