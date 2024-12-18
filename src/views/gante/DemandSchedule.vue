<template>
  <div class="demand-schedule">
    <div class="header">
      <span>需求排期表</span>
      <el-select v-model="year" placeholder="2024年">
        <!-- 这里可以动态生成年份选项 -->
        <el-option label="2024年" value="2024"></el-option>
      </el-select>
      <el-select v-model="month" placeholder="12月">
        <!-- 这里可以动态生成月份选项 -->
        <el-option label="12月" value="12"></el-option>
      </el-select>
    </div>
    <div id="gantt-chart" style=" width: 1400px;height: 800px !important">
      <!-- 这里将放置dhtmlxGantt图表 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { gantt } from "dhtmlx-gantt";

import "dhtmlx-gantt/codebase/dhtmlxgantt.css";

const year = ref("2024");
const month = ref("12");
onMounted(() => {
  setTimeout(() => {
    console.log("ddddddd");

    gantt.config.xml_date = "%Y-%m-%d %H:%i";
    // gantt.config.autosize = false;
    gantt.init("gantt-chart");
    gantt.parse({
      data: [
        {
          id: 1,
          text: "Project #1",
          start_date: null,
          duration: null,
          parent: 0,
          progress: 0,
          open: true
        },
        {
          id: 2,
          text: "Task #1",
          start_date: "2019-07-01 00:00",
          duration: 5,
          parent: 1,
          progress: 1
        },
        {
          id: 3,
          text: "Task #2",
          start_date: "2019-08-06 00:00",
          duration: 2,
          parent: 1,
          progress: 0.5
        }
      ],
      links: []
    });
    gantt.attachEvent("onAfterTaskDrag", function (id, mode) {
      var task = gantt.getTask(id);
      if (mode == gantt.config.drag_mode.progress) {
        var pr = Math.floor(task.progress * 100 * 10) / 10;
        gantt.message(task.text + " is now " + pr + "% completed!");
      } else {
        var convert = gantt.date.date_to_str("%H:%i, %F %j");
        var s = convert(task.start_date);
        var e = convert(task.end_date);
        gantt.message(task.text + " starts at " + s + " and ends at " + e);
      }
    });
  }, 1000);
});
</script>

<style scoped>
.demand-schedule {
  width: 1400px;
}

.header {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  color: white;
  background-color: #007bff;
}
</style>
