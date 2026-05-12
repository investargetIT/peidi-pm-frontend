<script lang="ts" setup>
import { onMounted } from "vue";
import { getPmKpiGroupNodePage } from "@/api/evaluation";

//#region 请求逻辑
const fetchPmKpiGroupNodePage = () => {
  return getPmKpiGroupNodePage({
    pageNo: 1,
    pageSize: 1
  }).then(res => {
    console.log("获取节点列表", res);
  });
};
//#endregion

onMounted(() => {
  fetchPmKpiGroupNodePage();
});
</script>

<template>
  <div>1</div>
</template>
