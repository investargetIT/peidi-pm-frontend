<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { getDrawRecordPage, getDrawRecordNew, uploadDraw } from "@/api/aiDraw";
import { ElMessage } from "element-plus";
import dayjs from "dayjs";
import OnlineImg from "../../common/onlineImg.vue";
import OnlineImgCompress from "../../common/onlineImgCompress.vue";
import { processImageCompression } from "../../utils/compressImage/index";
import { blobManager } from "../../utils/blobManager/index";
import { generateID } from "../../utils/general";

const currentPage = ref(1);
const pageSize = ref(9);
const total = ref(0);

const useNumberTime = dayjs().format("YYYY-MM");
const useNumber = ref(0);

const drawRecordList = ref<any[]>([]);

//#region 请求相关
const fetchDrawRecordPageForUseNumber = () => {
  getDrawRecordPage({
    pageNo: 1,
    pageSize: 1,
    searchStr: JSON.stringify([
      {
        searchName: "type",
        searchType: "like",
        searchValue: `\"useNumber\":\"${useNumberTime}\"`
      }
    ])
  })
    .then((res: any) => {
      if (res.code === 200) {
        useNumber.value = res.data.total;
      } else {
      }
    })
    .catch(err => {});
};

const fetchDrawRecordPage = () => {
  getDrawRecordPage({
    pageNo: currentPage.value,
    pageSize: pageSize.value,
    searchStr: JSON.stringify([
      {
        searchName: "type",
        searchType: "like",
        searchValue: `\"imgType\":\"Thumbnail\"`
      }
    ])
  })
    .then((res: any) => {
      if (res.code === 200) {
        // 如果当前页大于总页数，重置为最后一页 排除总页数为0的情况
        if (res.data?.current > res.data?.pages && res.data?.total !== 0) {
          currentPage.value = res.data?.pages;
          return;
        }

        // 更新总页数
        total.value = res.data?.total || 0;

        drawRecordList.value = res.data?.records || [];
      } else {
        ElMessage.error("获取历史记录失败:" + res?.msg);
      }
    })
    .catch(err => {
      ElMessage.error("获取历史记录失败:" + err.message);
    });
};

const fetchAddDrawRecord = ({ path, imgName, imgType, useNumber }) => {
  getDrawRecordNew({
    path,
    type: JSON.stringify({
      // imgType: "Original" | "Thumbnail"
      imgName,
      imgType,
      useNumber
    })
  })
    .then((res: any) => {
      if (res.code === 200) {
      } else {
      }
    })
    .catch(err => {});
};
//#endregion

watch(
  () => currentPage.value,
  () => {
    fetchDrawRecordPage();
  },
  {
    immediate: true
  }
);

onMounted(() => {
  fetchDrawRecordPageForUseNumber();
  // addDrawRecord(
  //   "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop",
  //   "test"
  // );
});

// 传入绝对路径地址 例"https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop"
const addDrawRecord = async (url: string, imgName: string) => {
  // 随机生成 ID
  const randomId = generateID();
  try {
    // 1. 直接使用 fetch 下载图片（支持外部 URL）
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `图片下载失败：${response.status} ${response.statusText}`
      );
    }

    const blob = await response.blob();

    // 2. 将 Blob 转换为 base64
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64_original = reader.result as string;

          // 3. 压缩图片生成缩略图
          const compressionResult = await processImageCompression(
            base64_original,
            url,
            0.5
          );

          const base64_thumbnail = compressionResult.compressedBase64;

          // 4. 将 base64 转换为 Blob
          const originalBlob = blobManager.base64ToBlob(base64_original);
          const thumbnailBlob = blobManager.base64ToBlob(base64_thumbnail);

          // 5. 创建 FormData 上传原图
          const originalFile = new File(
            [originalBlob],
            `${imgName}_${randomId}_original.png`,
            {
              type: "image/png"
            }
          );
          const originalFormData = new FormData();
          originalFormData.append("file", originalFile);

          // 6. 上传原图，得到返回的相对路径
          const originalRes: any = await uploadDraw(originalFormData);

          if (originalRes.code !== 200 || !originalRes.data) {
            throw new Error("原图上传失败");
          }
          const originalPath = originalRes.data;

          // 7. 创建 FormData 上传缩略图
          const thumbnailFile = new File(
            [thumbnailBlob],
            `${imgName}_${randomId}_thumbnail.png`,
            {
              type: "image/png"
            }
          );
          const thumbnailFormData = new FormData();
          thumbnailFormData.append("file", thumbnailFile);

          // 8. 上传缩略图，得到返回的相对路径
          const thumbnailRes: any = await uploadDraw(thumbnailFormData);

          if (thumbnailRes.code !== 200 || !thumbnailRes.data) {
            throw new Error("缩略图上传失败");
          }
          const thumbnailPath = thumbnailRes.data;

          // 9. 使用上传后得到的相对路径调用 fetchAddDrawRecord 添加记录
          await fetchAddDrawRecord({
            path: originalPath,
            imgName,
            imgType: "Original",
            useNumber: useNumberTime
          });

          await fetchAddDrawRecord({
            path: thumbnailPath,
            imgName,
            imgType: "Thumbnail",
            useNumber: useNumberTime
          });

          ElMessage.success("记录添加成功");
          resolve(true);
        } catch (error) {
          console.error("添加记录失败:", error);
          ElMessage.error("添加记录失败:" + error.message);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error("图片读取失败");
        ElMessage.error("图片读取失败");
        reject(error);
      };

      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("下载图片失败:", error);
    ElMessage.error("下载图片失败:" + error.message);
    throw error;
  }
};

// 判断本月是否已生成 100 条记录
const isMonthlyLimitReached = () => {
  return useNumber.value >= 100;
};

// 刷新列表
const updateData = () => {
  fetchDrawRecordPageForUseNumber();
  fetchDrawRecordPage();
};

defineExpose({
  addDrawRecord,
  isMonthlyLimitReached,
  updateData
});
</script>

<template>
  <div class="w-full h-full">
    <div class="flex items-center justify-between mb-[24px]">
      <h2 class="text-xl font-semibold text-[#0a0a0a]">历史记录</h2>
      <span class="text-xs text-gray-500">
        本月已生成 {{ useNumber }} / 100 条
      </span>
    </div>

    <div class="w-full">
      <el-space :size="16" wrap>
        <!-- <OnlineImg
          v-for="item in drawRecordList"
          :key="item?.id"
          :url="item?.path"
          size="120px"
        /> -->
        <OnlineImgCompress
          v-for="item in drawRecordList"
          :key="item?.id"
          :url="item?.path"
          size="120px"
        />
      </el-space>
    </div>

    <div class="mt-5 w-full flex justify-end">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 9]"
        :size="'small'"
        background
        layout="total, prev, pager, next"
        :total="total"
      />
    </div>
  </div>
</template>
