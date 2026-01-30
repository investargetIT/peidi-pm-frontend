<script setup lang="ts">
import { computed } from "vue";
import OnlineImg from "../../common/onlineImg.vue";
import ClickRateCharts from "./clickRateCharts.vue";
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
  },
  handleCreate: {
    type: Function,
    required: true
  },
  handleClickRate: {
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
        <el-text class="w-full" truncated size="large">
          <span class="text-[#000] font-bold text-[14px]">{{
            getNameFromObjectName(props.data.objectName)
          }}</span>
        </el-text>
      </template>
      <template #footer>
        <div>
          <el-button type="danger" @click="handleDelete" text>删除</el-button>
          <el-button
            type="primary"
            @click="props.handleContact(props.data)"
            text
            v-if="getMTType === 'product'"
          >
            关联
          </el-button>
          <el-button
            type="success"
            @click="props.handleCreate(props.data)"
            text
            v-if="getMTType === 'template'"
          >
            创意
          </el-button>
          <el-button
            type="warning"
            @click="props.handleClickRate(props.data)"
            text
            v-if="getMTType === 'resultImage'"
          >
            点击率
          </el-button>
        </div>
      </template>

      <div class="flex flex-col justify-center items-center">
        <div>
          <OnlineImg :url="props.data.objectName" size="200px" />
        </div>

        <div class="w-full mt-[10px]" v-if="getMTType === 'resultImage'">
          <ClickRateCharts :sourceData="props.data" />
        </div>
      </div>
    </el-card>
  </div>
</template>
