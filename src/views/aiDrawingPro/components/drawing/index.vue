<script setup lang="ts">
import { onMounted, provide, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { getAiDrawPage, getMaterialPage } from "@/api/aiDraw";
import OperationCard from "./operationCard.vue";
import TableDataCard from "./tableDataCard.vue";
import EditDialog from "./editDialog.vue";
import { ExcelTableItem } from "../../type/drawing";
import { POLL_INTERVAL } from "../../config/drawing";

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

const materialList = ref<any>({});

//#region 轮询逻辑
const pollForUpdatesTimer = ref(null);
const isPolling = ref<boolean>(false);
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
        let isPollingTemp = false;
        const temp = [];
        const uuIds = [];
        if (res.data.records) {
          res.data.records.forEach((item: any) => {
            if (item.status === 0) {
              isPollingTemp = true;
            }
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
        isPolling.value = isPollingTemp;

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

// 获取素材库结果
const fetchMaterialPage = () => {
  return getMaterialPage({
    pageNo: 1,
    pageSize: 9999
  })
    .then((res: any) => {
      if (res.code === 200) {
        const materialListTemp = {};
        res.data.records.forEach((item: any) => {
          const mtype = JSON.parse(item.type)?.mtype;
          if (mtype) {
            if (!materialListTemp[mtype]) {
              materialListTemp[mtype] = [item];
            } else {
              materialListTemp[mtype].push(item);
            }
          }
        });

        materialList.value = materialListTemp;
        // console.log("素材库数据:", materialList.value);
      } else {
        ElMessage.error("获取素材库失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("获取素材库失败:" + error.message);
    });
};
//#endregion

onMounted(async () => {
  await fetchMaterialPage();
  fetchAiDrawPage();
});

watch(
  isPolling,
  (newVal, oldVal) => {
    if (newVal === true && oldVal === false) {
      pollForUpdatesTimer.value = setInterval(
        () => fetchAiDrawPage(),
        POLL_INTERVAL
      );
    }
    if (newVal === false) {
      if (pollForUpdatesTimer.value) {
        clearInterval(pollForUpdatesTimer.value);
        pollForUpdatesTimer.value = null;
      }
    }
  },
  {
    immediate: true
  }
);

//#region 编辑弹窗逻辑
const editDialogRef = ref<typeof EditDialog>();

const updateTemplateImg = (row: ExcelTableItem, index: number | string) => {
  console.log("编辑弹窗打开:", row, index);

  editDialogRef.value?.open(row, index);
};
provide("updateTemplateImg", updateTemplateImg);
//#endregion
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
      :materialList="materialList"
    />

    <div>
      <EditDialog ref="editDialogRef" />
    </div>
  </div>
</template>
