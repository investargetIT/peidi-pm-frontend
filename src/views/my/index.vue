<script setup lang="ts">
import {
  getAllCate,
  addCate,
  updateCate,
  deleteCate,
  getPageCate,
  getJsApi
} from "@/api/user";
import { ddAuthFun } from "../../utils/ddApi";
import Cookies from "js-cookie";
import { ref, watch } from "vue";
import * as dd from "dingtalk-jsapi";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";
import TaskDetailModal from "../classify/TaskDetailModal.vue";
import { message } from "@/utils/message";
import {
  getTaskPage,
  getPriorty,
  getStatusEnum,
  getPriorityEnum,
  getWorkTypeEnum,
  getTaskTypeEnum,
  updateTask
} from "../../api/pmApi";
import axios from "axios";
import { extractInfo } from "../classify/utils";
import AddTask from "../classify/addTask.vue";
import {
  ElDialog,
  ElCard,
  ElRow,
  ElCol,
  ElFormItem,
  ElTable,
  ElTableColumn,
  ElButton,
  dayjs
} from "element-plus";
import { updateExpectData, isSuperAdmin } from "../../utils/permission";
import Level from "../../components/Common/level.vue";
import { useRoute } from 'vue-router'
import CloseTask from "../classify/closeTask.vue";
const route = useRoute()

ddAuthFun();

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}
setTimeout(() => {
  initDingH5RemoteDebug();
}, 100);
const isSuperAdminUser = ref(false);
isSuperAdmin()
.then(res => {
  isSuperAdminUser.value = res;
})
const taskStatus = ref([]);
getStatusEnum().then(res => {
  taskStatus.value = res;
  console.log("taskStatus.value", taskStatus.value);
});

const priorityEnum = ref([]);
getPriorityEnum().then(res => {
  priorityEnum.value = res;
});

const workTypeEnum = ref([]);
getWorkTypeEnum().then(res => {
  workTypeEnum.value = res;
  workTypeEnum.value.map(item => {
    item.showValue = extractInfo(item.value).name;
    item.workerAds = extractInfo(item.value).workerMasterId;
    console.log("item.showValue", item.value, item.showValue, item.workerAds);
  });
  getCurrentPage();
});

const taskTypeEnum = ref([]);
getTaskTypeEnum().then(res => {
  taskTypeEnum.value = res;
});
const nonceStr = "pmUsed";

// const tableData = ref([]);

const currentPage = ref([]);
const pageSizeArr = ref([5, 10, 15, 20]);
const pageSize = ref(pageSizeArr.value[1]);

const handleSizeChange = (val: number) => {
  pageSize.value = val;
};
const currentPageNum = ref(1);

const getAllCateFun = () => {
  getAllCate({}).then(res => {
    console.log("res", res);
    if (res?.code) {
      tableData.value = res?.data || [];
    }
  });
};

const getCurrentPage = () => {
  console.log("form.value", form.value);
  let searchArr: any = [];
  // 添加worktype的筛选
  if (activeTab.value) {
    searchArr.push({
      searchName: { creator: "creator", worker: "worker" }[activeTab.value],
      searchType: "like",
      searchValue: ddUserInfo.userid
    });
  }

  // 添加任务优先级筛选
  if (form.value.priority) {
    searchArr.push({
      searchName: "priorityId",
      searchType: "equals",
      searchValue: form.value.priority
    });
  }
  // 添加任务状态筛选
  if (form.value.status) {
    searchArr.push({
      searchName: "statusId",
      searchType: "equals",
      searchValue: form.value.status
    });
  }
  // 添加任务主题筛选
  if (form.value.topic) {
    searchArr.push({
      searchName: "title",
      searchType: "like",
      searchValue: form.value.topic
    });
  }

  // 添加任务描述
  if (form.value.description) {
    searchArr.push({
      searchName: "description",
      searchType: "like",
      searchValue: form.value.description
    });
  }

  // [{ "searchName": "worker", "searchType": "equal", "searchValue": "userid" }]
  getTaskPage({
    pageNo: Number(currentPageNum.value),
    pageSize: Number(pageSize.value),
    userId: ddUserInfo?.userid || "",
    searchStr: JSON.stringify(searchArr)
  }).then(res => {
    console.log("res", res);
    if (res?.code) {
      currentPage.value = res?.data?.records || [];
      currentPage.value.map(item => {
        item.workerAds = [
          { userId: extractInfo(item.workTypeName).workerMasterId }
        ];
      });
      console.log("currentPage", currentPage.value);
      allLength.value = res.data.total;
    }
  });
};

// getAllCateFun();

const dialogFormVisible = ref(false);
const formLabelWidth = "140px";
const newCateData = ref({
  name: "",
  code: "",
  date1: "",
  date2: "",
  delivery: false,
  type: [],
  resource: "",
  desc: ""
});

const activeCateData = ref({});
const dialogUpdateVisible = ref(false);
const dialogDeleteVisible = ref(false);

const changeCurrentPage = val => {
  console.log("val", val);
};

const formRef = ref(null);
const rules = ref({
  name: [{ required: true, message: "Please input name", trigger: "blur" }],
  code: [{ required: true, message: "Please input code", trigger: "blur" }]
});

// 定义数据
const activeTab = ref("creator");
if (route.query.tabName == 'worker') {
  activeTab.value = 'worker'
}
const form = ref({
  status: "",
  priority: "",
  workType: "",
  requester: "",
  assignee: "",
  range: "",
  topic: "",
  description: ""
});

watch(
  [currentPageNum, pageSize, activeTab, form],
  () => {
    console.log("currentPageNum", currentPageNum.value);
    getCurrentPage();
  },
  { deep: true }
);
const tableData = ref([
  {
    id: "T1485",
    type: "需求",
    topic: "某科技公司任务",
    requester: "冶东",
    assignee: "欧阳产",
    workType: "需求调研",
    estimateTime: "10",
    endDate: "2024-12-10",
    status: "低",
    priority: "中",
    taskType: "普通任务( TASK )",
    actualTime: "4.5",
    workRecords: [
      {
        content: "qwe",
        timeRange: "2024-12-03 13:45至2024-12-03 18:15",
        worker: "欧阳产",
        recordTime: "2024-12-03 14:49"
      }
    ]
  }
]);

const handleTopicClick = row => {
  console.log("row", row);
  if (row.statusName == '已关闭') {
    return
  }
  if (!row.workers?.length) {
    return
  }
  taskDetailModal.value.taskDetail = row;
  taskDetailModal.value.isVisible = true;
};

const taskDetailModal = ref({
  isVisible: false,
  taskDetail: {}
});

// 定义方法
const handleTabClick = tab => {
  console.log("切换到", tab.name);
};
const search = () => {
  console.log("搜索", form.value);
};
const clear = () => {
  form.value = {
    status: "",
    priority: "",
    workType: "",
    requester: "",
    assignee: "",
    range: "",
    topic: ""
  };
};


const updateMyTask = val => {
  if (val.statusName == '已关闭' || val.statusName == '待处理') {
    return
  }
  taskData.value = val;
  dialogFormVisible.value = true;
};

const taskData = ref(null);

const getAllName = list => {
  let name = "";
  list.map(item => {
    name += item.userName + ",";
  });
  name = name.slice(0, -1);
  return name;
};

const updateDialogStatus = ref(false);
const updateCommunicateData = ref({});
let beforeexpectEndDate = "";
const doCommunicate = val => {
  if (!updateExpectData(val)) {
    message("当前角色没有权限更改", { type: "error" });

    return;
  }
  if (val.statusName != "待沟通") {
    return;
  }
  updateDialogStatus.value = true;
  beforeexpectEndDate = val.expectEndDate;
  updateCommunicateData.value = JSON.parse(JSON.stringify(val));
};

const updateCommunicate = () => {
  function compareDates() {
    const endTimeDate = new Date(updateCommunicateData.value.endTime);
    const expectEndDateDate = new Date(
      updateCommunicateData.value.expectEndDate
    );
    return expectEndDateDate >= endTimeDate;
  }

  let updateContent = `${dayjs(Date.now()).format("YYYY/MM/DD")}:从${beforeexpectEndDate}改为${dayjs(updateCommunicateData.value.expectEndDate).format("YYYY/MM/DD")}(by${ddUserInfo.name})`;
  // 如果当前期望时间 大=于 endTime 就可以变成待处理了

  updateTask({
    ...updateCommunicateData.value,
    updateContent,
    expectEndDate: dayjs(updateCommunicateData.value.expectEndDate).format(
      "YYYY-MM-DD"
    ),
    updateUser: { userName: ddUserInfo.name, userId: ddUserInfo.userid },
    statusId: compareDates()
      ? taskStatus.value.find(item => item.value == "待处理").id
      : updateCommunicateData.value.statusId,
    statusName: compareDates()
      ? taskStatus.value.find(item => item.value == "待处理").value
      : updateCommunicateData.value.statusName
  }).then(res => {
    const { code } = res;
    if (code == 200) {
      message("更新成功", { type: "success" });
      updateDialogStatus.value = false;
      getCurrentPage();
    }
  });
};

const tableRowClassName = ({ row, rowIndex }) => {
  if (row.statusName === "待沟通") {
    return "warning-row";
  }
  return "";
};
const closeData = ref({});
const closeModalShow = ref(false);

const closeTask = (val) => {
  closeModalShow.value = true;
  closeData.value = JSON.parse(JSON.stringify(val));
}

const allLength = ref(0);
</script>

<template>
  <div class="container">
    <el-card style="width: 100%" class="box-card">
      <!-- <el-tabs v-model="activeTab" @tab-click="handleTabClick">
        <el-tab-pane v-for="item in workTypeEnum" :label="item.showValue" :name="item.id"></el-tab-pane>
      </el-tabs> -->
      <div class="w-full h-[50px] bg-[#f2f2f3] flex p-2 justify-between mb-6">
        <div @click="activeTab = 'creator'" :class="[
            'cursor-pointer',
            'text-center',
            'leading-[35px]',
            'w-[50%]',
            'h-full',
            activeTab == 'creator' ? 'bg-white' : ''
          ]">
          我发起的任务
        </div>
        <div @click="activeTab = 'worker'" :class="[
            'cursor-pointer',
            'text-center',
            'leading-[35px]',
            'align-middle',
            'w-[50%]',
            'h-full',
            activeTab == 'worker' ? 'bg-white' : ''
          ]">
          分配给我的任务
        </div>
      </div>
      <el-form :inline="true" :model="form">
        <el-form-item style="width: 20%" label="任务状态">
          <el-select v-model="form.status" placeholder="任务状态">
            <el-option v-for="item in taskStatus" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item style="width: 20%" label="优先级">
          <el-select v-model="form.priority" placeholder="优先级">
            <el-option v-for="item in priorityEnum" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <!-- <el-form-item style="width: 30%;" label="任务类型">
          <el-select v-model="form.workType" placeholder="任务类型">
            <el-option v-for="item in taskTypeEnum" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item> -->
        <el-form-item style="width: 10%">
          <el-input v-model="form.topic" placeholder="主题/描述内容"></el-input>
        </el-form-item>
        <el-form-item style="width: 15%">
          <el-input v-model="form.description" placeholder="描述内容"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button color="#171719" type="primary" icon="search" @click="getCurrentPage">搜索</el-button>
          <el-button icon="refresh" @click="clear">清空</el-button>
        </el-form-item>
      </el-form>
      <el-table :row-class-name="tableRowClassName" :data="currentPage" style="
          width: 100%;
          color: #000;
          border: 1px solid #eee;
          border-radius: 8px;
        ">
        <el-table-column prop="workTypeName" label="工作内容">
          <template #default="scope">
            <span>{{ (scope.row.workContent) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="priorityName" label="优先级">
          <template #default="scope">
            <Level :level="scope.row.priorityName" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="任务主题">
          <template #default="scope">
            <span class="clickable-topic" @click="
                activeTab == 'worker'
                  ? handleTopicClick(scope.row)
                  : updateMyTask(scope.row)
              ">{{ scope.row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="contacters" label="需求发起人">
          <template #default="scope">
            <span>{{
              scope.row.contacters?.length
              ? getAllName(scope.row.contacters)
              : "-"
              }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="workers" label="承接人">
          <template #default="scope">
            <span>{{
              scope.row.workers?.length ? getAllName(scope.row.workers) : "-"
              }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="predictDuration" label="预计工时">
          <template #default="scope">
            <span>{{
              scope.row.predictDuration ? scope.row.predictDuration : "-"
              }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="expectEndDate" label="期望完成时间"></el-table-column>
        <el-table-column prop="endTime" label="交付时间">
          <template #default="scope">
            <span>{{ scope.row.endTime ? scope.row.endTime : "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="statusName" label="任务状态">
          <template #default="scope">
            <span @click="doCommunicate(scope.row)" :class="[
                scope.row.statusName == '待沟通'
                  ? 'underline cursor-pointer'
                  : ''
              ]">{{ scope.row.statusName ? scope.row.statusName : "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="closeDescriptionExt" label="关闭原因">
          <template #default="scope">
            <el-tooltip class="item cursor-pointer" effect="dark" v-if="scope.row.closeDescriptionExt"
              :content="scope.row.closeDescriptionExt" placement="top">
              <span>{{
                scope.row.closeDescriptionExt?.length > 20
                  ? scope.row.closeDescriptionExt.slice(0, 20) + '...'
                  : scope.row.closeDescriptionExt
              }}</span>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button @click="closeTask(scope.row)"
            v-if="scope.row.statusName != '已关闭'"
              :disabled="!isSuperAdminUser && (scope.row.statusName != '待处理'  || (scope.row.workers?.length && scope.row.predictDuration))">
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-pagination class="pagination" v-model:current-page="currentPageNum" @current-change="changeCurrentPage"
      v-model:page-size="pageSize" :page-sizes="pageSizeArr" @size-change="handleSizeChange"
      layout="total, sizes, prev, pager, next, jumper" :total="allLength" />
    <el-dialog v-model="updateDialogStatus" width="500px" title="更新任务状态">
      <el-form :rules="{
          expectEndDate: [
            { required: true, message: '选择时间范围', trigger: 'blur' }
          ]
        }" ref="formRef" :model="updateCommunicateData" label-width="auto" style="max-width: 600px">
        <el-form-item label="新的期望完成时间" prop="expectEndDate">
          <div class="block">
            <el-date-picker v-model="updateCommunicateData.expectEndDate" type="date" placeholder="选择期望结束日期" />
          </div>
        </el-form-item>
        <el-form-item label="修改备注" prop="workText">
          <el-input v-model="updateCommunicateData.updateRemark" />
        </el-form-item>
        <el-button @click="updateCommunicate" style="margin-left: 230px" color="#171719">
          确定更新
        </el-button>
      </el-form>
    </el-dialog>
    <TaskDetailModal @closeModal="taskDetailModal.isVisible = false" v-if="taskDetailModal.isVisible"
      :taskDetail="taskDetailModal.taskDetail" :taskStatus="taskStatus">
    </TaskDetailModal>
    <el-dialog v-model="dialogFormVisible" title="修改任务" width="800">
      <!-- <myTask v-if="dialogFormVisible" @finish="getCurrentPage" @close="dialogFormVisible = false" actionType="edit"
        :taskData="taskData" /> -->
      <AddTask v-if="dialogFormVisible" @finish="getCurrentPage" @close="dialogFormVisible = false" :actionType="'my'"
        :taskData="taskData" />
    </el-dialog>
    <CloseTask v-if="closeModalShow" v-model:closeModalShow="closeModalShow" :closeData="closeData"
      @refresh="getCurrentPage" />
  </div>
</template>

<style scoped>
.helpers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 4px;
  margin-top: 4px;
}

.help-item {
  display: flex;
  align-items: center;
  padding: 0 4px;
  cursor: pointer;
  border: 1px solid #aaa;
  border-radius: 8px;
}

.container {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;

  /* padding-top: 54px; */
  padding: 0 30px;
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

.box-card {
  margin-bottom: 20px;
}

.clickable-topic {
  color: #000;

  /* 可以设置为你想要的颜色 */
  text-decoration: underline;
  cursor: pointer;
}
</style>
<style>
.el-table .warning-row {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}
</style>
