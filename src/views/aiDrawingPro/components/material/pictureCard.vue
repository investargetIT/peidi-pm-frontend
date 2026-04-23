<script setup lang="ts">
import { computed } from "vue";
import OnlineImg from "../../common/onlineImg.vue";
import ClickRateCharts from "./clickRateCharts.vue";
import { getNameFromObjectName } from "../../utils/general/index";
import { deleteMaterial } from "@/api/aiDraw";
import { ElMessage, ElMessageBox } from "element-plus";
import { Delete } from "@element-plus/icons-vue";

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
  },
  handleDescriptorInfo: {
    type: Function,
    required: true
  },
  handleEditPhraseInfo: {
    type: Function,
    required: true
  },
  handleModuleEdit: {
    type: Function,
    required: true
  },
  handleChangeChangeFolder: {
    type: Function,
    required: true
  }
});

const getMTType = computed(() => {
  return JSON.parse(props.data.type)?.mtype || "";
});

const getEditPhraseInfo = computed(() => {
  return JSON.parse(props.data.type)?.editPhraseInfo?.editPhraseInfo === "";
  // return true;
});

const copyName = () => {
  const name = getNameFromObjectName(props.data.objectName);
  navigator.clipboard
    .writeText(name)
    .then(() => {
      ElMessage.success("名称已复制");
    })
    .catch(() => {
      ElMessage.error("复制失败");
    });
};

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
    <el-card shadow="hover" style="width: 240px; border-radius: 10px">
      <template #header>
        <div class="flex justify-between">
          <el-tooltip
            :content="getNameFromObjectName(props.data.objectName)"
            placement="top"
            :show-after="300"
          >
            <el-text
              class="w-full cursor-pointer hover:text-[var(--el-color-primary)]"
              truncated
              size="large"
              @click="copyName"
            >
              <span class="text-[#000] font-bold text-[14px]">{{
                getNameFromObjectName(props.data.objectName)
              }}</span>
            </el-text>
          </el-tooltip>
          <div>
            <el-button
              :icon="Delete"
              type="danger"
              text
              size="small"
              @click="handleDelete"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <el-space wrap>
          <!-- <el-button type="danger" @click="handleDelete" text>删除</el-button> -->
          <el-button
            v-if="getMTType === 'product'"
            type="primary"
            text
            @click="props.handleContact(props.data)"
          >
            关联
          </el-button>
          <el-button
            v-if="getMTType === 'template'"
            type="success"
            text
            size="small"
            @click="props.handleCreate(props.data)"
          >
            创意
          </el-button>
          <!-- <el-button
            type="primary"
            @click="props.handleDescriptorInfo(props.data)"
            text
            v-if="getMTType === 'template'"
          >
            描述词
          </el-button> -->
          <el-button
            v-if="getMTType === 'template'"
            type="primary"
            text
            size="small"
            @click="props.handleEditPhraseInfo(props.data)"
          >
            编辑词
          </el-button>
          <el-tooltip
            content="请先生成编辑词"
            placement="top"
            :disabled="!getEditPhraseInfo"
            :show-after="200"
          >
            <div>
              <el-button
                v-if="getMTType === 'template'"
                type="primary"
                text
                :disabled="getEditPhraseInfo"
                size="small"
                @click="props.handleModuleEdit(props.data)"
              >
                模板编辑
              </el-button>
            </div>
          </el-tooltip>
          <el-button
            v-if="getMTType === 'resultImage'"
            type="warning"
            text
            size="small"
            @click="props.handleClickRate(props.data)"
          >
            点击率
          </el-button>
          <el-button
            v-if="getMTType === 'componentMaterial'"
            type="primary"
            text
            size="small"
            @click="props.handleChangeChangeFolder(props.data)"
          >
            更换文件夹
          </el-button>
        </el-space>
      </template>

      <div class="flex flex-col justify-center items-center">
        <div>
          <OnlineImg :url="props.data.objectName" size="200px" />
        </div>

        <div v-if="getMTType === 'resultImage'" class="w-full mt-[10px]">
          <ClickRateCharts :sourceData="props.data" />
        </div>
      </div>
    </el-card>
  </div>
</template>
