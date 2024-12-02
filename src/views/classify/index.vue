<script setup lang="ts">
import {
  getAllCate,
  addCate,
  updateCate,
  deleteCate,
  getPageCate,
  getJsApi
} from "@/api/user";
import { ref, watch } from "vue";
import { message } from "@/utils/message";
import * as dd from "dingtalk-jsapi";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
setTimeout(() => {
  initDingH5RemoteDebug();
}, 100);

defineOptions({
  name: "Welcome"
});

const nonceStr = "pmUsed";

const tableData = ref([]);

getJsApi({
  nonceStr,
  url: location.href
}).then(res => {
  // dd.config去注册接口
  const {
    data: { sign, timeStamp }
  } = res;
  if (sign && timeStamp) {
    dd.config({
      agentId: "3313977729", // 必填，微应用ID
      corpId: DINGTALK_CORP_ID, //必填，企业ID
      timeStamp, // 必填，生成签名的时间戳
      nonceStr, // 必填，自定义固定字符串。
      signature: sign, // 必填，签名
      // type: 0 / 1,   //选填。0表示微应用的jsapi,1表示服务窗的jsapi；不填默认为0。该参数从dingtalk.js的0.8.3版本开始支持
      jsApiList: [
        "runtime.info",
        "biz.contact.choose",
        "device.notification.confirm",
        "device.notification.alert",
        "device.notification.prompt",
        "biz.ding.post",
        "biz.util.openLink"
      ] // 必填，需要使用的jsapi列表，注意：不要带dd。
    });

    dd.error(function (err) {
      // alert('dd error: ' + location.href + JSON.stringify(err));
    });
  }
});

const choosePerson = () => {
  try {
    dd.biz.contact.choose({
      multiple: true, //是否多选：true多选 false单选； 默认true
      users: [], //默认选中的用户列表，员工userid；成功回调中应包含该信息
      corpId: DINGTALK_CORP_ID, //企业id
      max: 10, //人数限制，当multiple为true才生效，可选范围1-1500
      onSuccess: function (data) {
        /* data结构
          [{
            "name": "张三", //姓名
            "avatar": "
    http://g.alicdn.com/avatar/zhangsan.png
    " //头像图片url，可能为空
            "emplId": '0573', //员工userid
           },
           ...
          ]
        */
        alert("dd successs: " + JSON.stringify(data));
      },
      onFail: function (err) {
        alert("dd error: " + JSON.stringify(err));
      }
    });
  } catch (error) {
    alert("dd error1: " + error);
  }
};

const currentPage = ref([]);
const pageSizeArr = ref([5, 10, 15, 20]);
const pageSize = ref(pageSizeArr.value[0]);

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
  getPageCate({
    pageNo: Number(currentPageNum.value),
    pageSize: Number(pageSize.value)
  }).then(res => {
    console.log("res", res);
    if (res?.code) {
      currentPage.value = res?.data?.records || [];
    }
  });
};

// getAllCateFun();
// getCurrentPage();

// 清除新增任务信息
const clearNewCateData = () => {
  newCateData.value.name = "";
  newCateData.value.code = "";
};

const addCateData = async () => {
  if (!formRef) return;
  await formRef.value.validate((valid, fields) => {
    if (valid) {
      console.log("submit!");
      addCate({
        categoryCode: "" + newCateData.value.code,
        categoryName: "" + newCateData.value.name
      })
        .then(res => {
          const { code, data, msg } = res;
          if (res.code == 200) {
            message("添加任务成功", { type: "success" });
            dialogFormVisible.value = false;
            clearNewCateData();
            getAllCateFun();
          } else {
            message("添加任务失败--" + msg, { type: "error" });
          }
        })
        .catch(err => {
          message("添加任务失败", { type: "error" });
        });
    } else {
      console.log("error submit!", fields);
    }
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

const newTaskData = ref({
  // 任务名称
  taskName: "",
  // 状态
  taskStatus: 0,
  // 完成进度
  taskProgress: 0,
  // 类型
  taskType: 0,
  // 紧急程度
  taskUrgency: 0,
  // 优先级
  taskPriority: 0,
  // 任务主题
  taskTheme: 0,
  // 任务描述
  taskDescription: "",
  // 关联项目
  relationTask: "",
  // 负责人
  hoster: "",
  // 协作人
  helper: "",
  // 预估工时
  workTime: 0,
  // 预计结束日期
  endTime: "",
  // 附件上传
  relationFile: []
});

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

// 删除任务的方法
const deleteCateFun = () => {
  if (
    !activeCateData.value.categoryCode ||
    !activeCateData.value.categoryName ||
    !activeCateData.value.id
  ) {
    return;
  }
  deleteCate({
    categoryCode: "" + activeCateData.value.categoryCode,
    categoryName: "" + activeCateData.value.categoryName,
    id: activeCateData.value.id
  })
    .then(res => {
      const { code, data, msg } = res;
      if (res.code == 200) {
        message("删除任务成功", { type: "success" });
        dialogUpdateVisible.value = false;
        getAllCateFun();
        getCurrentPage();
      } else {
        message("删除任务失败--" + msg, { type: "error" });
      }
    })
    .catch(err => {
      message("删除任务失败", { type: "error" });
    });
};

const changeCurrentPage = val => {
  console.log("val", val);
};

watch([currentPageNum, pageSize], () => {
  console.log("currentPageNum", currentPageNum.value);
  getCurrentPage();
});

const formRef = ref(null);
const rules = ref({
  name: [{ required: true, message: "Please input name", trigger: "blur" }],
  code: [{ required: true, message: "Please input code", trigger: "blur" }]
});
</script>

<template>
  <div class="container">
    <el-button
      class="addCate"
      type="primary"
      size="large"
      @click="
        dialogFormVisible = true;
        clearNewCateData();
        // choosePerson()
      "
    >
      添加任务
    </el-button>
    <el-table :data="currentPage" style="width: 90%">
      <el-table-column fixed prop="categoryName" label="主任务" width="250" />
      <el-table-column prop="categoryCode" label="编码" width="220" />
      <el-table-column fixed="right" label="操作" min-width="120">
        <template #default="scope">
          <el-button
            link
            type="primary"
            size="large"
            @click="openUpdatePop(scope)"
          >
            更新
          </el-button>
          <el-button link type="primary" @click="deletePop(scope)" size="large"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      v-model:current-page="currentPageNum"
      @current-change="changeCurrentPage"
      v-model:page-size="pageSize"
      :page-sizes="pageSizeArr"
      @size-change="handleSizeChange"
      layout="total, sizes, prev, pager, next, jumper"
      :total="tableData.length"
    />
    <el-dialog v-model="dialogFormVisible" title="添加新任务" width="800">
      <el-form ref="formRef" :model="newTaskData">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务名称" prop="taskName">
              <el-input v-model="newTaskData.taskName" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务状态" prop="taskStatus">
              <el-input v-model="newTaskData.taskStatus" autocomplete="off" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务完成进度" prop="taskProgress">
              <el-input v-model="newTaskData.taskProgress" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务类型" prop="taskType">
              <el-input v-model="newTaskData.taskType" autocomplete="off" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="紧急程度" prop="taskUrgency">
              <el-input v-model="newTaskData.taskUrgency" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务优先级" prop="taskPriority">
              <el-input v-model="newTaskData.taskPriority" autocomplete="off" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="任务主题" prop="taskTheme">
              <el-input v-model="newTaskData.taskTheme" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务描述" prop="taskDescription">
              <el-input
                v-model="newTaskData.taskDescription"
                autocomplete="off"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="关联项目" prop="relationTask">
              <el-input v-model="newTaskData.relationTask" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="负责人" prop="hoster">
              <el-input v-model="newTaskData.hoster" autocomplete="off" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="协作人" prop="helper">
              <el-input v-model="newTaskData.helper" autocomplete="off" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预估工时" prop="workTime">
              <el-input v-model="newTaskData.workTime" autocomplete="off" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="预计结束日期" prop="endTime">
          <el-input v-model="newTaskData.endTime" autocomplete="off" />
        </el-form-item>
        <el-form-item label="附件上传" prop="relationFile">
          <el-input v-model="newTaskData.relationFile" autocomplete="off" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="addCateData"> 添加 </el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog v-model="dialogDeleteVisible" title="" width="500">
      <span>确定删除该任务吗？</span>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogDeleteVisible = false">取消</el-button>
          <el-button
            type="primary"
            @click="
              dialogDeleteVisible = false;
              deleteCateFun();
            "
          >
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.container {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding-top: 54px;
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
</style>
