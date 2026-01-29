<script setup lang="ts">
import { reactive, ref, nextTick } from "vue";
import { getNameFromObjectName } from "../../utils/general/index";
import OnlineImg from "../../common/onlineImg.vue";
import { updateMaterial } from "@/api/aiDraw";
import { ElMessage, FormInstance } from "element-plus";

const props = defineProps({
  materialList: {
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
const contactData = ref(null);

const initContactForm = (data: any) => {
  contactData.value = data;
  dialogVisible.value = true;

  nextTick(() => {
    ruleFormRef.value?.resetFields();
    const contactInfo = JSON.parse(contactData.value.type)?.contactInfo;
    if (contactInfo) {
      Object.keys(contactInfo).forEach(key => {
        ruleForm[key] = contactInfo[key];
      });
    }
  });
};

const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  gift: "",
  template: "",
  activityLogo: "",
  shopLogo: "",
  brandLogo: ""
});

const submitForm = () => {
  loading.value = true;
  // console.log("ruleForm:", ruleForm, contactData.value);
  const type = JSON.parse(contactData.value.type);
  const temp = {
    ...contactData.value,
    type: JSON.stringify({
      ...type,
      contactInfo: ruleForm
    })
  };
  // console.log("submitForm:", temp);
  updateMaterial(temp)
    .then((res: any) => {
      if (res.code === 200) {
        ElMessage.success("素材关联成功");
        props.fetchMaterialPage();
        dialogVisible.value = false;
      } else {
        ElMessage.error("关联素材失败:" + res.msg);
      }
    })
    .catch(error => {
      ElMessage.error("关联素材失败:" + error.message);
    })
    .finally(() => {
      loading.value = false;
    });
};

defineExpose({
  initContactForm
});
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="关联素材"
      width="600"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form
        ref="ruleFormRef"
        style="max-width: 600px"
        :model="ruleForm"
        label-width="auto"
        :disabled="loading"
      >
        <el-form-item label="赠品" prop="gift">
          <el-select v-model="ruleForm.gift" placeholder="请选择" clearable>
            <el-option
              v-for="item in props.materialList.gift"
              :key="item.objectName"
              :label="getNameFromObjectName(item.objectName)"
              :value="item.objectName"
            />
          </el-select>
          <OnlineImg :url="ruleForm.gift" size="100px" v-if="ruleForm.gift" />
        </el-form-item>

        <el-form-item label="模板" prop="template">
          <el-select v-model="ruleForm.template" placeholder="请选择" clearable>
            <el-option
              v-for="item in props.materialList.template"
              :key="item.objectName"
              :label="getNameFromObjectName(item.objectName)"
              :value="item.objectName"
            />
          </el-select>
          <OnlineImg
            :url="ruleForm.template"
            size="100px"
            v-if="ruleForm.template"
          />
        </el-form-item>

        <el-form-item label="活动LOGO" prop="activityLogo">
          <el-select
            v-model="ruleForm.activityLogo"
            placeholder="请选择"
            clearable
          >
            <el-option
              v-for="item in props.materialList.activityLogo"
              :key="item.objectName"
              :label="getNameFromObjectName(item.objectName)"
              :value="item.objectName"
            />
          </el-select>
          <OnlineImg
            :url="ruleForm.activityLogo"
            size="100px"
            v-if="ruleForm.activityLogo"
          />
        </el-form-item>

        <el-form-item label="店铺LOGO" prop="shopLogo">
          <el-select v-model="ruleForm.shopLogo" placeholder="请选择" clearable>
            <el-option
              v-for="item in props.materialList.shopLogo"
              :key="item.objectName"
              :label="getNameFromObjectName(item.objectName)"
              :value="item.objectName"
            />
          </el-select>
          <OnlineImg
            :url="ruleForm.shopLogo"
            size="100px"
            v-if="ruleForm.shopLogo"
          />
        </el-form-item>

        <!-- <el-form-item label="品牌LOGO" prop="brandLogo">
          <el-select
            v-model="ruleForm.brandLogo"
            placeholder="请选择"
            clearable
          >
            <el-option
              v-for="item in props.materialList.brandLogo"
              :key="item.objectName"
              :label="getNameFromObjectName(item.objectName)"
              :value="item.objectName"
            />
          </el-select>
          <OnlineImg
            :url="ruleForm.brandLogo"
            size="100px"
            v-if="ruleForm.brandLogo"
          />
        </el-form-item> -->

        <el-form-item>
          <div class="flex justify-end w-full">
            <el-button type="primary" @click="submitForm" :loading="loading">
              保存
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>
