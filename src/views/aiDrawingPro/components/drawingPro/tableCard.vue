<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  exportConfigToExcel,
  importConfigFromExcel
} from "./utils/exportConfigExcel";
import { el } from "element-plus/es/locale/index.mjs";

const props = defineProps({
  imageConfig: {
    type: Array<any>,
    required: true
  },
  imageName: {
    type: String,
    required: true
  }
});

// 存储导入的数据
const importedDataList = ref<Array<Record<string, any> & { _id: number }>>([]);

// 动态生成表头列
const tableColumns = computed(() => {
  const columns: Array<{
    prop: string;
    label: string;
    width?: number;
    type?: "text" | "image" | "aiRef";
  }> = [];

  let index = 0;
  props.imageConfig.forEach(item => {
    if (item.type === "text" && item.content) {
      item.content.forEach(field => {
        columns.push({
          prop: `${item.id}_${field.label}`,
          label: `${field.label}`,
          width: 150,
          type: "text"
        });
      });
    } else if (item.type === "image") {
      columns.push({
        prop: `${item.id}_image`,
        label: `${item.name}`,
        width: 200,
        type: "image"
      });
      columns.push({
        prop: `${item.id}_aiRef`,
        label: `AI 引用`,
        width: 100,
        type: "aiRef"
      });
    } else if (item.type === "group" && item.content) {
      item.content.forEach(field => {
        columns.push({
          prop: `${item.id}_${field.label}`,
          label: `${field.label}`,
          width: 150,
          type: "text"
        });
      });
    }
  });

  return columns;
});

const exportConfig = () => {
  console.log("imageConfig:", props.imageConfig, props.imageName);
  exportConfigToExcel(props.imageConfig, props.imageName);
};

// 导入配置
const importConfig = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls";
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    try {
      // 导入 Excel 数据
      const importedData = await importConfigFromExcel(file, props.imageConfig);

      ElMessageBox.confirm(
        `成功导入 ${importedData.length} 条配置数据，是否添加到列表？`,
        "导入确认",
        {
          confirmButtonText: "确定",
          cancelButtonText: "取消",
          type: "warning"
        }
      )
        .then(() => {
          // 为每行数据添加唯一 ID
          const dataWithId = importedData.map((data, index) => ({
            ...data,
            _id: Date.now() + index
          }));

          // 添加到列表中
          importedDataList.value = [...importedDataList.value, ...dataWithId];

          ElMessage.success(`导入成功，共 ${importedData.length} 条数据`);
        })
        .catch(() => {
          // 用户取消
        });
    } catch (error) {
      ElMessage.error("导入失败：" + (error as Error).message);
    }
  };

  input.click();
};

// 删除某行数据
const deleteRow = (index: number) => {
  ElMessageBox.confirm("确定要删除这行数据吗？", "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      importedDataList.value.splice(index, 1);
      ElMessage.success("删除成功");
    })
    .catch(() => {
      // 用户取消
    });
};

// 清空所有数据
const clearAll = () => {
  if (importedDataList.value.length === 0) {
    ElMessage.warning("暂无数据可清空");
    return;
  }

  ElMessageBox.confirm("确定要清空所有数据吗？", "清空确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      importedDataList.value = [];
      ElMessage.success("清空成功");
    })
    .catch(() => {
      // 用户取消
    });
};

// 单元格渲染
const renderCell = (row: Record<string, any>, column: any) => {
  const prop = column.property;
  const value = row[prop];

  // AI 引用列显示开关状态
  if (prop.endsWith("_aiRef")) {
    return value ? "是" : "否";
  }

  // 其他列直接显示值
  return value || "-";
};

// 清空所有数据
const closeClearAll = () => {
  importedDataList.value = [];
};

defineExpose({
  closeClearAll
});
</script>

<template>
  <div>
    <el-card shadow="never" style="border-radius: 10px">
      <div class="flex items-center justify-between mb-4">
        <div class="text-base font-bold text-gray-800">批量操作</div>
        <div class="flex items-center">
          <el-button color="#217346" size="small" @click="exportConfig">
            导出配置表
          </el-button>
          <el-button type="primary" size="small" @click="importConfig">
            导入配置表
          </el-button>
          <el-button
            type="danger"
            size="small"
            @click="clearAll"
            :disabled="importedDataList.length === 0"
          >
            清空全部
          </el-button>
          <el-button color="#534CE7" type="primary" size="small" @click="">
            ✨ 开始绘制
          </el-button>
        </div>
      </div>

      <div v-if="importedDataList.length > 0">
        <el-table
          :data="importedDataList"
          style="width: 100%"
          :header-cell-style="{
            background: '#f5f7fa',
            color: '#333',
            fontWeight: 'bold'
          }"
          :cell-style="{ padding: '8px 0' }"
          border
          :height="500"
          default-expand-all
        >
          <!-- 图片结果 -->
          <el-table-column type="expand" label="结果" width="60">
            <template #default="props">
              <div class="mx-5 my-1">
                <div class="mb-1 text-[#0a0a0a] font-bold">结果图片</div>
                <!-- <img
                  :src="'https://fuss10.elemecdn.com/e/5d/4a731a90594a4af544c0c25941171jpeg.jpeg'"
                  alt="图片"
                  :style="{
                    width: `${100}px`,
                    height: `${100}px`
                  }"
                  class="shadow-md cursor-pointer"
                /> -->
              </div>
            </template>
          </el-table-column>

          <!-- 序号列 -->
          <el-table-column
            type="index"
            label="序号"
            width="60"
            align="center"
          />

          <!-- 动态生成的列 -->
          <el-table-column
            v-for="col in tableColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            align="center"
          >
            <template #default="{ row }">
              <div v-html="renderCell(row, { property: col.prop })"></div>
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column
            label="操作"
            width="100"
            fixed="right"
            align="center"
          >
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="deleteRow($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-4 text-sm text-gray-600">
          共 {{ importedDataList.length }} 条数据
        </div>
      </div>

      <div
        v-else
        class="empty-data-tip"
        style="text-align: center; padding: 100px 0"
      >
        <el-empty description="暂无数据，请点击「导入配置表」添加数据" />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.empty-data-tip {
  color: #909399;
}
</style>
