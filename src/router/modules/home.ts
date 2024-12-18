const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");
import cateIcon from "../../assets/png/cateIcon.png";
export default {
  path: "/",
  name: "Home",
  redirect: "/index",
  component: Layout,
  meta: {
    icon: "prime:box",
    title: "首页",
    rank: 0
  },
  children: [
    {
      path: "/index",
      name: "task",
      component: () => import("@/views/classify/index.vue"),
      meta: {
        title: "任务列表",
        showParent: false
      }
    }
  ]
} satisfies RouteConfigsTable;
