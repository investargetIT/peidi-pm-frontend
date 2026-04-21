<script setup lang="ts">
import { ref, watch } from "vue";
import PictureCard from "./pictureCard.vue";
import { Back } from "@element-plus/icons-vue";

const props = defineProps({
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
  },
  cardData: {
    type: Array<any>,
    required: true
  },
  mtype: {
    type: String,
    required: true
  }
});

// 模式 "folder"|"picture"
const mode = ref("picture");
// 文件夹卡片数据
const folderCardData = ref([
  // {
  //   name: "默认文件夹",
  //   dataList: []
  // }
]);
const folderSelectedName = ref("");
const folderSelectedCardData = ref([]);

const handleClickFolder = (name: string) => {
  folderSelectedName.value = name;
  folderSelectedCardData.value =
    folderCardData.value.find(folder => folder.name === name)?.dataList || [];
};

const handleClickBack = () => {
  folderSelectedName.value = "";
  folderSelectedCardData.value = [];
};

watch(
  () => [props.cardData, props.mtype],
  ([newCardData, newMtype]: any) => {
    console.log("cardData", newCardData, newMtype);

    if (newMtype === "componentMaterial") {
      mode.value = "folder";

      // 遍历分组，将数据分配到对应的文件夹中
      const folderCardDataTemp = [];
      if (newCardData.length > 0) {
        newCardData.forEach(item => {
          // 解析type字段是否有folder属性，有的话就加入对应文件夹中，没有就加入默认文件夹
          const folderName = JSON.parse(item?.type)?.folder || "默认文件夹";
          // 去folderCardDataTemp寻找是否有name为folderName的数据，没有就新建一个，有就加入对应的dataList
          const folderIndex = folderCardDataTemp.findIndex(
            folder => folder.name === folderName
          );
          if (folderIndex === -1) {
            folderCardDataTemp.push({
              name: folderName,
              dataList: [item]
            });
          } else {
            folderCardDataTemp[folderIndex].dataList.push(item);
          }
        });
      }
      folderCardData.value = folderCardDataTemp;
      handleClickFolder(folderSelectedName.value);
    } else {
      mode.value = "picture";
    }
  },
  {
    immediate: true,
    deep: true
  }
);
</script>

<template>
  <div>
    <el-scrollbar height="calc(100vh - 180px)">
      <div v-if="mode === 'picture'" class="picture-card-container">
        <PictureCard
          v-for="item in cardData"
          :key="item.id"
          :data="item"
          :fetchMaterialPage="fetchMaterialPage"
          :handleContact="handleContact"
          :handleCreate="handleCreate"
          :handleClickRate="handleClickRate"
          :handleDescriptorInfo="handleDescriptorInfo"
          :handleEditPhraseInfo="handleEditPhraseInfo"
          :handleModuleEdit="handleModuleEdit"
          :handleChangeChangeFolder="handleChangeChangeFolder"
        />
      </div>
      <div v-else>
        <!-- 路径显示 -->
        <div class="flex items-center mb-4">
          <!-- <el-button type="primary" :icon="Back" text /> -->
          <el-icon
            v-show="folderSelectedName"
            color="var(--el-color-primary)"
            class="cursor-pointer"
            @click="handleClickBack"
          >
            <Back />
          </el-icon>
          <span class="text-sm"
            >文件夹目录{{
              folderSelectedName ? " / " + folderSelectedName : ""
            }}</span
          >
        </div>

        <div v-if="folderSelectedName" class="picture-card-container">
          <PictureCard
            v-for="item in folderSelectedCardData"
            :key="item.id"
            :data="item"
            :fetchMaterialPage="fetchMaterialPage"
            :handleContact="handleContact"
            :handleCreate="handleCreate"
            :handleClickRate="handleClickRate"
            :handleDescriptorInfo="handleDescriptorInfo"
            :handleEditPhraseInfo="handleEditPhraseInfo"
            :handleModuleEdit="handleModuleEdit"
            :handleChangeChangeFolder="handleChangeChangeFolder"
          />
        </div>

        <div v-else class="picture-card-container">
          <el-card
            v-for="item in folderCardData"
            :key="item.name"
            shadow="hover"
            style="width: 240px; border-radius: 10px; cursor: pointer"
            @click="handleClickFolder(item.name)"
          >
            <div class="flex flex-col justify-center items-center py-6">
              <el-icon :size="60" color="var(--el-color-primary)">
                <Folder />
              </el-icon>
              <el-text
                class="mt-4 cursor-pointer hover:text-[var(--el-color-primary)]"
                truncated
                size="large"
              >
                <span class="text-[#000] font-bold text-[14px]">{{
                  item.name || item.folderName || "未命名文件夹"
                }}</span>
              </el-text>
            </div>
          </el-card>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<style lang="scss" scoped>
.picture-card-container {
  display: grid;
  // 关键：每个卡片最小 240px（卡片实际宽度），最大 1fr（均分剩余空间）
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;

  // 让所有列靠左对齐，不满一行时自然靠左
  justify-content: start;
}
</style>
