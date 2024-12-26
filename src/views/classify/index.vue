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
import AddTask from "./addTask.vue";
import TaskDetailModal from "./TaskDetailModal.vue";
import { message } from "@/utils/message";
import {
  getTaskPage,
  getPriorty,
  getStatusEnum,
  getPriorityEnum,
  getWorkTypeEnum,
  getTaskTypeEnum,
  getTaskTypeApi,
  updateTask,
  getAdminUserEnum
} from "../../api/pmApi";
import axios from "axios";
import { extractInfo, extractEmplId } from "./utils";
import { canExamineTask } from "../../utils/permission";
import Level from "../../components/Common/level.vue";

ddAuthFun();

const closeTask = (val) => {
  updateTask({
    ...val,
    statusId : 70
  })
  .then(res => {
    const { code , data } = res;
    if (code == 200) {
      message("修改任务信息成功", { type: "success" });
      getCurrentPage();
    }
  })
}
// 获取白名单用户
const adminUser = ref([]);
getAdminUserEnum().then(res => {
  adminUser.value = res;
});
// 判断当前钉钉用户是否是管理员
const isAdmin = () => {
  let flag = false;
  adminUser.value.map(item => {
    if (item.id == ddUserInfo?.userid) {
      flag = true;
    }
  });
  return flag;
};
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}
const nonceStr = "pmUsed";
// 判断当前是否是管理员，加上是否是管理员的判断
let params = {};
if (isAdmin()) {
  params = {}
}else{
  params.searchStr = JSON.stringify([{
    searchName: "deptId",
    searchType: "equals",
    searchValue: ddUserInfo?.dept_id_list[0]
  }]);
}
getTaskTypeApi(params)
.then(res => {
  const { code, data } = res;
  if (code == 200) {
    data.map(item => {
      // if (item.level == 1) {
      //   workTypeMap.value.push(JSON.parse(JSON.stringify(item)))
      // }
      if (item.level == 1) {
        workTypeEnum.value.push(JSON.parse(JSON.stringify(item)))
      }
    })
    workTypeEnum.value.map(item => {
      item.showValue = item.level1;
      item.workerAds = [item.userId];
    });
    console.log('workTypeEnum.value', workTypeEnum.value);
    
    activeTab.value = workTypeEnum.value[0].id
    getCurrentPage();
  }
})
const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
setTimeout(() => {
  initDingH5RemoteDebug();
}, 100);

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
const taskTypeEnum = ref([]);
getTaskTypeEnum().then(res => {
  taskTypeEnum.value = res;
});

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
      searchName: "workTypeName",
      searchType: "like",
      searchValue: workTypeEnum.value.find(item => item.id == activeTab.value).level1
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
  // 添加对接人
  if (form.value.requester) {
    searchArr.push({
      searchName: "contacter",
      searchType: "like",
      searchValue: extractEmplId(form.value.requester).join("&#&")
    });
  }

  // 添加worker
  if (form.value.assignee) {
    searchArr.push({
      searchName: "worker",
      searchType: "like",
      searchValue: extractEmplId(form.value.assignee).join("&#&")
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
      allLength.value = res?.data?.total;
      currentPage.value = res?.data?.records || [];
      currentPage.value.map(item => {
        item.workerAds = [
          { userId: workTypeEnum.value.find(item => item.id == activeTab.value).userId }
        ];
      });
      console.log("currentPage1", currentPage.value);
    }
  });
};

// getAllCateFun();

// 清除新增任务信息
const clearNewCateData = () => {
  newCateData.value.name = "";
  newCateData.value.code = "";
};
const choosePerson = type => {
  let data_this =
    type == "contacter" ? form.value.requester : form.value.assignee;
  // let test = [{ "avatar": "", "name": "台江鹏", "emplId": "474805081221550528" }];
  // if (type == 'contacter') {
  //   form.value.requester = (test)
  // }
  // if (type == 'worker') {
  //   form.value.assignee = (test)
  // }
  // return
  dd.biz.contact.choose({
    multiple: true, //是否多选：true多选 false单选； 默认true
    users: extractEmplId(data_this), //默认选中的用户列表，员工userid；成功回调中应包含该信息
    corpId: DINGTALK_CORP_ID, //企业id
    max: 10, //人数限制，当multiple为true才生效，可选范围1-1500
    onSuccess: function (data) {
      console.log("data", data);
      if (type == "contacter") {
        form.value.requester = data;
      }
      if (type == "worker") {
        form.value.assignee = data;
      }
      // alert("dd successs: " + JSON.stringify(data));
    },
    onFail: function (err) {}
  });
};
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

// 更新任务接口
const updateCateData = val => {
  console.log("activeCateData", activeCateData.value);

  if (
    !activeCateData.value.categoryCode ||
    !activeCateData.value.categoryName ||
    !activeCateData.value.id
  ) {
    return;
  }
  updateCate({
    categoryCode: "" + activeCateData.value.categoryCode,
    categoryName: "" + activeCateData.value.categoryName,
    id: activeCateData.value.id
  })
    .then(res => {
      const { code, data, msg } = res;
      if (res.code == 200) {
        message("更新任务成功", { type: "success" });
        dialogUpdateVisible.value = false;
        getAllCateFun();
        getCurrentPage();
      } else {
        message("更新任务失败--" + msg, { type: "error" });
      }
    })
    .catch(err => {
      message("更新任务失败", { type: "error" });
    });
};

// 打开更新弹窗
const openUpdatePop = val => {
  activeCateData.value = JSON.parse(JSON.stringify(val.row));
  dialogUpdateVisible.value = true;
};

// 删除弹窗打开
const deletePop = val => {
  activeCateData.value = JSON.parse(JSON.stringify(val.row));
  dialogDeleteVisible.value = true;
};

const changeCurrentPage = val => {
  console.log("val", val);
};

const formRef = ref(null);
const rules = ref({
  name: [{ required: true, message: "Please input name", trigger: "blur" }],
  code: [{ required: true, message: "Please input code", trigger: "blur" }]
});

// 定义数据
const activeTab = ref('');
const form = ref({
  status: "",
  priority: "",
  workType: "",
  requester: [],
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
    requester: [],
    assignee: "",
    range: "",
    topic: ""
  };
};

let actionType = "new";
const newTask = () => {
  actionType = "new";
  dialogFormVisible.value = true;

  console.log("新建任务");
};

const taskData = ref(null);
const updateTaskFun = data => {
  actionType = "edit";
  let newArr: any = [];
  if (data.attachments) {
    data.attachments.map(item => {
      newArr.push({
        raw: {
          name: item
        },
        response: {
          success: true
        },
        name: item,
        status: "success",
        uid: Date.now()
      });
    });
  }
  data.attachments = JSON.parse(JSON.stringify(newArr));
  taskData.value = data;
  dialogFormVisible.value = true;
};

const getAllName = list => {
  let name = "";
  list.map(item => {
    name += item.userName + ",";
  });
  name = name.slice(0, -1);
  return name;
};

const allLength = ref(0);
</script>

<template>
  <div class="container">
    <el-card style="width: 100%" class="box-card">
      <el-tabs v-model="activeTab" @tab-click="handleTabClick">
        <el-tab-pane v-for="item in workTypeEnum" :label="item.showValue" :name="item.id"></el-tab-pane>
      </el-tabs>
      <el-form :inline="true" :model="form">
        <el-form-item style="width: 30%" label="任务状态">
          <el-select v-model="form.status" placeholder="任务状态">
            <el-option v-for="item in taskStatus" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item style="width: 30%" label="优先级">
          <el-select v-model="form.priority" placeholder="优先级">
            <el-option v-for="item in priorityEnum" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item style="width: 30%" label="任务类型">
          <el-select v-model="form.workType" placeholder="任务类型">
            <el-option v-for="item in taskTypeEnum" :label="item.value" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <br />
        <el-form-item style="width: 30%" label="对接人">
          <el-tag v-for="tag in form.requester" :key="tag" :disable-transitions="false">
            {{ tag.name }}
          </el-tag>
          <el-button class="button-new-tag" size="default" @click="choosePerson('contacter')">
            + 对接人
          </el-button>
        </el-form-item>
        <el-form-item style="width: 30%" label="承接人">
          <el-tag v-for="tag in form.assignee" :key="tag" :disable-transitions="false">
            {{ tag.name }}
          </el-tag>
          <el-button class="button-new-tag" size="default" @click="choosePerson('worker')">
            + 承接人
          </el-button>
        </el-form-item>
        <el-form-item style="width: 15%" label="主题">
          <el-input v-model="form.topic" placeholder="主题"></el-input>
        </el-form-item>
        <el-form-item style="width: 15%" label="描述内容">
          <el-input v-model="form.description" placeholder="描述内容"></el-input>
        </el-form-item>
        <br />

        <el-row :gutter="20">
          <el-col :span="14">
            <el-form-item>
              <el-button color="#171719" type="primary" icon="search" @click="getCurrentPage">搜索</el-button>
              <el-button icon="refresh" @click="clear">清空</el-button>
            </el-form-item>
          </el-col>

          <el-col :span="10" style="text-align: right">
            <el-form-item>
              <!-- <el-button color="#171719" type="success" icon="plus" @click="newTask">新建任务</el-button> -->
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <el-table :data="currentPage" style="
          width: 100%;
          color: #000;
          border: 1px solid #eee;
          border-radius: 8px;
        ">
        <el-table-column prop="workContent" label="工作内容">
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
            <span class="clickable-topic" @click="handleTopicClick(scope.row)">{{ scope.row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="contacters" label="对接人">
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
        <el-table-column prop="statusName" label="任务状态"></el-table-column>
        <el-table-column fixed="right" prop="endDate" label="操作">
          <template #default="scope">
            <div class="flex">
              <el-button size="small" v-if="!scope.row.workers?.length && !scope.row.predictDuration" color="#171719"
                :disabled="!canExamineTask(scope.row) || scope.row.statusName == '已关闭'"
                @click="updateTaskFun(scope.row)">分配</el-button>
              <el-button size="small" v-if="scope.row.workers?.length && scope.row.predictDuration" color="#171719"
                disabled>已分配</el-button>

              <el-button size="small" @click="closeTask(scope.row)"
                :disabled="scope.row.statusName != '待处理' || (scope.row.workers?.length && scope.row.predictDuration)">
                关闭
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-pagination class="pagination" v-model:current-page="currentPageNum" @current-change="changeCurrentPage"
      v-model:page-size="pageSize" :page-sizes="pageSizeArr" @size-change="handleSizeChange"
      layout="total, sizes, prev, pager, next, jumper" :total="allLength" />
    <el-dialog v-model="dialogFormVisible" :title="actionType == 'new' ? '添加新任务' : '修改任务'" width="800">
      <AddTask v-if="dialogFormVisible" @finish="getCurrentPage" @close="dialogFormVisible = false"
        :actionType="actionType" :taskData="taskData" :examine="true"/>
    </el-dialog>
    <el-dialog v-model="dialogDeleteVisible" title="" width="500">
      <span>确定删除该任务吗？</span>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogDeleteVisible = false">取消</el-button>
          <el-button type="primary" @click="
              dialogDeleteVisible = false;
              deleteCateFun();
            ">
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
    <TaskDetailModal @refresh="getCurrentPage" @closeModal="taskDetailModal.isVisible = false"
      v-if="taskDetailModal.isVisible" :taskDetail="taskDetailModal.taskDetail" :taskStatus="taskStatus">
    </TaskDetailModal>
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
.el-tabs__nav-prev {
  width: 40px;
  transform: scale(2) translate(-7px, 2px);
}

.el-tabs__nav-next {
  width: 40px;
  transform: scale(2) translate(7px, 2px);
}
</style>
