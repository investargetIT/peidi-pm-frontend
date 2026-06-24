<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ReSegmented from "@/components/ReSegmented";
import Organization from "./components/organization/index.vue";
import TmallRevenue from "./components/tmallRevenue/index.vue";
import MonthlyIndicators from "./components/monthlyIndicators/index.vue";
import KpiMetricUser from "./components/kpiMetricUser/index.vue";
import ChannelSalesSummary from "./components/channelSalesSummary/index.vue";

const route = useRoute();
const router = useRouter();
const componentPermissionConfig = [
  { label: "组织架构", permissionKey: "organization", index: 0 },
  // { label: "天猫收入", permissionKey: "tmallRevenue", index: 1 },
  { label: "月度指标", permissionKey: "monthlyIndicators", index: 1 },
  { label: "KPI指标用户", permissionKey: "kpiMetricUser", index: 2 },
  { label: "各渠道销售汇总", permissionKey: "channelSalesSummary", index: 3 }
];

const DEVELOPER_USER_IDS = [
  "1846392647319093250", // Summer
  "1926449443739600965", // 沈皓钰
  "1850741012504838145", // 张思宇
  "1926449443739601629", // 杨世豪
  "1926449443739601538" // 王晓莹
];

const COMPONENT_PERMISSION_USER_IDS: Record<string, string[]> = {
  organization: [],
  // tmallRevenue: [],
  channelSalesSummary: [],
  monthlyIndicators: [
    "1870023775338692610", // 任琪琳
    "1874711258007646210", // 范振吉
    "1874730426438299649", // 付阳
    "1879443024278761474", // 邓苏
    "1874004550054621185", // 孙舒欣
    "1926449443739598911", // 梁钰
    "1896774351940268034", // 黄向前
    "1894225776978997250", // 张震西
    "1877650921123000321", // 周环寰
    "1874806470939815937", // 王小龙
    "1848656573381541890" // 方云
  ],
  kpiMetricUser: []
};

const getStoredIndex = (): number => {
  // 从路由参数获取
  const subTabFromQuery = route.query.subTab as string;
  if (subTabFromQuery) {
    const config = componentPermissionConfig.find(
      item => item.permissionKey === subTabFromQuery
    );
    if (config) {
      return config.index;
    }
  }
  return 0;
};

const getCurrentUserInfo = () => {
  try {
    const ddUserInfo = localStorage.getItem("user-check-info");
    if (!ddUserInfo) return null;

    return JSON.parse(ddUserInfo);
  } catch (error) {
    console.error("读取 ddUserInfo 失败:", error);
    return null;
  }
};

const getCurrentUserIds = (userInfo: any) => {
  return [userInfo?.userid, userInfo?.userId, userInfo?.id]
    .filter(Boolean)
    .map((id: string | number) => String(id).trim())
    .filter(Boolean);
};

const activeIndex = ref(getStoredIndex());
const permissionLoading = ref(true);
const componentPermissions = ref<boolean[]>(
  componentPermissionConfig.map(() => false)
);

const permittedComponents = computed(() =>
  componentPermissionConfig
    .map((item, index) => ({ ...item, index }))
    .filter(item => componentPermissions.value[item.index])
);

const options = computed(() =>
  permittedComponents.value.map(item => ({
    label: item.label
  }))
);

const segmentedIndex = computed({
  get: () => {
    const index = permittedComponents.value.findIndex(
      item => item.index === activeIndex.value
    );
    return index === -1 ? 0 : index;
  },
  set: (index: number) => {
    const component = permittedComponents.value[index];
    if (component) {
      activeIndex.value = component.index;
    }
  }
});

const hasCurrentPermission = computed(
  () => !!componentPermissions.value[activeIndex.value]
);

const hasAnyPermission = computed(() =>
  componentPermissions.value.some(hasPermission => hasPermission)
);

const setFirstPermittedComponent = () => {
  const firstPermittedIndex = componentPermissions.value.findIndex(Boolean);
  if (
    firstPermittedIndex !== -1 &&
    !componentPermissions.value[activeIndex.value]
  ) {
    activeIndex.value = firstPermittedIndex;
  }
};

const loadComponentPermissions = () => {
  permissionLoading.value = true;

  const currentUserInfo = getCurrentUserInfo();
  const currentUserIds = getCurrentUserIds(currentUserInfo);
  const isDeveloper = currentUserIds.some(userId =>
    DEVELOPER_USER_IDS.includes(userId)
  );

  if (isDeveloper) {
    componentPermissions.value = componentPermissionConfig.map(() => true);
  } else {
    componentPermissions.value = componentPermissionConfig.map(
      ({ permissionKey }) => {
        const permissionUserIdList =
          COMPONENT_PERMISSION_USER_IDS[permissionKey] || [];
        return currentUserIds.some(userId =>
          permissionUserIdList.includes(userId)
        );
      }
    );
  }

  setFirstPermittedComponent();
  permissionLoading.value = false;
};

watch(activeIndex, val => {
  // 更新路由参数
  const config = componentPermissionConfig.find(item => item.index === val);
  if (config) {
    router.replace({
      query: {
        ...route.query,
        subTab: config.permissionKey
      }
    });
  }
});

const handleChange = ({ index }: { index: number }) => {
  const component = permittedComponents.value[index];
  console.log("当前选中:", component?.index ?? index);
};

// 监听路由参数变化
watch(
  () => route.query.subTab,
  newSubTab => {
    if (newSubTab && typeof newSubTab === "string") {
      const config = componentPermissionConfig.find(
        item => item.permissionKey === newSubTab
      );
      if (config) {
        activeIndex.value = config.index;
      }
    } else if (!newSubTab) {
      activeIndex.value = 0;
    }
  }
);

onMounted(() => {
  loadComponentPermissions();
});
</script>

<template>
  <div class="evaluation-container">
    <!-- 使用 ReSegmented 组件 -->
    <ReSegmented
      v-if="!permissionLoading && hasAnyPermission"
      v-model="segmentedIndex"
      :options="options"
      block
      @change="handleChange"
    />

    <!-- 内容区域 -->
    <div class="content-area">
      <el-empty v-if="permissionLoading" description="权限加载中..." />
      <el-empty
        v-else-if="!hasAnyPermission"
        description="暂无可查看组件权限"
      />
      <el-empty v-else-if="!hasCurrentPermission" description="暂无权限" />
      <template v-else>
        <div v-if="activeIndex === 0">
          <Organization />
        </div>
        <div v-if="activeIndex === 1">
          <MonthlyIndicators />
        </div>
        <div v-if="activeIndex === 2">
          <KpiMetricUser />
        </div>
        <div v-if="activeIndex === 3">
          <ChannelSalesSummary />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.evaluation-container {
  // 您的外层自定义样式
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}

.content-area {
  margin-top: 20px;
  min-height: 300px;
}
</style>
