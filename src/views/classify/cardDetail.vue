<template>
  <el-dialog :close-on-click-modal="false" :width="'80%'" :close-on-press-escape="false" :show-close="false"
    v-model="jjj">
    <el-card v-if="detail.contacters">
      <template #header>
        <div class="card-header">
          <h3>任务详情</h3>
        </div>
      </template>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">工作内容:</span>
        <span>{{ detail.workContent }}</span>
      </p>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">优先级:</span>
        <span>{{ detail.priorityName }}</span>
      </p>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">任务主题:</span>
        <span>{{ detail.workTypeName }}</span>
      </p>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">需求发起人:</span>
        <span>{{ detail.contacters.map(item => item.userName).join('、') }}</span>
      </p>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">期望完成时间:</span>
        <span>{{ detail.expectEndDate }}</span>
      </p>
      <p class=" mb-1">
        <span class=" font-semibold mr-2">任务状态:</span>
        <span>{{ detail.statusName }}</span>
      </p>
      <template #footer>
        <div class=" w-full flex">
          <el-button color="#171719" v-if="!detail.workers?.length" :disabled="detail.statusName != '待处理'" @click="examine">分配任务</el-button>
          <el-button color="#171719" v-if="detail.workers?.length" :disabled="true">已分配</el-button>
          <el-button :disabled="detail.workers?.length || detail.statusName != '待处理'" @click="close">关闭任务</el-button>
        </div>
      </template>
    </el-card>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  getTaskRecord,
  newTaskRecord,
  deleteTaskRecord,
  updateTaskRecord,
  getOneTask,
  updateTask
} from "../../api/pmApi";
import { useRouter } from 'vue-router';
const router = useRouter();
const jjj = ref(true)
const { visible, detailId } = defineProps(['visible', 'detailId'])
const emit = defineEmits(['closeTask', 'close','examine'])
const detail = ref({})
getOneTask({
  id: detailId
}).then(res => {
  const { code, data } = res;
  if (code == 200) {
    detail.value = data;
    if (detail.value?.workers?.length || detail.value?.statusName != '待处理') {
      // 把当前url的detailId的参数给去掉
      const query = { ...router.currentRoute.value.query };
      delete query.detailId;
      router.replace({ query });
      emit('close')
    }
  }else{
    emit('close')
  }
});

const close = () => {
  emit('closeTask', detail.value);
  emit('close')
}

const examine = () => {
  emit('examine', detail.value);
  emit('close')

}




</script>

<style scoped>
.card {
  /* Add your card styles here */
}

.card-header {
  /* Add your header styles here */
}

.card-body {
  /* Add your body styles here */
}

.card-footer {
  /* Add your footer styles here */
}
</style>