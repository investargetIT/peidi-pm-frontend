<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getExaminationRecordResult } from '@/api/pmApi.ts'
import { Download } from '@element-plus/icons-vue';
import { exportExaminationTable } from './utils/export.ts';
import { ElMessage, ElLoading } from 'element-plus';

const loading = ref(false);
const monthList = ref([]);
const tableData = ref([]);
const searchForm = ref({
  userName: '',
})

// 处理搜索参数
const handleSearchParams = () => {
  const searchStr: any = [];
  if (searchForm.value.userName) {
    searchStr.push({
      searchName: "userName",
      searchType: "like",
      searchValue: searchForm.value.userName
    })
  }
  return JSON.stringify(searchStr);
}

// 处理重置操作
const handleReset = () => {
  searchForm.value = {
    userName: '',
  }
  fetchResultList();
}

// 导出Excel
const handleExport = async () => {
  if (tableData.value.length === 0) {
    ElMessage.warning('暂无数据可导出');
    return;
  }

  const loadingInstance = ElLoading.service({
    lock: true,
    text: '正在生成Excel文件，请稍候...',
    background: 'rgba(0, 0, 0, 0.7)'
  });

  try {
    await exportExaminationTable(tableData.value, monthList.value);
    ElMessage.success('导出成功');
  } catch (error) {
    console.error('导出失败:', error);
    ElMessage.error('导出失败，请重试');
  } finally {
    loadingInstance.close();
  }
}

//#region 请求相关
const fetchResultList = () => {
  loading.value = true;
  getExaminationRecordResult({
    searchStr: handleSearchParams(),
  }).then((res: any) => {
    if (res.code === 200) {
      if (res.data.length === 0) {
        tableData.value = [];
        return
      }

      monthList.value = res.data[0].examination[0].data.map((item: any) => item.month);

      const tableDataTemp: any = []
      res.data.forEach((item: any) => {
        item.examination.forEach((examinationItem: any) => {
          const monthData = examinationItem.data.reduce((acc: any, cur: any) => {
            acc[cur.month] = cur.value;
            return acc;
          }, {});
          tableDataTemp.push({
            ...item,
            ...examinationItem,
            dataSum: examinationItem.data.reduce((acc: number, cur: any) => acc + cur.value, 0),
            ...monthData
          })
        })
      });
      tableData.value = tableDataTemp;
    }
  }).finally(() => {
    loading.value = false;
  })
}
//#endregion

// 数值格式化 
const formatPice = (num: number | string) => {
  const number = Number(num);
  if (isNaN(number)) {
    return num;
  }
  if (number >= 10000) {
    return (number / 10000).toFixed(2) + ' 万元';
  }
  return number.toFixed(2);

}

onMounted(() => {
  fetchResultList();
})
</script>

<template>
  <div>
    <el-card shadow="never">
      <el-form :model="searchForm" inline>
        <el-form-item label="考核人" prop="userName">
          <el-input v-model="searchForm.userName" placeholder="请输入考核人" clearable style="width: 200px;" />
        </el-form-item>
        <el-form-item>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="fetchResultList">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card shadow="never" class="mt-[12px]">
      <div class="flex justify-between items-center mb-[12px]">
        <div class="text-[16px]">绩效数据</div>
        <div>
          <el-button type="primary" @click="handleExport" :icon="Download">
            导出
          </el-button>
        </div>
      </div>
      <el-table :data="tableData" style="width: 100%" :header-cell-style="{ color: '#606266' }" height="700px"
        v-loading="loading">
        <el-table-column prop="department1" label="一级部门" min-width="150px" />
        <el-table-column prop="department2" label="二级部门" min-width="150px" />
        <el-table-column prop="examinationGroup" label="考核组" min-width="150px" />
        <el-table-column prop="userName" label="考核人" min-width="150px" />
        <el-table-column prop="examinationType" label="指标名称" min-width="150px" />
        <el-table-column prop="dataType" label="数据类型" min-width="150px" />
        <el-table-column prop="dataSum" label="当前数据合计" min-width="150px">
          <template #default="scope">
            {{ formatPice(scope.row.dataSum) }}
          </template>
        </el-table-column>
        <el-table-column v-for="month in monthList" :key="month" :prop="month" :label="month" min-width="150px">
          <template #default="scope">
            {{ formatPice(scope.row[month]) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.el-form-item {
  margin-bottom: 0;
}
</style>