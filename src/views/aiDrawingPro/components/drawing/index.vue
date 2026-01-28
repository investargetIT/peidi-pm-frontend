<script setup lang="ts">
import { onMounted, provide, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { getAiDrawPage, getMaterialPage } from "@/api/aiDraw";
import OperationCard from "./operationCard.vue";
import TableDataCard from "./tableDataCard.vue";
import EditDialog from "./editDialog.vue";
import Pagination from "./pagination.vue";
import { ExcelTableItem } from "../../type/drawing";
import { POLL_INTERVAL, EXCEL_TABLE_ITEM_DEFAULT } from "../../config/drawing";

// 表格数据请求loading状态
const loadingTableData = ref<boolean>(false);

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

// 比较数据结构并补充缺失的key
const compareAndCompleteData = (data: any): ExcelTableItem => {
  const completedData = { ...EXCEL_TABLE_ITEM_DEFAULT };

  // 遍历默认结构的所有key
  Object.keys(EXCEL_TABLE_ITEM_DEFAULT).forEach(key => {
    // 如果数据中存在该key，则使用数据的值
    if (data.hasOwnProperty(key)) {
      completedData[key] = data[key];
    }
    // 如果数据中不存在该key，则使用默认值（已经通过展开操作设置）
  });

  return completedData;
};

//#region 轮询逻辑
const pollForUpdatesTimer = ref(null);
const isPolling = ref<boolean>(false);
//#endregion

//#region 请求相关
// 获取ai画图分页结果
const fetchAiDrawPage = () => {
  loadingTableData.value = true;
  getAiDrawPage({
    pageNo: paginationConfig.value.currentPage,
    pageSize: paginationConfig.value.pageSize
  })
    .then((res: any) => {
      if (res.code === 200) {
        // 如果当前页大于总页数，重置为最后一页 排除总页数为0的情况
        if (res.data?.current > res.data?.pages && res.data?.total !== 0) {
          paginationConfig.value.currentPage = res.data?.pages;
          return;
        }

        // 更新总页数
        paginationConfig.value.total = res.data?.total || 0;

        let isPollingTemp = false;
        const temp = [];
        const uuIds = [];
        if (res.data.records) {
          res.data.records.forEach((item: any) => {
            if (item.status === 0) {
              isPollingTemp = true;
            }

            // 解析字段数据并与默认结构比较
            const parsedFields = JSON.parse(item.fields || "{}");
            const completedData = compareAndCompleteData({
              ...parsedFields,
              resultImages: JSON.parse(item.imgs || "[]"),
              status: item.status,
              uuid: item.uuid || null
            });

            temp.push(completedData);
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
    })
    .finally(() => {
      loadingTableData.value = false;
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
  // console.log("编辑弹窗打开:", row, index);

  editDialogRef.value?.open(row, index);
};
provide("updateTemplateImg", updateTemplateImg);
//#endregion

//#region 分页逻辑
const paginationConfig = ref({
  currentPage: 1,
  pageSize: 3,
  total: 0
});

watch(
  [
    () => paginationConfig.value.currentPage,
    () => paginationConfig.value.pageSize
  ],
  ([newCurrentPage, newPageSize], [oldCurrentPage, oldPageSize]) => {
    if (newCurrentPage !== oldCurrentPage || newPageSize !== oldPageSize) {
      // console.log("分页参数改变:", newCurrentPage, newPageSize);
      fetchAiDrawPage();
    }
  },
  { immediate: true }
);
//#endregion

defineExpose({
  fetchMaterialPage
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
      :loadingTableData="loadingTableData"
      v-model:tableData="tableData"
      :handleEditStatus="handleEditStatus"
      :handleGoodsClick="handleGoodsClick"
      :handleSelectionChange="handleSelectionChange"
      :selectedIds="selectedIds"
      :materialList="materialList"
    />

    <Pagination
      v-model:paginationConfig="paginationConfig"
      :loadingTableData="loadingTableData"
    />

    <div>
      <EditDialog ref="editDialogRef" />
    </div>
  </div>
</template>
