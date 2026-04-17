<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { FormInstance, ElMessage, ElMessageBox } from "element-plus";
import OnlineImg from "../../common/onlineImg.vue";
import { updateMaterial } from "@/api/aiDraw";

const props = defineProps({
  clickRateTrend: {
    type: Object,
    required: true
  },
  fetchMaterialPage: {
    type: Function,
    required: true
  }
});

const dialogVisible = ref(false);
const loading = ref(false);

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  unitId: "",
  product: ""
});

const productConfigUrls = ref([]);
const resultImageData = ref(null);

watch(
  () => props.clickRateTrend,
  newVal => {
    // console.log("点击率配置:", newVal);
    const temp = [];
    for (const item in newVal) {
      temp.push(newVal[item]);
    }
    productConfigUrls.value = temp;

    if (ruleForm.unitId) {
      ruleForm.product = newVal[ruleForm.unitId].imageOss;
    }
  },
  {
    immediate: true
  }
);

// 绑定图片到主图
const bindImage = (unitId: string, imageOss: string) => {
  ruleForm.unitId = unitId;
  ruleForm.product = imageOss;
};

// 保存表单
const saveForm = () => {
  loading.value = true;

  const type = JSON.parse(resultImageData.value.type);
  const temp = {
    ...resultImageData.value,
    type: JSON.stringify({
      ...type,
      clickRateInfo: ruleForm
    })
  };
  // console.log("submitForm:", temp);
  updateMaterial(temp)
    .then((res: any) => {
      if (res.code === 200) {
        ElMessage.success("点击率配置成功");
        props.fetchMaterialPage();
        dialogVisible.value = false;
      } else {
        ElMessage.error("点击率配置失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("点击率配置失败:" + error.message);
    })
    .finally(() => {
      loading.value = false;
    });
};

const initClickRateForm = (data: any) => {
  resultImageData.value = data;
  dialogVisible.value = true;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    const clickRateInfo = JSON.parse(resultImageData.value.type)?.clickRateInfo;
    if (clickRateInfo) {
      ruleForm.unitId = clickRateInfo.unitId;
      ruleForm.product = clickRateInfo.product;
    }
  });
};

defineExpose({
  initClickRateForm
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="点击率配置"
      width="700px"
      :close-on-click-modal="false"
      append-to-body
      align-center
    >
      <el-form
        ref="ruleFormRef"
        :model="ruleForm"
        label-width="auto"
        label-position="top"
        :disabled="loading"
      >
        <el-form-item label="当前绑定主图" prop="unitId">
          <div>
            <div v-if="ruleForm.product">
              <p>{{ ruleForm.unitId }}</p>
              <OnlineImg :url="ruleForm.product" size="250px" />
            </div>
            <div v-else>
              <p>未绑定</p>
              <div
                class="w-[250px] h-[250px] bg-gray-200 flex items-center justify-center"
              >
                暂无主图
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="主图库" class="mt-4" prop="product">
          <div
            class="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300"
            v-if="productConfigUrls.length > 0"
          >
            <el-scrollbar height="380px">
              <el-space wrap :size="30">
                <div
                  v-for="(item, index) in productConfigUrls"
                  :key="item.unitId"
                  class="flex flex-col items-center box-border p-[4px]"
                  :class="{
                    'peidi-aiDrawingPro-material-clickRateForm-current-main':
                      ruleForm.unitId === item.unitId
                  }"
                >
                  <!-- 图片预览区域 -->
                  <div class="mb-2">
                    <OnlineImg :url="item.imageOss" size="180px" />
                  </div>

                  <!-- 图片标题 -->
                  <div class="text-xs text-gray-500 mb-2">
                    {{ item.unitId }}
                  </div>

                  <!-- 绑定按钮 -->
                  <el-button
                    class="w-full"
                    size="small"
                    :type="
                      ruleForm.unitId === item.unitId ? 'success' : 'primary'
                    "
                    :disabled="ruleForm.unitId === item.unitId"
                    @click="bindImage(item.unitId, item.imageOss)"
                  >
                    {{ ruleForm.unitId === item.unitId ? "当前" : "绑定" }}
                  </el-button>
                </div>
              </el-space>
            </el-scrollbar>
          </div>
          <div v-else class="text-gray-500">本周暂无数据</div>
        </el-form-item>

        <el-form-item class="mt-6">
          <div class="flex justify-end w-full">
            <el-button type="primary" @click="saveForm" :loading="loading">
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.peidi-aiDrawingPro-material-clickRateForm-current-main {
  position: relative;
}

.peidi-aiDrawingPro-material-clickRateForm-current-main::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px solid #22c55e;
  pointer-events: none;
}
</style>
