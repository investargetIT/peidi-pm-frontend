<template>
  <div>
    <el-dialog v-model="dialogVisible" title="关闭任务" width="30%">
      <el-form :model="form" ref="formRef" :rules="rules" label-width="120px">
        <el-form-item label="工作内容" prop="workContent">
          <el-input v-model="form.workContent" :placeholder="`${username} 标记为任务关闭`" :disabled="true" :readonly="true"
            :required="true"></el-input>
        </el-form-item>
        <el-form-item label="附加描述" prop="description">
          <el-input type="textarea" v-model="form.description" :required="true"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" color="#171719" @click="submitForm">确认</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import {
  getTaskRecord,
  newTaskRecord,
  deleteTaskRecord,
  updateTaskRecord,
  getOneTask,
  updateTask
} from "../../api/pmApi";
import dayjs from 'dayjs';
import { message } from "@/utils/message";
const dialogVisible = defineModel('closeModalShow');

const { closeData } = defineProps(['closeData']);
const emits = defineEmits(['refresh']);
const rules = ref({
  workContent: [
    { required: true, message: '请输入工作内容', trigger: 'blur' }
  ],
  description: [
    { required: true, message: '请输入附加描述', trigger: 'blur' }
  ]
});
const pickerOptions = ref({
  shortcuts: [
    {
      text: '今天',
      onClick(picker) {
        const start = new Date();
        const end = new Date();
        picker.$emit('pick', [start, end]);
      }
    }
  ]
});
let ddUserInfo = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}
const username = ref(ddUserInfo.name); // 替换为获取当前登录用户名的逻辑
const form = ref({
  timeRange: [new Date(), new Date()],
  workContent: ddUserInfo.name + ' 标记为任务关闭',
  description: ''
});
const openDialog = () => {
  dialogVisible.value = true;
};
const formRef = ref(null);
let isLoading = false;
const submitForm = () => {
  formRef.value.validate(valid => {
    if (valid) {
      // 处理表单提交
      console.log('表单已提交:', form.value);
      if (isLoading) {
        return
      }
      isLoading=true;
      newTaskRecord({
        content: form.value.workContent,
        descriptionExt: form.value.description,
        endTime: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
        startTime: dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss'),
        taskId: closeData.id,
        worker: { userName: ddUserInfo.name, userId: ddUserInfo.userid }
      }).then(res => {
        const { code, data } = res;
        if (code == 200) {
          updateTask({
            ...closeData,
            statusId : 70
          })
          .then(res => {
            const { code , data } = res;
            if (code == 200) {
              message("关闭任务成功", { type: "success" });
              dialogVisible.value = false;
              emits('refresh')
            }
          })
          .finally(() => {
            isLoading = false;
          });
        }
      });
      
    } else {
      console.log('表单验证失败');
      return false;
    }
  });
};
watch(() => dialogVisible.value, (newVal) => {
  if (!newVal) {
    // 重置表单
    form.value = {
      timeRange: [new Date(), new Date()],
      workContent: '',
      description: ''
    };
  }
});
</script>