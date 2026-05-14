<script lang="ts" setup>
import { ref, onMounted } from "vue";
import { getPmKpiTmallUserIncomePage, getUserListApi } from "@/api/evaluation";
import RiAddLine from "@iconify-icons/ri/add-line";
import dayjs from "dayjs";
import DetailDialog from "./detailDialog.vue";

interface RecordItem {
  id: number;
  month: string;
  shopName: string;
  brand: string;
  spu: string;
  taxedIncome: number;
  grossProfit: string;
  userName: string;
  userId: number | null;
}

interface ApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: RecordItem[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
}

const loading = ref(false);
const tableData = ref<RecordItem[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

const userList = ref<any[]>([]);
const dialogVisible = ref(false);
const currentRowData = ref<RecordItem | null>(null);

// 搜索条件
const searchParams = ref({
  brand: "",
  shopName: "",
  spu: "",
  userName: "",
  startDate: "",
  endDate: ""
});

const fetchUserList = async () => {
  try {
    const res = (await getUserListApi({ name: "" })) as any;
    if (res.success && res.data) {
      userList.value = res.data;
    }
  } catch (error) {
    console.error("获取用户列表失败", error);
  }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const res = (await getPmKpiTmallUserIncomePage({
      brand: searchParams.value.brand || undefined,
      shopName: searchParams.value.shopName || undefined,
      spu: searchParams.value.spu || undefined,
      userName: searchParams.value.userName || undefined,
      startDate: searchParams.value.startDate || undefined,
      endDate: searchParams.value.endDate || undefined,
      pageNo: currentPage.value,
      pageSize: pageSize.value
    })) as ApiResponse;
    if (res.success && res.data) {
      tableData.value = res.data.records;
      total.value = res.data.total;
    }
  } catch (error) {
    console.error("获取天猫收入数据失败", error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchData();
};

const handleReset = () => {
  searchParams.value = {
    brand: "",
    shopName: "",
    spu: "",
    userName: "",
    startDate: "",
    endDate: ""
  };
  currentPage.value = 1;
  fetchData();
};

const handleCurrentChange = (page: number) => {
  currentPage.value = page;
  fetchData();
};

const handleSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  fetchData();
};

// 格式化金额
const formatCurrency = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// 格式化月份
const formatMonth = (dateStr: string) => {
  if (!dateStr) return "-";
  return dayjs(dateStr).format("YYYY-MM");
};

// 根据毛利率正负返回样式
const getProfitClass = (value: string) => {
  const num = parseFloat(value);
  if (num > 0) return "profit-positive";
  if (num < 0) return "profit-negative";
  return "";
};

onMounted(() => {
  fetchUserList();
  fetchData();
});

const handleAdd = (row: RecordItem) => {
  currentRowData.value = row;
  dialogVisible.value = true;
};

const handleDialogSuccess = () => {
  fetchData();
};
</script>

<template>
  <div class="tmall-revenue-container">
    <!-- 搜索区域 -->
    <div class="search-section">
      <el-form :model="searchParams" inline size="default">
        <el-form-item label="店铺名称">
          <el-input
            v-model="searchParams.shopName"
            placeholder="请输入店铺名称"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="品牌">
          <el-input
            v-model="searchParams.brand"
            placeholder="请输入品牌"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="SPU">
          <el-input
            v-model="searchParams.spu"
            placeholder="请输入SPU"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input
            v-model="searchParams.userName"
            placeholder="请输入负责人"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="开始月份">
          <el-date-picker
            v-model="searchParams.startDate"
            type="month"
            placeholder="选择开始月份"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="结束月份">
          <el-date-picker
            v-model="searchParams.endDate"
            type="month"
            placeholder="选择结束月份"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 表格区域 -->
    <div class="table-section">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="month" label="月份" width="120" align="center">
          <template #default="{ row }">
            {{ formatMonth(row.month) }}
          </template>
        </el-table-column>
        <el-table-column prop="shopName" label="店铺名称" min-width="140" />
        <el-table-column prop="brand" label="品牌" min-width="120" />
        <el-table-column prop="spu" label="SPU" min-width="140" />
        <el-table-column
          prop="taxedIncome"
          label="税后收入（元）"
          width="160"
          align="right"
        >
          <template #default="{ row }">
            {{ formatCurrency(row.taxedIncome) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="grossProfit"
          label="毛利（元）"
          width="160"
          align="right"
        >
          <template #default="{ row }">
            <span :class="getProfitClass(row.grossProfit)">
              {{ formatCurrency(row.grossProfit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column
          prop="userName"
          label="负责人"
          width="100"
          align="center"
        />
        <el-table-column fixed="right" label="操作">
          <template #default="scope">
            <el-button
              link
              type="primary"
              size="small"
              @click="handleAdd(scope.row)"
            >
              <template #icon>
                <IconifyIconOffline :icon="RiAddLine" />
              </template>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <DetailDialog
      v-model="dialogVisible"
      :form-data="currentRowData || undefined"
      :user-list="userList"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<style scoped>
.tmall-revenue-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-section {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fff;
}

.search-section :deep(.el-form-item) {
  margin-bottom: 16px;
}

.search-section :deep(.el-form-item:last-child) {
  margin-bottom: 0;
  margin-left: 8px;
}

.table-section {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px;
  background: #fff;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.profit-positive {
  color: var(--el-color-success);
  font-weight: 500;
}

.profit-negative {
  color: var(--el-color-danger);
  font-weight: 500;
}
</style>
