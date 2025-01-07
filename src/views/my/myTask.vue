<script setup lang="ts">
import { ref, watch } from "vue";
import * as dd from "dingtalk-jsapi";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";
import {
  omsGetShops,
  newTask,
  getEnum,
  getPriorty,
  updateTask
} from "../../api/pmApi";
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
import {
  removeDuplicates,
  extractEmplId,
  extractInfo
} from "../classify/utils";
import { jsonp } from "vue-jsonp";
import {
  testAllIPs,
  default_upload_url,
  chaohuiDownload
} from "../../utils/chaohuiapi";
import Axios from "axios";
import { message } from "@/utils/message";
import { debug } from "console";

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
defineOptions({
  name: "myTask"
});
const emit = defineEmits(["close", "finish"]);
const { actionType, taskData } = defineProps(["actionType", "taskData"]);
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}
const isNew = actionType == "new";
const isEdit = actionType == "edit";
console.log("taskData", taskData);

const taskUnitMap: any = ref([]);

omsGetShops({}).then(res => {
  const { data } = res;
  if (data?.length) {
    data.map(item => {
      if (item.shopName) {
        taskUnitMap.value.push({
          id: item.id,
          value: item.shopName
        });
      }
    });
    taskUnitMap.value = removeDuplicates(taskUnitMap.value);
    console.log("taskUnitMap", taskUnitMap, JSON.stringify(taskUnitMap.value));
  }
});

const taskTypeMap = ref([]);

getEnum({
  type: "taskType"
}).then(res => {
  const { code, data } = res;
  if (code == 200) {
    taskTypeMap.value = data;
  }
});

const workTypeMap = ref([]);

getEnum({
  type: "workType"
}).then(res => {
  const { code, data } = res;
  if (code == 200) {
    workTypeMap.value = data;
    workTypeMap.value.map(item => {
      item.showValue = extractInfo(item.value).name || "";
      item.workerMasterId = extractInfo(item.value).workerMasterId || "";
    });
  }
});

const priMap = ref([]);

getEnum({
  type: "priority"
}).then(res => {
  const { code, data } = res;
  if (code == 200) {
    priMap.value = data;
    getCanHigh();
  }
});

const choosePerson = type => {
  try {
    const data_this =
      type == "workers"
        ? newTaskData.value.workers
        : newTaskData.value.contacters;

    dd.biz.contact.choose({
      multiple: true, //是否多选：true多选 false单选； 默认true
      users: extractEmplId(data_this), //默认选中的用户列表，员工userid；成功回调中应包含该信息
      corpId: DINGTALK_CORP_ID, //企业id
      max: 10, //人数限制，当multiple为true才生效，可选范围1-1500
      onSuccess: function (data) {
        console.log("data", data);
        /* data结构
          [{
            "name": "张三", //姓名
            "avatar": "
    http://g.alicdn.com/avatar/zhangsan.png
    " //头像图片url，可能为空
            "emplId": '0573', //员工userid
           }
          ]
        */
        if (type == "workers") {
          newTaskData.value.workers = data;
          console.log("data", data);
        }
        if (type == "contacters") {
          newTaskData.value.contacters = data;
        }
        // alert("dd successs: " + JSON.stringify(data));
      },
      onFail: function (err) {}
    });
  } catch (error) {
    alert("dd error1: " + error);
  }
};
const newTaskDataDefault = {
  // 任务名称
  taskName: "",
  // 状态
  statusId: "",
  // 完成进度
  taskProgress: 0,
  // 类型
  taskTypeId: "",
  // 工作类型
  workTypeId: "",
  // 紧急程度
  taskUrgency: "",
  // 优先级
  priorityId: 16,
  // 任务主题
  taskTheme: "",
  // 任务描述
  description: "",
  // 关联项目
  relationTask: "",
  // 负责人
  contacters: [],
  // 业务单元id
  businessUnitId: "",
  // 协作人
  workers: [],
  // 预估工时
  predictDuration: 0,
  // 预计结束日期
  expectEndDate: "",
  // 交付时间
  endTime: "",
  // 附件上传
  attachments: [],
  links: []
};
const newTaskData = ref(JSON.parse(JSON.stringify(newTaskDataDefault)));
if (isEdit) {
  let newArr: any = [];
  if (taskData?.attachments) {
    taskData.attachments.map(item => {
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
  taskData.attachments = JSON.parse(JSON.stringify(newArr));

  newTaskData.value = {
    ...newTaskData.value,
    ...taskData
  };
  newTaskData.value.attachments = newTaskData.value.attachments
    ? newTaskData.value.attachments
    : [];
  newTaskData.value.contacters.map(item => {
    item.name = item.userName;
    item.emplId = item.userId;
  });
  newTaskData.value.workers.map(item => {
    item.name = item.userName;
    item.emplId = item.userId;
  });
  newTaskData.value.taskTheme = taskData.title;
}
const resetData = () => {
  newTaskData.value = JSON.parse(JSON.stringify(newTaskDataDefault));
  downloadFileName.value = [];
};
const delteHelper = index => {
  if (isEdit) {
    return;
  }
  newTaskData.value.workers.splice(index, 1);
};

const deleteHoster = index => {
  newTaskData.value.contacters.splice(index, 1);
};

const isInputUrl = ref("");
const addUploadUrls = () => {
  newTaskData.value.links.push(isInputUrl.value);
  isInputUrl.value = "";
};

const deleteUrl = index => {
  newTaskData.value.links.splice(index, 1);
};

const uploadUrl = ref("");
const taskRules = {
  taskTheme: [{ required: isEdit, message: "输入任务主题", trigger: "blur" }],
  businessUnitId: [
    { required: isEdit, message: "输入业务单元", trigger: "blur" }
  ],
  taskTypeId: [{ required: isEdit, message: "输入任务类型", trigger: "blur" }],
  workTypeId: [{ required: isEdit, message: "输入工作类型", trigger: "blur" }],
  priorityId: [
    { required: isEdit, message: "输入任务优先级", trigger: "blur" }
  ],
  expectEndDate: [
    { required: isEdit, message: "选择期望完成时间", trigger: "blur" }
  ],
  predictDuration: [
    { required: !isEdit, message: "输入预估工时", trigger: "blur" }
  ],
  endTime: [{ required: !isEdit, message: "输入交付时间", trigger: "blur" }],
  contacters: [{ required: isEdit, message: "选择需求发起人", trigger: "blur" }],
  workers: [{ required: !isEdit, message: "选择承接人", trigger: "blur" }],
  description: [{ required: isEdit, message: "输入任务描述", trigger: "blur" }],
  attachments: [{ required: false, message: "附件上传", trigger: "change" }],
  links: [{ required: false, message: "链接上传", trigger: "change" }]
};
const formRef = ref(null);
const updateTaskFun = async () => {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate((valid, fields) => {
    if (valid) {
      updateTask({
        id: Number(newTaskData.value.id),
        attachments: getFileName(newTaskData.value.attachments),
        businessUnitId: newTaskData.value.businessUnitId,
        contacters: newTaskData.value.contacters.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        }),
        creator: newTaskData.value.creator,
        description: newTaskData.value.description,
        endTime: dayjs(newTaskData.value.endTime).format("YYYY-MM-DD"),
        expectEndDate: dayjs(newTaskData.value.expectEndDate).format(
          "YYYY-MM-DD"
        ),
        links: newTaskData.value.links,
        predictDuration: newTaskData.value.predictDuration,
        priorityId: newTaskData.value.priorityId,
        // "statusId": newTaskData.value.statusId,
        taskTypeId: newTaskData.value.taskTypeId,
        title: newTaskData.value.taskTheme,
        workTypeId: newTaskData.value.workTypeId,
        workerIds: newTaskData.value.workers.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        })
      }).then(res => {
        const { code, data } = res;
        if (code == 200) {
          message("修改任务成功", { type: "success" });
          emit("finish");
          emit("close");
        }
      });
    }
  });
};
const addNewTask = async () => {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate((valid, fields) => {
    if (valid) {
      newTask({
        attachments: getFileName(newTaskData.value.attachments),
        businessUnitId: newTaskData.value.businessUnitId,
        contacters: newTaskData.value.contacters.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        }),
        creator: { userName: ddUserInfo.name, userId: ddUserInfo.userid },
        description: newTaskData.value.description,
        // "endTime": newTaskData.value.endTime,
        expectEndDate: dayjs(newTaskData.value.expectEndDate).format(
          "YYYY-MM-DD"
        ),
        links: newTaskData.value.links,
        // "predictDuration": newTaskData.value.predictDuration,
        priorityId: newTaskData.value.priorityId,
        // "statusId": newTaskData.value.statusId,
        taskTypeId: newTaskData.value.taskTypeId,
        title: newTaskData.value.taskTheme,
        workTypeId: newTaskData.value.workTypeId
        // "workers": newTaskData.value.workers
      }).then(res => {
        const { code, data } = res;
        if (code == 200) {
          message("新建任务成功", { type: "success" });
          newTaskData.value = newTaskDataDefault;
          emit("finish");
          emit("close");
        }
      });
    }
  });
};

const ips = ["192.168.1.252", "12.18.1.16", "192.168.110.252"];
const ipsName = [
  {
    url: "192.168.1.252",
    name: "A区"
  },
  {
    url: "12.18.1.16",
    name: "B区"
  },
  {
    url: "192.168.110.252",
    name: "CD区"
  }
];
const port = 5000;
const USERNAME = "夏琰";
const PASSWORD = "X81y0122";
const testResults: any = ref([]);

const ipThis = ref("");

const sid = ref("");
const postUrl = ref("");

// 获取优先级
const canSetHighPrior = ref(false);
const getCanHigh = () => {
  getPriorty({
    userId: ddUserInfo.userid
  }).then(res => {
    const { data } = res;
    canSetHighPrior.value = !data;
    console.log("priMap", priMap.value);
    if (!canSetHighPrior.value && isNew) {
      priMap.value.splice(
        priMap.value.findIndex(item => item.value == "高"),
        1
      );
    }
  });
};
const downloadFileName = ref([]);
const workTypeChange = () => {
  const workValue = workTypeMap.value.find(
    item => item.id == newTaskData.value.workTypeId
  ).value;
  console.log("workValue", workValue);
  if (workValue) {
    let download = extractInfo(workValue).filename;
    downloadFileName.value = download;
  } else {
    downloadFileName.value = [];
  }
};

testAllIPs().then(res => {
  if (res.sid) {
    sid.value = res.sid;
    postUrl.value = res.postUrl;
  }
});

const uploadSuccess = res => {
  loading.value = false;
  console.log("uploadSuccess", res, newTaskData.value.attachments);
  console.log("getFileName", getFileName(newTaskData.value.attachments));

  const { success, error } = res;
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

const loading = ref(false);
const beforeUpload = () => {
  loading.value = true;
  return true;
};
</script>

<template>
  <div class="container1">
    <el-form
      label-position="top"
      label-width="auto"
      v-loading="loading"
      element-loading-text="上传中。。。"
      ref="formRef"
      :rules="taskRules"
      :model="newTaskData"
    >
      <p style="margin-bottom: 10px; font-size: 28px; font-weight: 800">
        {{ isNew ? "新建" : "修改" }}任务
      </p>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务主题" prop="taskTheme">
            <el-input v-model="newTaskData.taskTheme" autocomplete="off" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="业务单元" prop="businessUnitId">
            <el-select
              v-model="newTaskData.businessUnitId"
              placeholder="请选择业务单元"
            >
              <el-option
                v-for="item in taskUnitMap"
                :label="item.value"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务类型" prop="taskTypeId">
            <el-select
              v-model="newTaskData.taskTypeId"
              placeholder="选择任务类型"
            >
              <el-option
                v-for="item in taskTypeMap"
                :label="item.value"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item class="flex" label="工作类型" prop="workTypeId">
            <el-select
              class="flex-1"
              v-model="newTaskData.workTypeId"
              @change="workTypeChange"
              placeholder="选择工作类型"
            >
              <el-option
                v-for="item in workTypeMap"
                :label="item.showValue"
                :value="item.id"
              />
            </el-select>
            <div
              v-if="downloadFileName.length"
              class="flex w-[400px] mt-1 ml-1"
            >
              <el-button
                v-for="item in downloadFileName"
                @click="chaohuiDownload(item)"
                type="primary"
                class="w-[200px] underline overflow-hidden whitespace-nowrap text-ellipsis"
              >
                ({{ item }})
              </el-button>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item
            label="任务优先级(当天任务只有一个高优先级)"
            prop="priorityId"
          >
            <el-select
              v-model="newTaskData.priorityId"
              placeholder="选择任务优先级"
            >
              <el-option
                v-for="item in priMap"
                :label="item.value"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="期望结束日期" prop="expectEndDate">
            <el-date-picker
              class="!w-full"
              v-model="newTaskData.expectEndDate"
              type="date"
              placeholder="选择期望结束日期"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="预估工时" prop="predictDuration">
            <el-input
              :disabled="isEdit"
              v-model="newTaskData.predictDuration"
              autocomplete="off"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="交付时间" prop="endTime">
            <el-date-picker
              class="!w-full"
              :disabled="isEdit"
              v-model="newTaskData.endTime"
              type="date"
              placeholder="选择交付时间"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="需求发起人" prop="contacters">
        <!-- <el-input v-model="newTaskData.contacters" autocomplete="off" /> -->
        <el-button @click="choosePerson('contacters')">选择需求发起人</el-button>
        <div class="helpers">
          <p v-for="(item, index) in newTaskData.contacters" class="help-item">
            {{ item.name }}
            <el-icon @click="deleteHoster(index)">
              <Close />
            </el-icon>
          </p>
        </div>
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="20">
          <el-form-item label="承接人" prop="workers">
            <el-button :disabled="isEdit" @click="choosePerson('workers')"
              >选择承接人</el-button
            >
            <div class="helpers">
              <p v-for="(item, index) in newTaskData.workers" class="help-item">
                {{ item.name }}
                <el-icon @click="delteHelper(index)">
                  <Close />
                </el-icon>
              </p>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="任务描述" prop="description">
        <el-input
          :disabled="isEdit"
          type="textarea"
          v-model="newTaskData.description"
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item label="附件上传" prop="attachments">
        <el-upload
          v-model:file-list="newTaskData.attachments"
          class="upload-demo"
          :action="postUrl"
          :data="{
            path: default_upload_url,
            create_parents: false
          }"
          :accept="'*'"
          :before-upload="beforeUpload"
          :on-success="uploadSuccess"
          :auto-upload="true"
          list-type="text"
        >
          <el-button>选择文件</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="链接上传" prop="links">
        <el-input
          style="margin-bottom: 10px"
          v-model="isInputUrl"
          autocomplete="off"
        >
          <template #append>
            <el-button @click="addUploadUrls"> 添加 </el-button>
          </template>
        </el-input>
        <div class="flex gap-2">
          <el-tag
            @close="deleteUrl(index)"
            v-for="(tag, index) in newTaskData.links"
            :key="tag"
            closable
          >
            {{ tag }}
          </el-tag>
        </div>
      </el-form-item>
    </el-form>
    <!-- <template #footer> -->
    <div class="dialog-footer">
      <el-button type="primary" @click="isNew ? addNewTask() : updateTaskFun()">
        立即提交
      </el-button>
      <el-button type="default" :disabled="isEdit" @click="resetData">
        重置
      </el-button>
    </div>
    <!-- </template> -->
  </div>
</template>

<style lang="scss" scoped>
.container1 {
  padding: 20px;
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 10px;
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
