<script setup lang="ts">
import { ref, reactive, watch, toRefs } from "vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";

interface FormData {
  id: number;
  month: string;
  shopName: string;
  brand: string;
  spu: string;
  taxedIncome: number | string;
  grossProfit: number | string;
  userName: string;
  userId: number;
}

interface Props {
  modelValue: boolean;
  formData?: FormData;
  userList?: any[];
}

interface Emits {
  (e: "update:modelValue", value: boolean): void;
  (e: "success"): void;
}

const props = withDefaults(defineProps<Props>(), {
  formData: () => ({
    id: null,
    month: "",
    shopName: "",
    brand: "",
    spu: "",
    taxedIncome: "",
    grossProfit: "",
    userName: "",
    userId: null
  }),
  userList: () => []
});

const { userList } = toRefs(props);

const emit = defineEmits<Emits>();

const formLoading = ref(false);
const formRef = ref<FormInstance>();

const detailForm = reactive({
  id: "",
  month: "",
  shopName: "",
  brand: "",
  spu: "",
  taxedIncome: "",
  grossProfit: "",
  userNames: [],
  userIds: []
});

const detailRules = reactive<FormRules>({
  userIds: [{ required: true, message: "请选择负责人", trigger: "blur" }]
});

watch(
  () => props.formData,
  newData => {
    if (newData) {
      detailForm.id = newData.id?.toString() || null;
      detailForm.month = newData.month || "";
      detailForm.shopName = newData.shopName || "";
      detailForm.brand = newData.brand || "";
      detailForm.spu = newData.spu || "";
      detailForm.taxedIncome = newData.taxedIncome?.toString() || "";
      detailForm.grossProfit = newData.grossProfit?.toString() || "";
      detailForm.userNames = [newData.userName];
      detailForm.userIds = [newData.userId];
      if (newData.userName && !newData.userId) {
        detailForm.userIds = [
          userList.value.find(item => item.username === newData.userName)?.id
        ];
      }
    }
  },
  { immediate: true, deep: true }
);

const resetForm = () => {
  detailForm.id = "";
  detailForm.month = props.formData?.month || "";
  detailForm.shopName = props.formData?.shopName || "";
  detailForm.brand = props.formData?.brand || "";
  detailForm.spu = props.formData?.spu || "";
  detailForm.taxedIncome = props.formData?.taxedIncome?.toString() || "";
  detailForm.grossProfit = props.formData?.grossProfit?.toString() || "";
  detailForm.userNames = [props.formData?.userName];
  detailForm.userIds = [props.formData?.userId];
  formRef.value?.clearValidate();
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (valid) {
      formLoading.value = true;
      try {
        // 数据格式化
        const temp = [];
        detailForm.userIds.forEach(item => {
          temp.push({
            id:
              userList.value.find(i => i.id === item)?.username ===
              props.formData?.userName
                ? detailForm.id
                : null,
            brand: detailForm.brand,
            shopName: detailForm.shopName,
            spu: detailForm.spu,
            taxedIncome: detailForm.taxedIncome,
            grossProfit: detailForm.grossProfit,
            userName: userList.value.find(i => i.id === item)?.username || "",
            userId: item,
            month: detailForm.month
          });
        });
        console.log("添加天猫收入数据:", detailForm, temp);

        // TODO: 调用添加API

        alert(JSON.stringify(temp));
        return;

        ElMessage.success("添加成功");
        handleClose();
        emit("success");
      } catch (error) {
        console.error("添加失败", error);
        ElMessage.error("添加失败");
      } finally {
        formLoading.value = false;
      }
    }
  });
};

const handleClose = () => {
  emit("update:modelValue", false);
  resetForm();
};
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="添加天猫收入数据"
    width="600px"
    :close-on-click-modal="false"
    append-to-body
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="detailForm"
      :rules="detailRules"
      label-width="120px"
    >
      <el-form-item label="月份">
        <el-input :value="detailForm.month" disabled />
      </el-form-item>
      <el-form-item label="店铺名称">
        <el-input :value="detailForm.shopName" disabled />
      </el-form-item>
      <el-form-item label="品牌">
        <el-input :value="detailForm.brand" disabled />
      </el-form-item>
      <el-form-item label="SPU">
        <el-input :value="detailForm.spu" disabled />
      </el-form-item>
      <el-form-item label="税后收入（元）">
        <el-input :value="detailForm.taxedIncome" disabled />
      </el-form-item>
      <el-form-item label="毛利（元）">
        <el-input :value="detailForm.grossProfit" disabled />
      </el-form-item>
      <el-form-item label="负责人" prop="userIds">
        <el-select
          v-model="detailForm.userIds"
          placeholder="请选择负责人"
          filterable
          multiple
        >
          <el-option
            v-for="item in userList"
            :key="item.id"
            :label="item.username"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="formLoading">
          确定
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
