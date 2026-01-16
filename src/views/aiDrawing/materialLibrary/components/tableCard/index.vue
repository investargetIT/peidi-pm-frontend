<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, Close, Delete, Edit } from "@element-plus/icons-vue";
import OnlineImage from "../../../excelTable/components/onlineImage/index.vue";
import DevUpLoad from "../../../dev/components/devUpLoad.vue";

const props = defineProps({
  tab: {
    type: Object,
    required: true
  }
});

// 定义素材库表格数据类型
interface MaterialLibraryItem {
  picture: string[];
  name: string;
  cGift: string;
  cTemplate: string;
  cActivityLogo: string;
  cShopLogo: string;
  cBrandLogo: string;
}

// 默认数据
const MATERIAL_LIBRARY_ITEM_DEFAULT: MaterialLibraryItem = {
  picture: [],
  name: "",
  cGift: "",
  cTemplate: "",
  cActivityLogo: "",
  cShopLogo: "",
  cBrandLogo: ""
};

const tableData = ref<MaterialLibraryItem[]>([
  {
    picture: ["ai/draw/grsai/c10b8dc1-499b-4d9e-ad5e-c3d756c699df.png"],
    name: "商品图片.png",
    cGift: "0",
    cTemplate: "0",
    cActivityLogo: "0",
    cShopLogo: "0",
    cBrandLogo: "0"
  }
]);

const searchText = ref("");
const currentPage = ref(1);
const pageSize = ref(5);

// 编辑状态管理
const editingRowIndex = ref<number | null>(null);
const editingRowData = ref<MaterialLibraryItem | null>(null);

// 添加行
const handleAddRow = () => {
  const newData = [...tableData.value];
  newData.unshift({
    ...MATERIAL_LIBRARY_ITEM_DEFAULT
  });
  tableData.value = newData;
  handleEditRow(0);
};

// 编辑行
const handleEditRow = (index: number) => {
  editingRowIndex.value = index;
  editingRowData.value = JSON.parse(JSON.stringify(tableData.value[index]));
};

// 保存行
const handleSaveRow = (index: number) => {
  console.log("editingRowData.value", editingRowData.value);
  // 如果当前编辑的行没有图片或者没有名字，就代表是新增的行，必须填写图片和名称
  if (editingRowData.value.picture.length === 0 || !editingRowData.value.name) {
    ElMessage.warning("新增素材必须有图片和名称");
    return;
  }

  if (editingRowData.value) {
    const newData = [...tableData.value];
    newData[index] = editingRowData.value;
    tableData.value = newData;
    editingRowIndex.value = null;
    editingRowData.value = null;
  }
};

// 取消编辑
const handleCancelEdit = () => {
  // 如果当前编辑的行没有图片或者没有名字，就代表是新增的行，点击取消后删除当前行
  if (editingRowData.value.picture.length === 0 && !editingRowData.value.name) {
    tableData.value.splice(0, 1);
  }

  editingRowIndex.value = null;
  editingRowData.value = null;
};

// 删除行
const handleDeleteRow = (index: number) => {
  ElMessageBox.confirm("确认删除吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      const newData = [...tableData.value];
      newData.splice(index, 1);
      tableData.value = newData;

      if (editingRowIndex.value === index) {
        editingRowIndex.value = null;
        editingRowData.value = null;
      } else if (
        editingRowIndex.value !== null &&
        editingRowIndex.value > index
      ) {
        editingRowIndex.value--;
      }
    })
    .catch(() => {
      // 取消删除
    });
};
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-[12px]">
      <div>
        <el-input v-model="searchText" placeholder="搜索名称" />
      </div>
      <div>
        <el-button
          type="primary"
          @click="handleAddRow"
          :disabled="editingRowIndex !== null"
        >
          + 添加数据
        </el-button>
      </div>
    </div>

    <el-table
      :data="tableData"
      style="width: 100%"
      size="small"
      border
      row-key="name"
    >
      <!-- 图片列 -->
      <el-table-column prop="picture" label="图片" width="100">
        <template #default="{ row, $index }">
          <template
            v-if="editingRowIndex === $index && row.picture.length === 0"
          >
            <!-- 新增行：可以上传图片 -->
            <DevUpLoad v-model="editingRowData!.picture" :limit="1" />
          </template>
          <template v-else>
            <OnlineImage :url="row.picture[0]" />
          </template>
        </template>
      </el-table-column>

      <!-- 名称列 -->
      <el-table-column prop="name" label="名称" width="180">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <!-- 新增行：可以编辑名称 -->
            <template v-if="!row.name">
              <el-input
                v-model="editingRowData!.name"
                placeholder="请输入名称"
                size="small"
              />
            </template>
            <!-- 编辑现有行：只显示名称，不能编辑 -->
            <template v-else>
              {{ row.name }}
            </template>
          </template>
          <template v-else>
            {{ row.name }}
          </template>
        </template>
      </el-table-column>

      <!-- 关联赠品列 -->
      <el-table-column prop="cGift" label="关联赠品">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-select v-model="editingRowData!.cGift" placeholder="请选择">
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </template>
          <template v-else>
            {{ row.cGift }}
          </template>
        </template>
      </el-table-column>

      <!-- 关联模板列 -->
      <el-table-column prop="cTemplate" label="关联模板">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-select v-model="editingRowData!.cTemplate" placeholder="请选择">
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </template>
          <template v-else>
            {{ row.cTemplate }}
          </template>
        </template>
      </el-table-column>

      <!-- 关联活动LOGO列 -->
      <el-table-column prop="cActivityLogo" label="关联活动LOGO">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-select
              v-model="editingRowData!.cActivityLogo"
              placeholder="请选择"
            >
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </template>
          <template v-else>
            {{ row.cActivityLogo }}
          </template>
        </template>
      </el-table-column>

      <!-- 关联店铺LOGO列 -->
      <el-table-column prop="cShopLogo" label="关联店铺LOGO">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-select v-model="editingRowData!.cShopLogo" placeholder="请选择">
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </template>
          <template v-else>
            {{ row.cShopLogo }}
          </template>
        </template>
      </el-table-column>

      <!-- 关联品牌LOGO列 -->
      <el-table-column prop="cBrandLogo" label="关联品牌LOGO">
        <template #default="{ row, $index }">
          <template v-if="editingRowIndex === $index">
            <el-select
              v-model="editingRowData!.cBrandLogo"
              placeholder="请选择"
            >
              <el-option label="是" value="1" />
              <el-option label="否" value="0" />
            </el-select>
          </template>
          <template v-else>
            {{ row.cBrandLogo }}
          </template>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ $index }">
          <template v-if="editingRowIndex === $index">
            <el-button
              type="primary"
              size="small"
              @click="handleSaveRow($index)"
              :icon="Check"
              text
            >
              保存
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleCancelEdit"
              :icon="Close"
              text
            >
              取消
            </el-button>
          </template>
          <template v-else>
            <el-button
              type="primary"
              size="small"
              @click="handleEditRow($index)"
              :disabled="editingRowIndex !== null"
              :icon="Edit"
              text
            >
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDeleteRow($index)"
              :disabled="editingRowIndex !== null"
              :icon="Delete"
              text
            >
              删除
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <div class="flex justify-end mt-[12px]">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        size="small"
        background
        layout="total, prev, pager, next"
        :total="tableData.length"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
