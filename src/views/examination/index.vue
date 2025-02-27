<template>
  <div class="examination-list">
    <!-- 修改月份选择器 -->
    <el-select v-model="selectedMonth" placeholder="选择月份" @change="filterByMonth">
      <el-option
        v-for="month in months"
        :key="month.value"
        :label="month.label"
        :value="month.value"
      />
    </el-select>
    
    <el-table :data="filteredExamList" border style="width: 100%">
      <el-table-column prop="userName" label="姓名" />
      <el-table-column prop="month" label="月份" />
      <el-table-column label="部门">
        <template #default="{ row }">
          {{ getDepartmentName(row.department1, row.department2) }}
        </template>
      </el-table-column>
      <el-table-column prop="position" label="职位">
        <template #default="{ row }">
          {{ getPositionName(row.position) }}
        </template>
      </el-table-column>
      <el-table-column label="考核类型">
        <template #default="{ row }">
          {{ getExaminationType(row.examinationType) }}
        </template>
      </el-table-column>
      <el-table-column prop="target" label="目标值">
        <template #default="{ row }">
          <div v-if="row.isEditingTarget" class="edit-cell">
            <el-input
              v-model="row.target"
              type="number"
              step="0.01"
              @blur="handleSave(row, 'target')"
              v-focus
            />
          </div>
          <div v-else class="cell-content" @dblclick="handleEdit(row, 'target')">
            {{ row.target }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="achieved" label="完成值">
        <template #default="{ row }">
          <div v-if="row.isEditingAchieved" class="edit-cell">
            <el-input
              v-model="row.achieved"
              type="number"
              step="0.01"
              @blur="handleSave(row, 'achieved')"
              v-focus
            />
          </div>
          <div v-else class="cell-content" @dblclick="handleEdit(row, 'achieved')">
            {{ row.achieved }}
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getExaminationList, getModifyUser, updateExamination } from '@/api/pmApi.ts' // 添加 getModifyUser 和 updateExamination 导入
import { ElMessage } from 'element-plus'

const examList = ref([])
const selectedMonth = ref(null)
// 修改 months 数组，使其值与 examList 中的 month 属性的月份部分匹配
const months = ref([
  { label: '1月', value: '01' },
  { label: '2月', value: '02' },
  { label: '3月', value: '03' },
  { label: '4月', value: '04' },
  { label: '5月', value: '05' },
  { label: '6月', value: '06' },
  { label: '7月', value: '07' },
  { label: '8月', value: '08' },
  { label: '9月', value: '09' },
  { label: '10月', value: '10' },
  { label: '11月', value: '11' },
  { label: '12月', value: '12' }
])
const filteredExamList = ref([])

// 自定义指令：自动聚焦
const vFocus = {
  mounted: (el) => el.querySelector('input').focus()
}

// 获取考核列表数据
const fetchExamList = async () => {
  try {
    // 从 localStorage 获取 ddUserInfo
    const ddUserInfo = JSON.parse(localStorage.getItem('ddUserInfo') || '{}')
    const manageName = ddUserInfo.name
    // const manageName = '付阳'
    // const manageName = '范振吉'
    console.log('manageName', manageName);
    
    // 调用 getModifyUser 并打印结果
    const res1 = await getModifyUser({ manageName })
    const userResult = res1.data
    console.log('getModifyUser 返回结果：', userResult)

    const res = await getExaminationList({
      pageNo: 1,
      pageSize: 100
    })
    
    // 为每条数据添加编辑状态标记
    examList.value = res.data.records.map(item => ({
      ...item,
      isEditingTarget: false,
      isEditingAchieved: false
    }))

    // 过滤 examList，只保留在 userResult 中存在的 examinationTypeId
    // 如果examinationTypeId的值是'all'，则保留所有数据
    const filteredExamList = examList.value.filter(exam => 
      userResult.some(user => user.examinationTypeId == exam.examinationTypeId) || 
      user.examinationTypeId === 'all'
    );
    examList.value = filteredExamList
    console.log(filteredExamList);
  } catch (error) {
    console.error('获取数据失败：', error)
  }
}

// 获取部门名称（这里需要根据实际业务逻辑补充）
const getDepartmentName = (dept1, dept2) => {
  // 返回完整的部门名称
  return `${dept1}-${dept2}`
}

// 获取职位名称（这里需要根据实际业务逻辑补充）
const getPositionName = (position) => {
  // 返回职位名称
  return position
}

// 获取考核类型名称（这里需要根据实际业务逻辑补充）
const getExaminationType = (type) => {
  // 返回考核类型名称
  return type
}

// 处理编辑状态
const handleEdit = (row, field) => {
  if (field === 'target') {
    row.isEditingTarget = true
  } else {
    row.isEditingAchieved = true
  }
}

// 处理保存操作
const handleSave = async (row, field) => {
  try {
    // 构建完整的参数对象
    const updateData = {
      id: row.id,
      examinationTypeId: row.examinationTypeId,
      month: row.month,
      userId: row.userId,
      userName: row.userName,
      target: row.target,
      achieved: row.achieved
    }

    // 调用更新API
    const response = await updateExamination(updateData)
    
    // 检查返回的 code
    if (response.code === 200) {
      ElMessage.success('保存成功')
    } else {
      throw new Error('保存失败')
    }
  } catch (error) {
    console.error('保存失败：', error)
    ElMessage.error('保存失败')
  } finally {
    // 无论成功还是失败，都退出编辑状态
    if (field === 'target') {
      row.isEditingTarget = false
    } else {
      row.isEditingAchieved = false
    }
  }
}

// 过滤 examList 以匹配选定的月份
const filterByMonth = () => {
  if (selectedMonth.value !== null) {
    filteredExamList.value = examList.value.filter(exam => {
      const examMonth = exam.month.split('-')[1] // 提取月份部分
      return examMonth === selectedMonth.value
    })
  } else {
    filteredExamList.value = examList.value
  }
}

// 在获取数据后初始化过滤列表
onMounted(() => {
  // 获取当前月份并设置为默认选中
  const currentMonth = new Date().getMonth() + 1
  selectedMonth.value = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`

  fetchExamList().then(() => {
    filterByMonth() // 初始化时根据当前月份过滤
  })
})
</script>

<style scoped>
.examination-list {
  padding: 20px;
}

.cell-content {
  cursor: pointer;
  padding: 5px;
}

.cell-content:hover {
  background-color: #f5f7fa;
}

.edit-cell {
  padding: 5px;
}
</style>