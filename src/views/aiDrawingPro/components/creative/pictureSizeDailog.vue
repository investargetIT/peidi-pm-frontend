<script setup lang="ts">
import { ElMessage } from "element-plus";
import { ref } from "vue";
import { downloadImageFromUrl } from "../../utils/general";

const SIZE_OPTIONS = [
  { label: "原图", value: "original", size: undefined },
  { label: "800 × 800", value: "800x800", size: { width: 800, height: 800 } }
];

const visible = ref(false);

const downloadSize = ref("original");
const pictureData = ref("");

const initDetail = (data: string) => {
  pictureData.value = data;
  downloadSize.value = "original";
  visible.value = true;
};

defineExpose({
  initDetail
});

const handleDownloadClick = () => {
  const msg = ElMessage({
    message: "图片下载中，请稍后...",
    duration: 0
  });
  // console.log("下载尺寸:", downloadSize.value);
  const selectedSize = SIZE_OPTIONS.find(
    item => item.value === downloadSize.value
  );
  console.log("选择尺寸:", selectedSize);

  downloadImageFromUrl(pictureData.value, undefined, selectedSize?.size)
    .then(() => {
      ElMessage.success("图片已下载");
      visible.value = false;
    })
    .catch(() => {
      ElMessage.error("图片下载失败");
    })
    .finally(() => msg.close());
};
</script>

<template>
  <div>
    <el-dialog
      v-model="visible"
      title="选择下载尺寸"
      width="500"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form>
        <el-form-item label="图片尺寸">
          <el-select v-model="downloadSize" placeholder="请选择图片尺寸">
            <el-option
              v-for="item in SIZE_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="handleDownloadClick"
            >确定</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>
