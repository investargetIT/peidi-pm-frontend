<script setup lang="ts">
import { onMounted, provide, ref, onUnmounted } from "vue";
import { type ExcelTableItem } from "@/views/aiDrawing/excelTable/type/index";
import TableDataCard from "@/views/aiDrawing/excelTable/components/tableDataCard/index.vue";
import OperationCard from "@/views/aiDrawing/excelTable/components/operationCard/index.vue";
import { getAiDrawPage } from "@/api/aiDraw";
import { ElMessage } from "element-plus";
import { POLL_INTERVAL } from "@/views/aiDrawing/excelTable/utils/constants";

const loading = ref<boolean>(false);
const handleLoadingStatus = (status: boolean) => {
  loading.value = status;
};

const selectedIds = ref<string[]>([]);
const handleSelectionChange = (val: ExcelTableItem[]) => {
  selectedIds.value = val.map(item => item.uiid);
  // console.log("选中的id:", selectedIds.value);
};
const tableData = ref<ExcelTableItem[]>([]);
const handleGoodsClick = (row: ExcelTableItem, index: any) => {
  // console.log("点赞点击:", row, index);
  // 遍历tableData，更新点赞状态
  for (const ele of tableData.value) {
    if (ele.uiid === row.uiid) {
      // 判断更好的模板数据里是否存在当前图片
      const temp = ele.betterTemplateImage[`${row.uiid}_${index}`];
      if (temp) {
        // 存在，移除当前图片
        delete ele.betterTemplateImage[`${row.uiid}_${index}`];
      } else {
        // 不存在，添加到更好的模板数据里
        ele.betterTemplateImage[`${row.uiid}_${index}`] =
          row.resultImages[index];
      }
      break;
    }
  }
  // console.log(tableData.value);
};

const isEdit = ref<boolean>(false);
const handleEditStatus = (status: boolean) => {
  isEdit.value = status;
};

//#region 轮询逻辑
const pollForUpdatesTimer = ref();
//#endregion

//#region 请求相关
// 获取ai画图分页结果
const fetchAiDrawPage = () => {
  getAiDrawPage({
    pageNo: 1,
    pageSize: 9999
  })
    .then((res: any) => {
      if (res.code === 200) {
        const temp = [];
        const uuIds = [];
        if (res.data.records) {
          res.data.records.forEach((item: any) => {
            temp.push({
              ...JSON.parse(item.fields || "{}"),
              resultImages: JSON.parse(item.imgs || "[]"),
              status: item.status,
              uuid: item.uuid || null
            });
            if (item.uuid) {
              uuIds.push(item.uuid);
            }
          });
        }

        const tableLocalData = tableData.value.filter(
          item => item.uuid === null && !uuIds.includes(item.uiid)
        );

        tableData.value = [...tableLocalData, ...temp];

        // tableData.value = temp;
        // console.log("表格数据:", tableData.value);
      } else {
        ElMessage.error("获取ai画图分页结果失败:" + res.msg);
      }
    })
    .catch(err => {
      console.log("获取ai画图分页结果失败", err);
      ElMessage.error("获取ai画图分页结果失败:" + err.message);
    });
};
provide("fetchAiDrawPage", fetchAiDrawPage);
//#endregion

onMounted(() => {
  fetchAiDrawPage();
  // 启动轮询
  pollForUpdatesTimer.value = setInterval(
    () => fetchAiDrawPage(),
    POLL_INTERVAL
  );
});
onUnmounted(() => {
  // 组件卸载时清除轮询
  clearInterval(pollForUpdatesTimer.value);
});
</script>

<template>
  <div>
    <OperationCard
      :loading="loading"
      :tableData="tableData"
      :handleLoadingStatus="handleLoadingStatus"
      :isEdit="isEdit"
      :selectedIds="selectedIds"
    />

    <TableDataCard
      :loading="loading"
      v-model:tableData="tableData"
      :handleEditStatus="handleEditStatus"
      :handleGoodsClick="handleGoodsClick"
      :handleSelectionChange="handleSelectionChange"
      :selectedIds="selectedIds"
    />
  </div>
</template>
