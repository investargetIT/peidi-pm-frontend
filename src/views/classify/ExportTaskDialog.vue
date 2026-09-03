<script setup lang="ts">
import { ref } from "vue";
import { getTaskPage, getOneTask } from "../../api/pmApi";
import { message, closeAllMessage } from "@/utils/message";
import { extractInfo } from "./utils";

// 读取当前钉钉登录用户
let ddUserInfo: any = localStorage.getItem("ddUserInfo");
if (ddUserInfo) {
  ddUserInfo = JSON.parse(ddUserInfo);
}

const emit = defineEmits(["close"]);

const dialogVisible = ref(true);
// 交付时间（期望完成时间）范围
const dateRange = ref<[string, string] | null>(null);

// 承接人固定为当前登录用户，不可修改
const currentUser = ref({
  name: ddUserInfo?.name || "",
  userId: ddUserInfo?.userid || ""
});

/** 组合人名字符串 */
const joinNames = (list: any[]) => {
  if (!list || !list.length) return "";
  return list
    .map((item: any) => item?.name || item?.userName || item?.userId || "")
    .filter(Boolean)
    .join("、");
};

/** 拼接任务描述里的工作记录 */
const formatWorkRecords = (records: any[]) => {
  if (!records || !records.length) return "";
  return records
    .map((r: any) => {
      const timeRange = r?.timeRange
        ? r.timeRange
        : r?.startTime
          ? `${r.startTime}至${r.endTime}`
          : "";
      return `${r?.workerName || ""} ${timeRange} ${r?.content || ""}`.trim();
    })
    .filter(Boolean)
    .join("；");
};

/** 拼接附件名 */
const formatAttachments = (attachments: any[]) => {
  if (!attachments || !attachments.length) return "";
  return attachments
    .map((a: any) => {
      const name = a?.name || a?.realFileName || a?.raw?.name || "";
      if (typeof name === "string") return name;
      return JSON.stringify(name);
    })
    .filter(Boolean)
    .join("、");
};

/** 导出列配置 */
const exportColumns = [
  { prop: "id", label: "任务ID", width: 16 },
  { prop: "title", label: "任务主题", width: 30 },
  { prop: "workContent", label: "工作内容", width: 30 },
  {
    prop: "taskTypeName",
    label: "任务类型",
    width: 15,
    format: (v: any) => (v ? String(v).split("&")[0] : "")
  },
  {
    prop: "workTypeName",
    label: "工作类型",
    width: 15,
    format: (v: any) => (v ? extractInfo(v).name : "")
  },
  { prop: "difficulty", label: "任务等级", width: 12 },
  { prop: "priorityName", label: "优先级", width: 12 },
  {
    prop: "contacters",
    label: "需求发起人",
    width: 20,
    format: (v: any) => joinNames(v)
  },
  {
    prop: "workers",
    label: "承接人",
    width: 20,
    format: (v: any) => joinNames(v)
  },
  { prop: "predictDuration", label: "预计工时", width: 12 },
  { prop: "expectEndDate", label: "交付时间", width: 18 },
  { prop: "statusName", label: "任务状态", width: 15 },
  { prop: "description", label: "任务描述", width: 40 },
  { prop: "createdAt", label: "创建时间", width: 18 },
  { prop: "updateAt", label: "更新时间", width: 18 },
  { prop: "closeDescriptionExt", label: "关闭原因", width: 25 },
  {
    prop: "workRecords",
    label: "工作记录",
    width: 60,
    format: (v: any) => formatWorkRecords(v)
  },
  {
    prop: "attachments",
    label: "文件附件",
    width: 40,
    format: (v: any) => formatAttachments(v)
  },
  {
    prop: "links",
    label: "关联链接",
    width: 30,
    format: (v: any) => (v && v.length ? v.join("、") : "")
  }
];

/** 导出核心逻辑 */
const handleExport = async () => {
  if (!dateRange.value || !dateRange.value.length) {
    message("请选择交付时间范围", { type: "warning" });
    return;
  }

  const [startDate, endDate] = dateRange.value;

  // 查询条件：交付时间范围 + 承接人=当前登录用户
  // 日期范围查询类型约定为 betweenStr，searchValue 传 "开始日期,结束日期"（逗号分隔字符串）
  const searchArr: any[] = [
    {
      searchName: "expectEndDate",
      searchType: "betweenStr",
      searchValue: `${startDate},${endDate}`
    },
    {
      searchName: "worker",
      searchType: "like",
      searchValue: currentUser.value.userId
    }
  ];

  message("正在查询并导出，请稍候...", {
    type: "info",
    duration: 0,
    showClose: true
  });

  try {
    // 1. 不分页拉取全部任务（循环翻页）
    let pageNo = 1;
    const pageSize = 100;
    let total = 0;
    let allRecords: any[] = [];

    do {
      const res: any = await getTaskPage({
        pageNo,
        pageSize,
        userId: currentUser.value.userId,
        searchStr: JSON.stringify(searchArr),
        sortStr: "[]"
      });
      if (res?.code !== 200) break;
      total = res?.data?.total || 0;
      const records = res?.data?.records || [];
      allRecords = allRecords.concat(records);
      pageNo++;
    } while (allRecords.length < total);

    if (!allRecords.length) {
      message("当前条件下没有任务数据", { type: "warning" });
      return;
    }

    // 2. 拉取每条任务的全量详情（含工作记录、附件、链接等）
    const detailList = await Promise.all(
      allRecords.map((task: any) =>
        getOneTask({ id: task.id })
          .then((res: any) => (res?.code === 200 ? res?.data : task))
          .catch(() => task)
      )
    );

    // 3. 动态引入导出工具，生成 Excel
    const { exportToExcel } = await import(
      "../examination/utils/export"
    );
    await exportToExcel(
      detailList,
      exportColumns,
      `任务导出_${currentUser.value.name}`,
      "任务列表"
    );

    closeAllMessage();
    message("任务导出成功", { type: "success" });
    emit("close");
  } catch (error) {
    console.error("导出失败:", error);
    closeAllMessage();
    message("导出失败，请重试", { type: "error" });
  }
};

const handleCancel = () => {
  emit("close");
};
</script>

<template>
  <el-dialog v-model="dialogVisible" title="导出任务" width="520" :close-on-click-modal="false" @close="handleCancel">
    <el-form label-width="90px">
      <el-form-item label="交付时间">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          format="YYYY/MM/DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="承接人">
        <el-tag type="info">{{ currentUser.name }}</el-tag>
        <span class="tip-text">（固定为当前登录用户，不可更改）</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button color="#171719" type="primary" @click="handleExport">
          导出
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip-text {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}
</style>
