<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getploadTmallIncomeFinance, downloadFile } from "@/api/pmApi";
import UploadCard from "./components/uploadCard.vue";

const fileUrl = ref("");

const fetchTmallIncomeFinance = () => {
  getploadTmallIncomeFinance()
    .then((res: any) => {
      if (res.code === 200) {
        fileUrl.value = res.data;
      } else {
        ElMessage.error(res.msg || "获取文件失败");
      }
    })
    .catch(error => {
      ElMessage.error("获取文件失败:" + error.message);
    });
};

onMounted(() => {
  fetchTmallIncomeFinance();
});

const handleDownload = () => {
  downloadFile({
    objectName: fileUrl.value
  })
    .then((res: any) => {
      if (res.code === 200) {
        // ElMessage.success("下载成功");
        window.open(res.data, "_blank");
      } else {
        ElMessage.error(res.msg || "下载失败");
      }
    })
    .catch(error => {
      ElMessage.error("下载失败:" + error.message);
    });
};
</script>

<template>
  <div class="text-[14px]">
    <!-- 文件下载 -->
    <el-card shadow="never" style="border-radius: 10px; margin-bottom: 20px">
      <div>天猫分店铺spu毛利文件下载：</div>
      <div
        class="text-blue-500 cursor-pointer hover:underline"
        @click="handleDownload"
      >
        {{ fileUrl }}
      </div>
    </el-card>

    <!-- 文件上传 -->

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :md="6">
        <UploadCard
          title="线下渠道收款明细文件上传"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/offline"
          :successCallback="() => fetchTmallIncomeFinance()"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <UploadCard
          title="店铺考核数据文件上传"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/shopExamination"
          :successCallback="() => fetchTmallIncomeFinance()"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <UploadCard
          title="天猫分店铺spu毛利文件上传"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/tmallIncome"
          :successCallback="() => fetchTmallIncomeFinance()"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <UploadCard
          title="天猫分店铺spu毛利文件上传(财务上传)"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/tmallIncome-finance"
          :successCallback="() => fetchTmallIncomeFinance()"
        />
      </el-col>
    </el-row>
  </div>
</template>
