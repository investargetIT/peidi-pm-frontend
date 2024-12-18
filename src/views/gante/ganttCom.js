import { gantt } from "dhtmlx-gantt"; // 引入模块
import { ref } from "vue";
import dayjs from "dayjs";

export const useGantt = () => {
  const ganttRef = ref();
  gantt.config.date_format = "%Y/%m/%d"; //整体格式
  gantt.config.duration_unit = "month"; //工期计算的基本单位
  gantt.config.scale_unit = "month"; //列间隔
  gantt.config.date_scale = "%Y/%m/%d"; //设置x轴的日期格式
  gantt.config.step = 1; //间隔
  gantt.i18n.setLocale("cn"); //中文
  gantt.config.autosize = true; //自适应尺寸
  gantt.config.autofit = true; // 表格列宽自适应
  gantt.config.open_tree_initially = true; // 默认是否展开树结构
  //只读模式
  gantt.config.readonly = true;
  // 显示网格
  gantt.config.show_grid = true;
  //更改树状的图标
  gantt.templates.grid_open = item => {
    return (
      " < div data - icon='" +
      (item.$open ? "close" : "open") +
      "' class='gantt_tree_icon gantt_" +
      (item.$open ? "close" : "open") +
      "'></div>"
    );
  };
  //更改父项图标
  gantt.templates.grid_folder = item => {
    return "";
  };
  //更改子项图标
  gantt.templates.grid_file = item => {
    return "";
  };
  // timeLine 文字
  gantt.templates.task_text = function (start, end, task) {
    if (task.real_end_date) {
      const sizes = gantt.getTaskPosition(
        task,
        task.start_date,
        new Date(dayjs(task.real_end_date).format("YYYY-MM-DD"))
      );
      return `
<div class="real-task" style="position:absolute;left:0px;top:0px;width:${sizes.width}px;height:100%"></div>`;
    }
    return "";
  };
  // 指定工单栏已完成部分的文本
  gantt.templates.progress_text = function (start, end, task) {
    const level = task.$level; //层级
    if (task.progress) {
      return `
<div style="text-align:right;color:#000;background-color:${adjustColor(
        " #04aac1",
        level * 20,
        0.7
      )}">${Math.round(task.progress * 100)}%</div>`;
    }
    return "";
  };
  // 列配置
  gantt.config.columns = [
    {
      name: "keyNode",
      resize: true,
      label: "关键节点",
      width: 200,
      align: "center",
      tree: true
    },
    {
      name: "receiver",
      resize: true,
      label: "签收人",
      width: 80,
      align: "center"
    }
  ];
  // 开启marker插件
  gantt.plugins({ marker: true, tooltip: true });
  const today = new Date(dayjs(new Date()).format("YYYY-MM-DD"));
  const dateToStr = gantt.date.date_to_str(gantt.config.task_date);
  // 添加固定时间线
  gantt.addMarker({
    start_date: today,
    css: "today",
    text: "今日:" + dayjs(new Date()).format("YYYY-MM-DD"),
    title: "Today: " + dateToStr(today)
  });
  // 提示框内容
  gantt.templates.tooltip_text = function (start, end, task) {
    return `
<h3>关键节点详情</h3>
<div class="pop-message"><span>关键节点</span><span>${
      task.keyNode ? task.keyNode : "暂无"
    }</span></div>
<div class="pop-message"><span>签收人</span><span>${
      task.receiver ? task.receiver : "暂无"
    }</span></div>
<div class="pop-message"><span>节点数量</span><span>${
      task.quantity
    }</span></div>
<div class="pop-message"><span>完成数量</span><span>${
      task.progressValue
    }</span></div>
<div class="pop-message"><span>复盘认识</span><span>${
      task.reflectionOnKnowledge ? task.reflectionOnKnowledge : "暂无"
    }</span></div>
<div class="pop-message"><span>复盘问题</span><span>${
      task.reflectionOnProblems ? task.reflectionOnProblems : "暂无"
    }</span></div>
<div class="pop-message"><span>复盘总结</span><span>${
      task.reflectionOnCountermeasures
        ? task.reflectionOnCountermeasures
        : "暂无"
    }</span></div>
`;
  };

  const init = (data, startDate, endDate) => {
    gantt.config.start_date = new Date(startDate);
    gantt.config.end_date = new Date(endDate);
    gantt.init(ganttRef.value);
    gantt.parse(data);
  };

  const refresh = (data, startDate, endDate) => {
    gantt.clearAll();
    gantt.config.start_date = new Date(startDate);
    gantt.config.end_date = new Date(endDate);
    gantt.parse(data);
    gantt.refreshData();
  };

  const destroyed = () => {
    gantt.clearAll();
  };

  return {
    init,
    refresh,
    ganttRef,
    destroyed
  };
};

function adjustColor(color, depth, alpha) {
  // 判断颜色格式
  const isRgb = color.length === 3 || color.length === 4;
  const isHex = /^#[0-9a-fA-F]{6}$/.test(color);

  if (!isRgb && !isHex) {
    throw new Error(
      "Invalid color format. Accepted formats: RGB (e.g., [255, 0, 0]) or Hex (e.g., #ff0000)"
    );
  }

  // 将RGB或十六进制颜色转为RGBA格式
  let rgbaColor;
  if (isRgb) {
    rgbaColor = [...color, alpha];
  } else if (isHex) {
    const rgbColor = hexToRgb(color);
    rgbaColor = [...rgbColor, alpha];
  }

  // 根据深浅值调整RGBA值
  rgbaColor = adjustColorValue(rgbaColor, depth);

  return `rgba(${rgbaColor[0]},${rgbaColor[1]},${rgbaColor[2]},${rgbaColor[3]})`;
}

// 十六进制转RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ]
    : null;
}

// 调整颜色深浅值和透明度
function adjustColorValue(rgba, depth) {
  return [
    Math.round(rgba[0] + depth) > 255 ? 255 : Math.round(rgba[0] + depth),
    Math.round(rgba[1] + depth) > 255 ? 255 : Math.round(rgba[1] + depth),
    Math.round(rgba[2] + depth) > 255 ? 255 : Math.round(rgba[2] + depth),
    rgba[3] // 保持透明度不变
  ];
}
