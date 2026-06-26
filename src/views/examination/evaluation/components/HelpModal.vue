<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import { marked } from "marked";

interface Props {
  visible: boolean;
  module: string;
}

const props = defineProps<Props>();
const emit = defineEmits(["update:visible"]);

const contentRef = ref<HTMLElement | null>(null);
const headings = ref<{ id: string; text: string; level: number }[]>([]);
const hasHeadings = computed(() => headings.value.length > 0);

// 导入帮助文档
import organizationHelp from "./help/organization.md?raw";
import monthlyIndicatorsHelp from "./help/monthlyIndicators.md?raw";
import kpiMetricUserHelp from "./help/kpiMetricUser.md?raw";
import channelSalesSummaryHelp from "./help/channelSalesSummary.md?raw";

const helpDocs = {
  organization: organizationHelp,
  monthlyIndicators: monthlyIndicatorsHelp,
  kpiMetricUser: kpiMetricUserHelp,
  channelSalesSummary: channelSalesSummaryHelp
};

const moduleNames = {
  organization: "组织架构",
  monthlyIndicators: "月度指标",
  kpiMetricUser: "KPI指标用户",
  channelSalesSummary: "各渠道销售汇总"
};

const currentModuleName = computed(() => moduleNames[props.module as keyof typeof moduleNames] || "");
const helpContent = computed(() => {
  const content = helpDocs[props.module as keyof typeof helpDocs] || "暂无帮助文档";
  return marked(content);
});

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val)
});

// 解析标题生成目录
const parseHeadings = () => {
  nextTick(() => {
    if (!contentRef.value) return;

    const headingElements = contentRef.value.querySelectorAll("h2, h3");
    headings.value = Array.from(headingElements).map((el, index) => {
      const id = `heading-${index}`;
      el.id = id;
      return {
        id,
        text: el.textContent || "",
        level: parseInt(el.tagName.replace("H", ""))
      };
    });
  });
};

// 滚动到指定标题
const scrollToHeading = (id: string) => {
  const element = document.getElementById(id);
  if (element && contentRef.value) {
    contentRef.value.scrollTo({
      top: element.offsetTop - 20,
      behavior: "smooth"
    });
  }
};

// 监听弹窗打开，解析目录
watch(() => props.visible, (newVal) => {
  if (newVal) {
    nextTick(() => {
      parseHeadings();
    });
  }
});

// 监听模块变化，重新解析目录
watch(() => props.module, () => {
  if (props.visible) {
    nextTick(() => {
      parseHeadings();
    });
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="`${currentModuleName} - 使用帮助`"
    width="900px"
    :close-on-click-modal="false"
    class="help-dialog"
  >
    <div class="help-content-wrapper">
      <!-- 侧边目录 -->
      <div class="help-sidebar" v-if="hasHeadings">
        <div class="sidebar-title">目录导航</div>
        <div class="sidebar-content">
          <div
            v-for="(item, index) in headings"
            :key="index"
            class="sidebar-item"
            :class="`level-${item.level}`"
            @click="scrollToHeading(item.id)"
          >
            {{ item.text }}
          </div>
        </div>
      </div>

      <!-- 帮助内容 -->
      <div class="help-content" ref="contentRef" v-html="helpContent"></div>
    </div>
  </el-dialog>
</template>

<style scoped lang="scss">
.help-dialog {
  :deep(.el-dialog__header) {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px 24px;
    margin: 0;

    .el-dialog__title {
      color: white;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .el-dialog__headerbtn {
      top: 20px;

      .el-dialog__close {
        color: white;
        font-size: 20px;

        &:hover {
          color: #f0f0f0;
        }
      }
    }
  }

  :deep(.el-dialog__body) {
    padding: 0;
    max-height: 70vh;
  }
}

.help-content-wrapper {
  display: flex;
  height: 600px;
}

.help-sidebar {
  width: 200px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-right: 1px solid #e2e8f0;
  padding: 16px 0;
  overflow-y: auto;
  flex-shrink: 0;

  .sidebar-title {
    font-size: 13px;
    font-weight: 700;
    color: #475569;
    padding: 0 16px 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
  }

  .sidebar-content {
    padding: 8px 0;
  }

  .sidebar-item {
    padding: 8px 16px 8px 24px;
    font-size: 14px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    border-left: 3px solid transparent;

    &:hover {
      background: #e0f2fe;
      color: #0369a1;
    }

    &.level-2 {
      font-weight: 600;
      color: #334155;
      padding-left: 16px;
    }

    &.level-3 {
      padding-left: 32px;
      font-size: 13px;
    }
  }
}

.help-content {
  flex: 1;
  padding: 32px 40px;
  overflow-y: auto;
  line-height: 1.8;
  background: #ffffff;

  // 滚动条美化
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
  }

  :deep(h1) {
    font-size: 26px;
    font-weight: 800;
    margin-bottom: 8px;
    padding-bottom: 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    border-bottom: 2px solid #e2e8f0;
  }

  :deep(h2) {
    font-size: 20px;
    font-weight: 700;
    margin-top: 32px;
    margin-bottom: 16px;
    color: #1e293b;
    display: flex;
    align-items: center;

    &::before {
      content: "";
      width: 4px;
      height: 20px;
      background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
      border-radius: 2px;
      margin-right: 12px;
    }
  }

  :deep(h3) {
    font-size: 17px;
    font-weight: 600;
    margin-top: 24px;
    margin-bottom: 12px;
    color: #334155;
  }

  :deep(p) {
    margin-bottom: 16px;
    color: #475569;
    font-size: 15px;
  }

  :deep(ul), :deep(ol) {
    margin-left: 24px;
    margin-bottom: 16px;

    li {
      margin-bottom: 10px;
      color: #475569;
      font-size: 15px;
      position: relative;

      &::marker {
        color: #667eea;
      }
    }
  }

  :deep(code) {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    padding: 3px 8px;
    border-radius: 6px;
    font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
    color: #92400e;
    font-size: 14px;
    border: 1px solid #fcd34d;
  }

  :deep(pre) {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: #e2e8f0;
    padding: 20px;
    border-radius: 12px;
    overflow-x: auto;
    margin-bottom: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

    code {
      background: none;
      color: inherit;
      padding: 0;
      border: none;
    }
  }

  :deep(blockquote) {
    border-left: 4px solid #667eea;
    padding: 16px 20px;
    margin: 20px 0;
    color: #475569;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-radius: 0 10px 10px 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

    th, td {
      border: 1px solid #e2e8f0;
      padding: 14px 16px;
      text-align: left;
    }

    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: 0.3px;
    }

    td {
      color: #475569;
      background: #ffffff;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    tr:hover td {
      background: #f0f9ff;
    }
  }

  :deep(.warning) {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 16px 0;

    strong {
      color: #dc2626;
    }
  }
}
</style>
