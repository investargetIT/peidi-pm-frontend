<script lang="ts" setup>
import dd from 'dingtalk-jsapi';
import { ref, defineEmits } from 'vue';
import { extractEmplId } from './utils';
import { getEnum } from '../../api/pmApi';

type Worker = {
  userId: string,
  userName: string,
  identify: string,
  name?: string,
  emplId?: string
}
interface Props {
  workersData: Array<Worker>,
}
const props = defineProps<Props>()
// 父组件定义@refresh事件得到新的承接人数据
const emit = defineEmits(['refresh'])

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const dialogVisible = ref(false);

const workerExMap = ref([{
  id: '',
  name: ''
}]);

// #region 获取外部承接人列表
getEnum({
  type: "workerEx"
}).then((res: any) => {
  const { code, data } = res;
  if (code == 200) {
    workerExMap.value = data;
    workerExMap.value.map((item: any) => {
      item.id = item.value.split('&')[0];
      item.name = item.value.split('&')[1];
    })
  }
});
// #endregion

// 内部承接人列表
const workers = ref<Worker[]>([
  // {
  //   userId: '1',
  //   userName: 'n1',
  //   identify: 'worker'
  // }
]);
// 外部承接人列表
const workersEx = ref<Worker[]>([
  // {
  //   userId: '4',
  //   userName: 'w4',
  //   identify: 'worker_ex'
  // }
]);
// 外部承接人选中项
const workersExIds = ref<string[]>([]);

// #region 初始化源数据
const initWorkers = () => {
  workers.value = props.workersData.filter(item => item.identify == 'worker');
  // 格式化内部承接人适配钉钉选择器
  workers.value.map((item: any) => {
    item.name = item.userName;
    item.emplId = item.userId;
  });
  workersEx.value = props.workersData.filter(item => item.identify == 'worker_ex');
  workersExIds.value = workersEx.value.map(item => item.userId);
}
// #endregion

// #region 选择内部承接人
const choosePerson = () => {
  try {
    const data_this = workers.value;

    dd.biz.contact.choose({
      multiple: true, //是否多选：true多选 false单选； 默认true
      users: extractEmplId(data_this), //默认选中的用户列表，员工userid；成功回调中应包含该信息
      corpId: DINGTALK_CORP_ID, //企业id
      max: 10, //人数限制，当multiple为true才生效，可选范围1-1500
      onSuccess: function (data: any) {
        console.log("data", data);
        /* data结构
         [{
           "name": "张三", //姓名
           "avatar": "http://g.alicdn.com/avatar/zhangsan.png" //头像图片url，可能为空
           "emplId": '0573', //员工userid
          }] */

        workers.value = data.map((item: any) => ({ ...item, userId: item.emplId, userName: item.name, identify: 'worker' }));
        console.log("data", data);

      },
      onFail: function (err: any) { }
    });
  } catch (error) {
    alert("dd error1: " + error);
  }
};
// #endregion

// #region 取消选择内部承接人
const deleteWorker = (index: number) => {
  workers.value.splice(index, 1);
};
// #endregion

// #region 确定后统一处理数据格式
const handleOk = () => {
  const result: Array<Worker> = [...workers.value];

  workersExIds.value.forEach((item: string) => {
    result.push({
      userId: item,
      userName: workerExMap.value.find((workerEx: any) => workerEx.id == item)?.name || '',
      identify: 'worker_ex',
      name: workerExMap.value.find((workerEx: any) => workerEx.id == item)?.name || '',
      emplId: item
    });
  })

  emit('refresh', result);
  dialogVisible.value = false;
}
// #endregion


const handleShow = () => {
  initWorkers();
  dialogVisible.value = true;
}
defineExpose({
  handleShow
});
</script>

<template>
  <el-dialog v-model="dialogVisible" title="承接人" width="500" :close-on-click-modal="false">
    <div>
      <el-divider content-position="left">内部承接人</el-divider>
      <el-tag v-for="(item, index) in workers" :key="item.userId" closable :type="'info'" @close="deleteWorker(index)"
        style="margin-right: 10px;">
        {{ item.userName }}
      </el-tag>
      <el-button @click="choosePerson()">+</el-button>

      <div style="height: 20px;"></div>
      <el-divider content-position="left">外部承接人</el-divider>
      <el-select v-model="workersExIds" multiple placeholder="选择外部承接人">
        <el-option v-for="item in workerExMap" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleOk">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>
