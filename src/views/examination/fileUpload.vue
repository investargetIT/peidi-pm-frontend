<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getUploadExaminationPath, downloadFile } from "@/api/pmApi";
import UploadCard from "./components/uploadCard.vue";

const props = defineProps({
  userId: {
    type: String,
    default: ""
  },
  DEV_ID: {
    type: Array,
    default: () => []
  }
});

const fileUrlList = ref([]);

const fetchUploadExaminationPath = () => {
  getUploadExaminationPath()
    .then((res: any) => {
      if (res.code === 200) {
        fileUrlList.value = res.data;
      } else {
        ElMessage.error(res.msg || "获取文件失败");
      }
    })
    .catch(error => {
      ElMessage.error("获取文件失败:" + error.message);
    });
};

onMounted(() => {
  fetchUploadExaminationPath();
});

const handleDownload = (objectName: string) => {
  console.log(props.userId);
  if (
    !objectName.includes("天猫分店铺spu毛利(财务上传)") &&
    !props.DEV_ID.includes(props.userId)
  ) {
    ElMessage.error("您没有权限下载文件");
    return;
  }
  downloadFile({
    objectName: objectName
  })
    .then((res: any) => {
      // blob下载
      const url = window.URL.createObjectURL(new Blob([res]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", objectName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    })
    .catch(error => {
      ElMessage.error("下载失败:" + error.message);
    });
};
</script>

<style lang="scss" scoped>
.file-upload-container {
  font-size: 14px;

  @media (max-width: 768px) {
    font-size: 13px;
  }
}

.download-card {
  border-radius: 10px;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    margin-bottom: 16px;
  }
}

.card-title {
  margin-bottom: 12px;
  font-weight: 500;
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.file-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 768px) {
    padding: 10px 0;
  }
}

.download-link {
  color: #409eff;
  cursor: pointer;
  word-break: break-all;

  &:hover {
    text-decoration: underline;
  }
}

.file-name {
  word-break: break-all;
  color: #606266;
}

.upload-grid {
  @media (max-width: 768px) {
    :deep(.el-col) {
      margin-bottom: 12px;
    }
  }
}
</style>

<template>
  <div class="file-upload-container">
    <!-- 文件下载 -->
    <el-card shadow="never" class="download-card">
      <div class="card-title">文件列表：</div>
      <ul class="file-list">
        <li v-for="(item, index) in fileUrlList" :key="index" class="file-item">
          <span
            v-if="
              item.includes('天猫分店铺spu毛利(财务上传)') ||
              props.DEV_ID.includes(props.userId)
            "
            class="download-link"
            @click="handleDownload(item)"
          >
            {{ item }}
          </span>
          <span v-else class="file-name">
            {{ item }}
          </span>
        </li>
      </ul>
    </el-card>

    <!-- 文件上传 -->
    <el-row :gutter="16" class="upload-grid">
      <el-col :xs="24" :sm="12" :md="12">
        <UploadCard
          idx="1"
          title="天猫分店铺spu毛利文件上传(财务上传)"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/tmallIncome-finance"
          :successCallback="() => fetchUploadExaminationPath()"
          :disabled="
            props.userId !== '1848656573381541890' &&
            !props.DEV_ID.includes(props.userId)
          "
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="12">
        <UploadCard
          idx="2"
          title="店铺考核数据文件上传(财务上传)"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/shopExamination"
          :successCallback="() => fetchUploadExaminationPath()"
          :disabled="
            props.userId !== '1848656573381541890' &&
            !props.DEV_ID.includes(props.userId)
          "
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="12">
        <UploadCard
          idx="3"
          title="线下渠道收款明细文件上传(财务上传)"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/offline"
          :successCallback="() => fetchUploadExaminationPath()"
          :disabled="
            props.userId !== '1848656573381541890' &&
            !props.DEV_ID.includes(props.userId)
          "
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="12">
        <UploadCard
          idx="4"
          title="天猫分店铺spu毛利文件上传(天猫上传)"
          requestUrl="https://api.peidigroup.cn/pm/kpi-examination/upload/tmallIncome"
          :successCallback="() => fetchUploadExaminationPath()"
          :disabled="
            props.userId !== '1874711258007646210' &&
            !props.DEV_ID.includes(props.userId)
          "
        />
      </el-col>
    </el-row>
  </div>
</template>
