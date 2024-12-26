<script setup lang="ts">
import { ref, watch } from "vue";
import * as dd from "dingtalk-jsapi";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";
import {
  omsGetShops,
  newTask,
  getEnum,
  getPriorty,
  updateTask,
  getTaskTypeApi
} from "../../api/pmApi";
import { getDeptInfo } from "../../api/upload";
import { removeDuplicates, extractEmplId, extractInfo , splitTaskType } from "./utils";
import { jsonp } from "vue-jsonp";
import {
  testAllIPs,
  default_upload_url,
  chaohuiDownload
} from "../../utils/chaohuiapi";
import Axios from "axios";
import { message } from "@/utils/message";
const workContentMap = ref([])

getTaskTypeApi({})
.then(res => {
  const { code, data } = res;
  if (code == 200) {
    data.map(item => {
      if (item.level == 1) {
        workTypeMap.value.push(JSON.parse(JSON.stringify(item)))
      }
      if (item.level == 2) {
        workContentMap.value.push(JSON.parse(JSON.stringify(item)))
      }
    })
    console.log('workTypeMap.value', workTypeMap.value);
    console.log('workContentMap.value', workContentMap.value);
    if (isEdit || isMy) {
      newTaskData.value = {
        ...newTaskData.value,
        ...taskData
      };
      newTaskData.value.attachments = newTaskData.value.attachments
        ? newTaskData.value.attachments
        : [];
      let newArr:any = [];
      if (newTaskData.value.attachments) {
        newTaskData.value.attachments.map(item => {
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
          }else{
            newArr.push({
              ...item
            })
          }
        });
      }
      newTaskData.value.attachments = JSON.parse(JSON.stringify(newArr));
      console.log('newTaskData.value.attachments', newTaskData.value.attachments);
      
      newTaskData.value.contacters.map(item => {
        item.name = item.userName;
        item.emplId = item.userId;
      });
      newTaskData.value.taskTheme = taskData.title;
      // 判断当前workTypeId level1 or level2
      const isLevel1 = workTypeMap.value.find(item => item.id == newTaskData.value.workTypeId)
      const isLevel2 = workContentMap.value.find(item => item.id == newTaskData.value.workTypeId)
      console.log('isLevel1', isLevel1, 'isLevel2', isLevel2);
      
      if (isLevel1) {
        newTaskData.value.workTypeId = Number(newTaskData.value.workTypeId)
        workTypeChange(true);
      }
      if (isLevel2) {
        newTaskData.value.workContentId = Number(newTaskData.value.workTypeId);
        newTaskData.value.workTypeId = workTypeMap.value.find(item => item.level1 == isLevel2.level1).id
        workTypeChange(true);
      }
      console.log('newTaskData.value', newTaskData.value);
    }
  }
})



const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
defineOptions({
  name: "addTask"
});
const emit = defineEmits(["close", "finish"]);
const { actionType, taskData, examine } = defineProps(["actionType", "taskData", "examine"]);
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
  const { dept_id_list } = ddUserInfo;
  if (dept_id_list[0]) {
    getDeptInfo(dept_id_list[0])
      .then(res => {
        const { code , data } = res;
        if (code == 200) {
          const { name }  = data;
          newTaskData.value.businessUnit = name;
        }
      })
  }
}
const isNew = actionType == "new";
const isEdit = actionType == "edit"
const isMy = actionType == 'my';
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
    taskTypeMap.value.map( item => {
      item.priorityLevel1Id = splitTaskType(item.value).priority;
      item.value = splitTaskType(item.value).value;
    })
  }
});

const workTypeMap = ref([]);

// getEnum({
//   type: "workType"
// }).then(res => {
//   const { code, data } = res;
//   if (code == 200) {
//     workTypeMap.value = data;
//     workTypeMap.value.map(item => {
//       item.showValue = extractInfo(item.value).name || "";
//       item.workerMasterId = extractInfo(item.value).workerMasterId || "";
//     });
//   }
// });

const priMap = ref([]);

getEnum({
  type: "priority"
}).then(res => {
  const { code, data } = res;
  if (code == 200) {
    priMap.value = data;
    // getCanHigh();
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
      onFail: function (err) { }
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
  workTypeId: '',
  // 工作内容
  workContentId : '',
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
  businessUnit: "",
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

const resetData = () => {
  newTaskData.value = JSON.parse(JSON.stringify(newTaskDataDefault));
  downloadFileName.value = [];
};
const delteHelper = index => {
  if (isMy) {
    return
  }
  newTaskData.value.workers.splice(index, 1);
};

const deleteHoster = index => {
  if (isEdit) {
    return;
  }
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
  taskTheme: [{ required: isMy || isNew, message: "输入任务主题", trigger: "blur" }],
  businessUnit: [
    { required: isMy || isNew, message: "输入业务单元", trigger: "blur" }
  ],
  taskTypeId: [{ required: isMy || isNew, message: "输入任务类型", trigger: "blur" }],
  workTypeId: [{ required: isMy || isNew, message: "输入工作类型", trigger: "blur" }],
  priorityId: [{ required: isMy || isNew, message: "输入任务优先级", trigger: "blur" }],
  expectEndDate: [
    { required: isMy || isNew, message: "选择期望完成时间", trigger: "blur" }
  ],
  predictDuration: [
    { required: isEdit, message: "输入预估工时", trigger: "blur" }
  ],
  endTime: [{ required: isEdit, message: "输入交付时间", trigger: "blur" }],
  contacters: [{ required: isMy || isNew, message: "选择对接人", trigger: "blur" }],
  workers: [{ required: isEdit, message: "选择承接人", trigger: "blur" }],
  description: [{ required: isMy || isNew, message: "输入任务描述", trigger: "blur" }],
  attachments: [{ required: false, message: "附件上传", trigger: "change" }],
  links: [{ required: false, message: "链接上传", trigger: "change" }],
  workContentId: [
    { required: isEdit, message: "选择工作内容", trigger: "blur" }
  ]
};
const formRef = ref(null);
const updateTaskFun = async () => {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate((valid, fields) => {
    console.log('newTaskData.value.attachments', newTaskData.value.attachments);
    if (valid) {
      updateTask({
        id: Number(newTaskData.value.id),
        attachments: getFileName(newTaskData.value.attachments),
        businessUnit: newTaskData.value.businessUnit,
        contacters: newTaskData.value.contacters.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        }),
        creator: newTaskData.value.creator,
        description: newTaskData.value.description,
        endTime: newTaskData.value.endTime,
        expectEndDate: newTaskData.value.expectEndDate,
        links: newTaskData.value.links,
        predictDuration: newTaskData.value.predictDuration,
        priorityId: newTaskData.value.priorityId,
        // "statusId": newTaskData.value.statusId,
        taskTypeId: newTaskData.value.taskTypeId,
        title: newTaskData.value.taskTheme,
        workTypeId: newTaskData.value.workContentId || newTaskData.value.workTypeId,
        workerIds: newTaskData.value.workers.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        }),
        isExamine: examine
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
const changePri = () => {
  console.log('newTaskData.value.taskTypeId', taskTypeMap.value, newTaskData.value.taskTypeId);
  
  let item = taskTypeMap.value.find(item => item.id == newTaskData.value.taskTypeId)
  if (item.priorityLevel1Id) {
    newTaskData.value.priorityId = Number(item.priorityLevel1Id);
  }
}
const addNewTask = async () => {
  if (!formRef.value) {
    return;
  }
  await formRef.value.validate((valid, fields) => {
    if (valid) {
      newTask({
        attachments: (getFileName(newTaskData.value.attachments)),
        businessUnit: newTaskData.value.businessUnit,
        contacters: newTaskData.value.contacters.map(item => {
          return {
            userName: item.name,
            userId: item.emplId
          };
        }),
        creator: { userName: ddUserInfo.name, userId: ddUserInfo.userid },
        description: newTaskData.value.description,
        // "endTime": newTaskData.value.endTime,
        expectEndDate: newTaskData.value.expectEndDate,
        links: newTaskData.value.links,
        // "predictDuration": newTaskData.value.predictDuration,
        priorityId: newTaskData.value.priorityId,
        // "statusId": newTaskData.value.statusId,
        taskTypeId: newTaskData.value.taskTypeId,
        title: newTaskData.value.taskTheme,
        workTypeId: newTaskData.value.workContentId || newTaskData.value.workTypeId
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
const workContentList = ref([])
const workTypeChange = (val = false) => {
  // 当前的level1是
  if (!val) {
    newTaskData.value.workContentId = ''; 
  }
  let level1Name = workTypeMap.value.find(item => item.id === newTaskData.value.workTypeId).level1;
  let newlevel2 = [];
  // debugger;
  workContentMap.value.map(
    item => {
      if (item.level == 2 && item.level1 == level1Name) {
        newlevel2.push(JSON.parse(JSON.stringify(item)))
      }
    }
  );
  console.log('newlevel2', newlevel2);
  
  workContentList.value = newlevel2;
  // console.log("workValue", workValue);
  // if (workValue) {
  //   let download = extractInfo(workValue).filename;
  //   downloadFileName.value = download;
  // } else {
  //   downloadFileName.value = [];
  // }
};
const workContentChange = () => {
  let item = workContentList.value.find(item => item.id == newTaskData.value.workContentId)
  if (item.id && item.priority) {
    newTaskData.value.priorityId = item.priority;
  }
  if (item.id && item.mark) {
    downloadFileName.value = item.mark.split('&')
  }
}

testAllIPs().then(res => {
  if (res.sid) {
    sid.value = res.sid;
    postUrl.value = res.postUrl;
  }
});

function filterByRealFileNameTimestamp(arr) {
  const result = [];
  const nameMap = new Map();
  for (const item of arr) {
    const { name, realFileName } = item;
    const lastUnderscoreIndex = realFileName.lastIndexOf('_');
    const timestamp = Number(realFileName.slice(lastUnderscoreIndex + 1));
    if (nameMap.has(name)) {
      const existingItem = nameMap.get(name);
      const existingTimestamp = Number(existingItem.realFileName.slice(existingItem.realFileName.lastIndexOf('_') + 1));
      if (timestamp > existingTimestamp) {
        nameMap.set(name, item);
      }
    } else {
      nameMap.set(name, item);
    }
  }
  for (const item of nameMap.values()) {
    result.push(item);
  }
  return result;
}
const uploadSuccess = res => {
  loading.value = false;
  console.log("uploadSuccess", res, newTaskData.value.attachments);
  // console.log("getFileName", uniqueByName(newTaskData.value.attachments));
  newTaskData.value.attachments.map(item => {
    item.realFileName = item.raw.name;
  })
  // newTaskData.value.attachments = filterByRealFileNameTimestamp(newTaskData.value.attachments);
  
  // 如果有多个同名的item，那么取最新的
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
const beforeUpload = (file) => {
  console.log('123');

  // const { name } = file;
  // const dotIndex = name.lastIndexOf('.');
  // const fileNameWithoutExtension = name.slice(0, dotIndex);
  // const fileExtension = name.slice(dotIndex);
  // console.log('1234');

  // const newFileName = `${fileNameWithoutExtension}_${Date.now()}${fileExtension}`;
  // console.log('1111', newFileName, file.name);
  // uploadFile
  return true;
};
const uploadRef = ref(null)
const handleChange = (file) => {
  console.log('hhhhhh',JSON.stringify(file));
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
  // loading.value = true;
  console.log(file.raw)
}

const disabledDate = (time) => {
    if (newTaskData.value.expectEndDate) {
      return time.getTime() > new Date(newTaskData.value.expectEndDate).getTime();
    }
    return false;
  }
const uploadFile = () => {

}
const handleError = () => {
  message("上传失败", { type: "error" });
}
</script>

<template>
  <div class="container1">
    <el-form label-position="top" label-width="auto" v-loading="loading" element-loading-text="上传中。。。" ref="formRef"
      :rules="taskRules" :model="newTaskData">
      <p style="margin-bottom: 10px; font-size: 28px; font-weight: 800">
        {{ isNew ? "新建" : "修改" }}任务
      </p>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务主题" prop="taskTheme">
            <el-input :disabled="isEdit" v-model="newTaskData.taskTheme" autocomplete="off" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="业务单元" prop="businessUnit">
            <el-input disabled v-model="newTaskData.businessUnit"></el-input>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="任务类型" prop="taskTypeId">
            <el-select :disabled="isEdit" v-model="newTaskData.taskTypeId" @change="changePri" placeholder="选择任务类型">
              <el-option v-for="item in taskTypeMap" :label="item.value" :value="item.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item class="flex" label="工作类型" prop="workTypeId">
            <el-select :disabled="isEdit" class="flex-1" v-model="newTaskData.workTypeId" @change="workTypeChange(false)"
              placeholder="选择工作类型">
              <el-option v-for="item in workTypeMap" :label="item.level1" :value="item.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item class="flex" label="工作内容" prop="workContentId">
            <el-select :disabled="!newTaskData.workTypeId" class="flex-1" v-model="newTaskData.workContentId"
              placeholder="选择工作内容" @change="workContentChange">
              <el-option v-for="item in workContentList" :label="item.level2" :value="item.id" />
            </el-select>
            <div v-if="downloadFileName.length" class="flex w-full mt-1 ml-1 flex-row-reverse space-x-2 gap-2">
              <el-button :disabled="isEdit" v-for="item in downloadFileName" @click="chaohuiDownload(item)"
                type="primary" class=" underline overflow-hidden whitespace-nowrap text-ellipsis">
                ({{ item }})
              </el-button>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>

      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="任务优先级" prop="priorityId">
            <el-select :disabled="!isEdit" v-model="newTaskData.priorityId" placeholder="选择任务优先级">
              <el-option v-for="item in priMap" :label="item.value" :value="item.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="期望结束日期" prop="expectEndDate">
            <el-date-picker class="!w-full" :disabled="isEdit" v-model="newTaskData.expectEndDate" type="date"
              placeholder="选择期望结束日期" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item label="预估工时" prop="predictDuration">
            <el-input :disabled="isNew || isMy" v-model="newTaskData.predictDuration" autocomplete="off" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="交付时间" prop="endTime">
            <el-date-picker class="!w-full" :disabled-date="disabledDate" :disabled="isNew || isMy"
              v-model="newTaskData.endTime" type="date" placeholder="选择交付时间" />
            <!-- <el-date-picker class="!w-full" :disabled-date="disabledDate" :disabled="isEdit"
              v-model="newTaskData.endTime" type="date" placeholder="选择交付时间" /> -->
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="对接人" prop="contacters">
        <!-- <el-input v-model="newTaskData.contacters" autocomplete="off" /> -->
        <el-button :disabled="isEdit" @click="choosePerson('contacters')">选择对接人</el-button>
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
            <el-button :disabled="isNew || isMy" @click="choosePerson('workers')">选择承接人</el-button>
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
        <el-input :disabled="isEdit" type="textarea" v-model="newTaskData.description" autocomplete="off" />
      </el-form-item>
      <el-form-item label="附件上传" prop="attachments">
        <el-upload ref="uploadRef" v-model:file-list="newTaskData.attachments" class="upload-demo w-full"
          :action="postUrl" :data="{
            path: default_upload_url,
            create_parents: false
          }" :with-credentials="false" :accept="'*'" :on-change="handleChange" :on-error="handleError" :before-upload="beforeUpload"
          :on-success="uploadSuccess" :auto-upload="false" :on-preview="val => {
  console.log('val', val);
            
  chaohuiDownload(val.realFileName || val?.row?.name || val.name);
            }
            " list-type="text">
          <el-button>选择文件</el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="链接上传" prop="links">
        <el-input style="margin-bottom: 10px" v-model="isInputUrl" autocomplete="off">
          <template #append>
            <el-button @click="addUploadUrls"> 添加 </el-button>
          </template>
        </el-input>
        <div class="flex gap-2">
          <el-tag @close="deleteUrl(index)" v-for="(tag, index) in newTaskData.links" :key="tag" closable>
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
