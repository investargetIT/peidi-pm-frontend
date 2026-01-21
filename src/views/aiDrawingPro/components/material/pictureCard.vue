<script setup lang="ts">
import { computed } from "vue";
import OnlineImg from "../../common/onlineImg.vue";
import { getNameFromObjectName } from "../../utils/general/index";
import { deleteMaterial } from "@/api/aiDraw";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  fetchMaterialPage: {
    type: Function,
    required: true
  },
  handleContact: {
    type: Function,
    required: true
  }
});

const getMTType = computed(() => {
  return JSON.parse(props.data.type)?.mtype || "";
});

const handleDelete = () => {
  ElMessageBox.confirm(
    `确定删除素材【${getNameFromObjectName(props.data.objectName)}】吗？`,
    "删除确认",
    {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning"
    }
  )
    .then(() => {
      deleteMaterial({
        id: props.data.id
      })
        .then((res: any) => {
          if (res.code === 200) {
            ElMessage.success("删除成功");
            props.fetchMaterialPage();
          } else {
            ElMessage.error("删除失败:" + res.msg);
          }
        })
        .catch(error => {
          ElMessage.error("删除失败:" + error.message);
        });
    })
    .catch(() => {});
};
</script>

<template>
  <div>
    <el-card shadow="hover" style="width: 240px">
      <template #header>
        <span>{{ getNameFromObjectName(props.data.objectName) }}</span>
      </template>
      <template #footer>
        <div>
          <el-button type="danger" @click="handleDelete" text>删除</el-button>
          <el-button
            type="primary"
            @click="props.handleContact(props.data)"
            text
            v-if="getMTType === 'product'"
            >关联</el-button
          >
        </div>
      </template>

      <div class="flex justify-center items-center">
        <OnlineImg :url="props.data.objectName" size="180px" />
      </div>
    </el-card>
  </div>
</template>
