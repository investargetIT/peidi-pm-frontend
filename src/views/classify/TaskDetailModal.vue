<template>
  <el-dialog v-model="jjj" class="relative" :before-close="close" title="任务详情" width="1000px">
    <div v-loading="loading" element-loading-text="上传中。。。">
      <el-select v-if="taskData.statusId" @change="updateTaskInfo" class="!absolute right-6 top-14 !w-[150px]"
        v-model="taskData.statusId" :disabled="!isSuperAdminUser && !canUpdateTaskStatus(taskData)" placeholder="任务状态">
        <el-option v-for="item in taskStatus" :disabled="!isSuperAdminUser && canChangeStatus(item)" :label="item.value"
          :value="item.id"></el-option>
      </el-select>
      <div class="task-detail-header">
        <Level :level="taskData.priorityName" />
        <span style="font-size: 20px; font-weight: 600">{{
          taskData.title
        }}</span>
      </div>
      <div class="task-detail-header">
        <span class="task-created-updated">
          创建于 {{ dayjs(taskData.createdAt).format("YYYY/MM/DD") }} 最近更新于
          {{ dayjs(taskData.updateAt).format("YYYY/MM/DD") }}
        </span>
      </div>
      <el-form v-if="taskData.contacters" :model="taskForm">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="需求发起人">
              <span>{{taskData.contacters.map(item => item.userName).join('、')}}</span>
            </el-form-item></el-col>

          <el-col :span="12">
            <el-form-item label="承接人">
              <el-button v-if="canExamineTask(taskData) || isSuperAdminUser"
                @click="choosePerson('workers')">选择承接人</el-button>
              <div v-if="taskData.workers.length" class="helpers">
                <p v-for="(item, index) in taskData.workers" class="help-item">
                  {{ item.name || item.userName }}
                  <el-icon @click="deleteHoster(index)">
                    <Close />
                  </el-icon>
                </p>
              </div>
              <span v-if="taskData.workers?.length === 0">无</span>
            </el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务类型">
              <span>{{ taskData.taskTypeName.split('&')[0] }}</span>
            </el-form-item></el-col>

          <el-col :span="12">
            <el-form-item label="工作类型">
              <span>{{ extractInfo(taskData.workTypeName).name }}</span>
            </el-form-item></el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="预估工时">
              <el-input class=" !w-12 !text-center" @blur="updatePredictDuration"
                v-if="taskData.predictDuration !== null" type="number" v-model="taskData.predictDuration"
                :disabled="!canExamineTask(taskData) && !isSuperAdminUser"></el-input>
              <span v-if="taskData.predictDuration === null">无</span>
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item label="交付时间">
              <el-date-picker @change="updateEndTime" v-if="taskData.endTime !== null" class="!w-[200px] !text-center"
                :disabled-date="disabledDate"
                :disabled="!canExamineTask(taskData) && !updateExpectData(taskData) && !isSuperAdminUser"
                format="YYYY/MM/DD" value-format="YYYY-MM-DD" v-model="taskData.endTime" type="date"
                placeholder="选择交付时间" />
              <span v-if="taskData.endTime === null">无</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="taskData.difficulty">
          <el-col :span="12">
            <el-form-item label="任务等级">
              <span>{{ taskData.difficulty }}</span>
            </el-form-item>
          </el-col>
        </el-row>


        <el-row>
          <el-col :span="24">
            <el-form-item label="任务描述">
              <el-input type="textarea" v-model="taskData.description"
                :disabled="!canExamineTask(taskData) && !isSuperAdminUser" autosize />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <el-tabs v-if="taskData.contacters" v-model="activeTab">
        <el-tab-pane label="工作记录" name="workRecord">
          <p class="title">工作记录</p>
          <el-table height="250" :data="workRecords" style="width: 100%">
            <el-table-column prop="content" label="工作内容"></el-table-column>
            <el-table-column prop="timeRange" label="工作时间范围"></el-table-column>
            <el-table-column prop="workerName" label="承接人"></el-table-column>
            <el-table-column prop="createdAt" label="记录时间"></el-table-column>
            <el-table-column width="180px" label="操作" class="flex">
              <template class="flex" #default="scope">
                <div class="flex">
                  <el-button @click="editRecordDetail(scope.row)"
                    :disabled="!isSuperAdminUser && !canUpdateTaskRecord(taskData)" size="small"
                    type="default">修改</el-button>
                  <el-button @click="openRecordDetail(scope.row)"
                    :disabled="!isSuperAdminUser && !canUpdateTaskRecord(taskData)" size="small"
                    type="default">详细</el-button>
                  <el-button @click="deleteTaskFun(scope.row)"
                    :disabled="!isSuperAdminUser && !canUpdateTaskRecord(taskData)" size="small"
                    type="default">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="task-record-button">
            <el-button @click="
              showWorkRecord = true;
            openType = 'new';
            " :disabled="!isSuperAdminUser && !canAddTaskRecord(taskData)" type="default">新增工作记录</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="文件附件" name="fileAttachment">
          <p class="title">文件附件</p>
          <!-- <el-upload
          v-model:file-list="taskData.attachments"
          class="upload-demo123"
          :action="postUrl"
          :data="{
            path: default_upload_url,
            create_parents: false
          }"
          :accept="'*'"
          :before-upload="beforeUpload"
          :on-success="uploadSuccess"
          :on-preview="
            val => {
              chaohuiDownload(val?.row?.name || val.name);
            }
          "
          :auto-upload="true"
          list-type="text"
        >
          <el-button type="primary">选择文件</el-button>
        </el-upload> -->
          <el-upload :before-remove="handleRemove" ref="uploadRef"
            :disabled="!isSuperAdminUser && taskData.statusName == '已完成'" v-model:file-list="taskData.attachments"
            class="upload-demo123 upload-demo w-full" :class="{
              'not-show-delete': taskData.statusName == '已完成'
            }" :action="postUrl" :on-error="handleError" :data="{
              path: default_upload_url,
              create_parents: false
            }" :with-credentials="false" :accept="'*'" :on-change="handleChange" :on-remove="removeFule"
            :before-upload="beforeUpload" :on-success="uploadSuccess" :auto-upload="false" :on-preview="val => {
              chaohuiDownload(val.realFileName || val?.row?.name || val.name);
            }
              " list-type="text">
            <el-button :disabled="!isSuperAdminUser && taskData.statusName == '已完成'">选择文件</el-button>
          </el-upload>
        </el-tab-pane>
        <el-tab-pane label="关联链接" name="relatedLink">
          <div class="flex justify-between align-middle">
            <p class="title">关联链接</p>
            <el-button @click="newLinkModal = true" type="primary">新增链接</el-button>
          </div>

          <el-tag class="mr-4" type="primary" @click="() => {
            console.log('dddddd');
          }
          " v-for="item in taskData.links">{{ item }}</el-tag>
          <p class="text-center m-8" v-if="!taskData.links.length">
            暂无关联链接
          </p>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-dialog>
  <el-dialog v-model="showWorkRecord" width="500px" :title="openType == 'new' ? '新增工作记录' : '编辑工作记录'">
    <el-form :rules="taskRules" ref="formRef" :model="workRecordData" label-width="auto" style="max-width: 600px">
      <el-form-item label="时间范围" prop="timeRange">
        <div class="block">
          <el-date-picker v-model="workRecordData.timeRange" type="datetimerange" start-placeholder="开始时间"
            end-placeholder="结束时间" format="YYYY-MM-DD HH:mm:ss" date-format="YYYY/MM/DD" :default-time="Date.now()"
            time-format="hh:mm:ss" />
        </div>
      </el-form-item>
      <el-form-item label="工作内容" prop="workText">
        <el-input v-model="workRecordData.workText" />
      </el-form-item>
      <el-form-item label="补充描述" prop="suppleDescription">
        <el-input type="textarea" v-model="workRecordData.suppleDescription" />
      </el-form-item>
      <el-button @click="addWorkRecord" style="margin-left: 230px" color="#171719">
        确定提交
      </el-button>
    </el-form>
  </el-dialog>
  <el-dialog class="top-[20vh] !rounded-[8px]" v-model="showRecordDetail" width="500px" title="工作记录详情">
    <div class="m-2 pl-6 pr-2">
      <p class="text-base mb-4">
        <span>执行员工:</span>
        <span class="font-bold ml-4">{{ lineRecord.workerName }}</span>
      </p>
      <p class="text-base mb-4">
        <span>工作类型:</span>
        <span class="font-bold ml-4">{{
          extractInfo(taskData.workTypeName).name
        }}</span>
      </p>
      <p class="text-base mb-4">
        <span>时间范围:</span>
        <span class="font-bold ml-4">{{ lineRecord.timeRange }}</span>
      </p>
      <p class="text-base mb-4">
        <span>工作内容:</span>
        <span class="font-bold ml-4">{{ lineRecord.content }}</span>
      </p>
    </div>
  </el-dialog>
  <el-dialog class="!top-[20vh] flex justify-center" v-model="newLinkModal">
    <el-input class="!w-[500px] m-6" v-model="newLink"></el-input>
    <el-button type="primary" @click="updateTaskInfo('newlink')">新增</el-button>
  </el-dialog>
</template>

<script setup>
import { defineProps, ref } from "vue";
import {
  ElDialog,
  ElCard,
  ElRow,
  ElCol,
  ElFormItem,
  ElTable,
  ElTableColumn,
  ElButton,
  dayjs,
  ElMessageBox
} from "element-plus";
import Level from "../../components/Common/level.vue";
import { privortyMap } from "../common/common";
import {
  getTaskRecord,
  newTaskRecord,
  deleteTaskRecord,
  updateTaskRecord,
  getOneTask,
  updateTask
} from "../../api/pmApi";
import { message } from "@/utils/message";
import { extractInfo, extractEmplId } from "./utils";
import * as dd from "dingtalk-jsapi";

import {
  testAllIPs,
  default_upload_url,
  chaohuiDownload
} from "../../utils/chaohuiapi";
import {
  canUpdateTaskStatus,
  canAddTaskRecord,
  canUpdateTaskRecord,
  isSuperAdmin,
  canExamineTask,
  updateExpectData
} from "../../utils/permission";
const postUrl = ref("");
const uploadRef = ref(null)
const handleRemove = (uploadFile, uploadFiles) => {
  return ElMessageBox.confirm(
    `确认删除该文件吗?`
  ).then(
    () => true,
    () => false
  )
}
const disabledDate = (time) => {
  if (taskData.value.expectEndDate) {
    return time.getTime() > new Date(taskData.value.expectEndDate).getTime();
  }
  return false;
}
const deleteHoster = index => {
  // 如果有审核权限或者是超级管理员，那么可以删除
  if (canExamineTask(taskData.value) || isSuperAdminUser.value) {
    taskData.value.workers.splice(index, 1);
    // 删除后如果长度>0，那么更新
    if (taskData.value.workers.length > 0) {
      updateTaskInfo();
    } else {
      // 提醒一下承接人不能为空
      message('承接人不能为空', { type: 'error' });
    }
  }
};
const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const updatePredictDuration = () => {
  if (!taskData.value.predictDuration || taskData.value.predictDuration <= 0) {
    message('预估工时不能为空或小于等于0', {
      type: 'warning',
    });
    return;
  }
  updateTaskInfo();
};
const updateEndTime = () => {
  updateTaskInfo();
};
const choosePerson = type => {
  let data_this =
    type == "contacter" ? taskData.value.creator
      : taskData.value.workers;
  // let test = [{ "avatar": "", "name": "台江鹏", "emplId": "474805081221550528" }];
  // if (type == 'contacter') {
  //   form.value.requester = (test)
  // }
  // if (type == 'worker') {
  //   form.value.assignee = (test)
  // }
  // return
  console.log("data_this", data_this);
  dd.biz.contact.choose({
    multiple: true, //是否多选：true多选 false单选； 默认true
    users: extractEmplId(data_this), //默认选中的用户列表，员工userid；成功回调中应包含该信息
    corpId: DINGTALK_CORP_ID, //企业id
    max: 10, //人数限制，当multiple为true才生效，可选范围1-1500
    onSuccess: function (data) {
      console.log("data", data, type);
      if (type == "contacter") {
        form.value.requester = data;
      }
      if (type == "workers") {
        console.log('hhhhhh');
        taskData.value.workers = JSON.parse(JSON.stringify(data));
        // 更新任务信息
        updateTaskInfo();
      }
      // alert("dd successs: " + JSON.stringify(data));
    },
    onFail: function (err) { }
  });
};
const isSuperAdminUser = ref(false);
isSuperAdmin()
  .then(res => {
    isSuperAdminUser.value = res;
  })
const handleChange = (file) => {
  console.log('hhhhhh', JSON.stringify(file));
  if (file.response) {
    return
  }
  const { name, type, size, lastModified } = file;
  const dotIndex = file.name.lastIndexOf('.');
  const fileNameWithoutExtension = file.name.slice(0, dotIndex);
  const fileExtension = file.name.slice(dotIndex);
  let fileName = `${fileNameWithoutExtension}_${Date.now()}${fileExtension}` // 如果可以上传多个文件，这里需要用fileList.forEach()处理
  let f = new File([file.raw], fileName, {
    type: type,
    lastModified: lastModified
  });
  f.uid = file.uid; // new File 没有uid属性，会导致组件底层报错，这里手动加上
  file.raw = f;  // 用f替换file的数据
  uploadRef.value.submit();
  loading.value = true;
  console.log(file.raw)
}

const canChangeStatus = (item) => {
  if (item.id < taskData.value.statusId) {
    // 通常状态不能回退
    // 退回修改-> 已关闭
    const canReturnRevisionEdit = taskData.value.statusId === 90 && item.value === '已关闭';
    // 待审核-> 已完成/已关闭
    const canPendingReviewEdit = taskData.value.statusId === 91 && (['已完成', '已关闭'].includes(item.value));
    if (canReturnRevisionEdit || canPendingReviewEdit) return false;
    return true;
  }
  if (item.id > taskData.value.statusId && [90, 22].includes(taskData.value.statusId)) {
    // 退回修改时，不能选择待审核
    // 已完成时，均不能修改
    return true;
  }
  if (item.value == '已关闭') {
    return true;
  }
  // 如果是待处理，那么可以修改为任何状态
  if (item.value == '待处理') {
    return false;
  }
}
testAllIPs().then(res => {
  if (res.sid) {
    postUrl.value = res.postUrl;
  }
});

const handleError = () => {
  message("上传失败", { type: "error" });
  loading.value = false;
}
const jjj = ref(true);
const formRef = ref(null);
const showWorkRecord = ref(false);
const newLink = ref("");
const openType = ref("new");
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}
const showRecordDetail = ref(false);
const lineRecord = ref({});
const newLinkModal = ref(false);
let isUpdateingData = {};

const loading = ref(false);
const beforeUpload = () => {
  loading.value = true;
  return true;
};

const removeFule = () => {
  setTimeout(() => {
    console.log('remove', taskData.value.attachments.length);
    updateTaskInfo();
  }, 300);
}

const uploadSuccess = res => {
  loading.value = false;
  taskData.value.attachments.map(item => {
    item.realFileName = item.raw.name;
  })
  updateTaskInfo();
};

const getFileName = arr => {
  let names = [];
  arr.map(item => {
    if (item.response.success) {
      names.push(item.raw.name);
    }
    if (!item.response.success && item.response?.error?.code == 414) {
      names.push(item.raw.name);
    }
  });
  return names;
};

const { taskDetail } = defineProps({
  isVisible: {
    type: Boolean,
    required: true
  },
  taskDetail: {
    type: Object,
    required: true
  },
  taskStatus: {
    type: String
  }
});

const taskData = ref({});
const taskDataBackup = ref({});
const workRecords = ref([]);
const activeTab = ref("workRecord");
const emit = defineEmits(["closeModal", "refresh"]);

const getTaskRecordFun = () => {
  getTaskRecord({
    taskId: taskDetail.id
  }).then(res => {
    console.log("res", res);
    const { code, data } = res;
    if (code == 200) {
      workRecords.value = data;
      workRecords.value.map(item => {
        item.timeRange = item.startTime + "至" + item.endTime;
      });
    }
  });
};

const getOneTaskFun = () => {
  getOneTask({
    id: taskDetail.id
  }).then(res => {
    const { code, data } = res;
    if (code == 200) {
      let newArr = [];
      if (data.attachments) {
        data.attachments.map(item => {
          if (!item.response) {
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
          } else {
            newArr.push({
              ...item
            })
          }
        });
      }
      data.attachments = JSON.parse(JSON.stringify(newArr));
      taskData.value = data;
      taskDataBackup.value = JSON.parse(JSON.stringify(data));
    }
  });
};

const handleModify = row => {
  console.log("修改工作记录：", row);
};
const handleDetail = row => {
  console.log("查看工作记录详细：", row);
};
const handleDelete = row => {
  console.log("删除工作记录：", row);
};
// 定义数据
const dialogVisible = ref(false);
const priority = ref("低");
const taskName = ref("某科技公司任务");
const taskId = ref("T1485");
const createdAt = ref("2024-12-11");
const updatedAt = ref("23小时前");
const taskForm = ref({
  requester: "冶东",
  assignee: "欧阳产品",
  taskType: "需求",
  estimatedHours: 10
});

const updateTaskInfo = val => {
  if (val == "newlink") {
    taskData.value.links.push(newLink.value);
  }
  

  // 检查 workerIds 是否有变化
  const currentWorkerIds = taskData.value?.workers?.map(item => item?.emplId || item?.userId)?.sort()?.join(',');
  const backupWorkerIds = taskDataBackup.value?.workers?.map(item => item?.emplId || item?.userId)?.sort()?.join(',');
  const isWorkerIdsChanged = currentWorkerIds !== backupWorkerIds;
 

  const sendConfig = {
    ...taskData.value,
    attachments: getFileName(taskData.value.attachments),
    workerIds: taskData.value.workers.map(item => {
      return {
        userName: item.name || item.userName,
        userId: item.emplId || item.userId
      };
    }),
    updateUser: { userName: ddUserInfo.name, userId: ddUserInfo.userid },
  };
  // 当承接人发生变动时，传递isExamine=true
  if(isWorkerIdsChanged){
    sendConfig.isExamine = true;
  }


  updateTask(sendConfig).then(res => {
    const { code } = res;
    if (code == 200) {
      message("修改任务信息成功", { type: "success" });
      newLinkModal.value = false;
      newLink.value = "";
      // 更新成功后更新备份数据
      taskDataBackup.value = JSON.parse(JSON.stringify(taskData.value));
      emit("refresh");
    } else {
      if (val == "newlink") {
        taskData.value.links.pop();
      }
    }
  });
};

const editRecordDetail = val => {
  openType.value = "edit";
  isUpdateingData = val;
  showWorkRecord.value = true;
  workRecordData.value.timeRange = [val.startTime, val.endTime];
  workRecordData.value.workText = val.content;
  workRecordData.value.suppleDescription = val.descriptionExt;
};
const openRecordDetail = val => {
  console.log("val", val);
  showRecordDetail.value = true;
  lineRecord.value = val;
};
const deleteTaskFun = val => {
  console.log("val", val);
  deleteTaskRecord({
    id: val.id
  }).then(res => {
    const { code } = res;
    if (code == 200) {
      message("删除任务记录成功", { type: "success" });
      getTaskRecordFun();
    }
  });
};
const workRecordData = ref({
  timeRange: "",
  workText: "",
  suppleDescription: ""
});

const taskRules = {
  timeRange: [{ required: true, message: "选择时间范围", trigger: "blur" }],
  workText: [{ required: true, message: "输入工作内容", trigger: "blur" }],
  suppleDescription: [
    { required: false, message: "输入任务类型", trigger: "blur" }
  ]
};
const close = () => {
  emit("closeModal");
};
const updateWorkRecordFun = () => {
  updateTaskRecord({
    content: workRecordData.value.workText,
    descriptionExt: workRecordData.value.suppleDescription,
    endTime: workRecordData.value.timeRange[1],
    startTime: workRecordData.value.timeRange[0],
    taskId: isUpdateingData.taskId,
    id: isUpdateingData.id,
    worker: {
      userName: isUpdateingData.workerName,
      userId: isUpdateingData.workerId
    }
  }).then(res => {
    const { code, data } = res;
    if (code == 200) {
      message("修改任务记录成功", { type: "success" });
      showWorkRecord.value = false;
      workRecordData.value.suppleDescription = "";
      workRecordData.value.timeRange = "";
      workRecordData.value.workText = "";
      getTaskRecordFun();
      emit("refresh");
    }
  });
};
const addWorkRecord = async () => {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate((valid, fields) => {
    if (valid) {
      if (openType.value == "edit") {
        updateWorkRecordFun();
        return;
      }
      console.log(
        "workRecordData",
        workRecordData.value.timeRange,
        workRecordData.value.timeRange[0],
        workRecordData.value.timeRange[1]
      );
      newTaskRecord({
        content: workRecordData.value.workText,
        descriptionExt: workRecordData.value.suppleDescription,
        endTime: workRecordData.value.timeRange[1],
        startTime: workRecordData.value.timeRange[0],
        taskId: taskDetail.id,
        worker: { userName: ddUserInfo.name, userId: ddUserInfo.userid }
      }).then(res => {
        const { code, data } = res;
        if (code == 200) {
          message("添加任务记录成功", { type: "success" });
          showWorkRecord.value = false;
          workRecordData.value.suppleDescription = "";
          workRecordData.value.timeRange = "";
          workRecordData.value.workText = "";
          getTaskRecordFun();
        }
      });
    }
  });
};

getOneTaskFun();
getTaskRecordFun();
</script>
<style scoped>
.helpers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 4px;
  transform: translateY(-2px);
}

.help-item {
  display: flex;
  align-items: center;
  padding: 0 4px;
  cursor: pointer;
  border: 1px solid #aaa;
  border-radius: 8px;
}
</style>
<style>
.task-detail-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.task-id {
  margin-left: 10px;
}

.task-created-updated {
  margin-left: 10px;
}

.task-record-section {
  margin-top: 10px;
}

.task-record-button {
  margin-top: 10px;
  text-align: right;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.upload-demo123 {
  .el-upload {
    transform: translate(880px, -26px);
  }
}
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
</style>
<style>
.not-show-delete {
  .el-icon--close {
    display: none !important;
  }

  .el-icon--close-tip {
    display: none !important;
  }
}
</style>
