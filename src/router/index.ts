// import "@/utils/sso";
import Cookies from "js-cookie";
import { getConfig } from "@/config";
import NProgress from "@/utils/progress";
import { buildHierarchyTree } from "@/utils/tree";
import remainingRouter from "./modules/remaining";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { isUrl, openLink, storageLocal, isAllEmpty } from "@pureadmin/utils";
import {
  ascending,
  getTopMenu,
  initRouter,
  isOneOfArray,
  getHistoryMode,
  findRouteByPath,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes
} from "./utils";
import {
  type Router,
  createRouter,
  type RouteRecordRaw,
  type RouteComponent
} from "vue-router";
import {
  type DataInfo,
  userKey,
  removeToken,
  multipleTabsKey
} from "@/utils/auth";

import pdIcon from "../assets/png/prodIcon.png";
import priceIcon from "../assets/png/priceIcon.png";
import suplierIcon from "../assets/png/suplierIcon.png";

/** 自动导入全部静态路由，无需再手动引入！匹配 src/router/modules 目录（任何嵌套级别）中具有 .ts 扩展名的所有文件，除了 remaining.ts 文件
 * 如何匹配所有文件请看：https://github.com/mrmlnc/fast-glob#basic-syntax
 * 如何排除文件请看：https://cn.vitejs.dev/guide/features.html#negative-patterns
 */
const modules: Record<string, any> = import.meta.glob(
  ["./modules/**/*.ts", "!./modules/**/error.ts", "!./modules/**/remaining.ts"],
  {
    eager: true
  }
);
const Layout = () => import("@/layout/index.vue");

/** 原始静态路由（未做任何处理） */
const routes = [
  // {
  // path: "/classify",
  // name: "category",
  // component: () => import("@/views/classify/index.vue"),
  // meta: {
  //   title: "商品分类管理",
  // },
  //   children: [
  //   {
  //     path: "/fighting/index",
  //     name: "Fighting",
  //     component: () => import("@/views/fighting/index.vue"),
  //     meta: {
  //       title: "加油"
  //     }
  //   }
  // ]
  // },
  {
    path: "/addTasks",
    name: "addTasks",
    redirect: "/addTask/index",
    component: Layout,
    meta: {
      icon: "prime:book",
      title: "首页",
      rank: 21
    },
    children: [
      {
        path: "/addTask/index",
        name: "addTask",
        component: () => import("@/views/addTask/index.vue"),
        meta: {
          title: "添加任务",
          showParent: false
        }
      }
    ]
  },
  {
    path: "/my",
    name: "my",
    redirect: "/my/index",
    component: Layout,
    meta: {
      icon: "flowbite:address-book-outline",
      title: "",
      rank: 20
    },
    children: [
      {
        path: "/my/index",
        name: "my",
        component: () => import("@/views/my/index.vue"),
        meta: {
          title: "我的",
          showParent: false
        }
      }
    ]
  },
  {
    path: "/examination",
    name: "examination",
    component: () => import("@/views/examination/index.vue"),
    meta: {
      title: "考核页面",
      icon: "flowbite:address-book-outline",
      showParent: false,
      showLink: false 
    },
    
  },
    {
    path: '/demo',
    name: 'demo',
    component: () => import('@/views/demo/index.vue'),
    hidden: true,
    meta: {
      rank: 100,
showLink: false  // 方式4：自定义hideInMenu属性
    }
  }
  // {
  //   path: "/gante",
  //   name: "gante",
  //   redirect: "/gante/index",
  //   component: Layout,
  //   meta: {
  //     icon: "prime:book",
  //     title: "",
  //     rank: 0
  //   },
  //   children: [
  //     {
  //       path: "/gante/index",
  //       name: "gante",
  //       component: () => import("@/views/gante/index.vue"),
  //       meta: {
  //         title: "工时分配及汇总",
  //         showParent: false
  //       }
  //     }
  //   ]
  // }
  // {
  //   path: "/quota",
  //   name: "quota",
  //   redirect: "/quota/index",
  //   component: Layout,
  //   meta: {
  //     icon: "akar-icons:coin",
  //     title: "报价管理",
  //     rank: 0
  //   },
  //   children: [
  //     {
  //       path: "/quota/index",
  //       name: "quota",
  //       component: () => import("@/views/quota/index.vue"),
  //       meta: {
  //         title: "报价管理",
  //         showParent: false
  //       }
  //     }
  //   ]
  // },
  // {
  //   path: "/supplier",
  //   name: "supplier",
  //   redirect: "/supplier/index",
  //   component: Layout,
  //   meta: {
  //     icon: "flowbite:address-book-outline",
  //     title: "供应商管理",
  //     rank: 0
  //   },
  //   children: [
  //     {
  //       path: "/supplier/index",
  //       name: "supplier",
  //       component: () => import("@/views/supplier/index.vue"),
  //       meta: {
  //         title: "供应商管理",
  //         showParent: false,
  //         icon: "flowbite:address-book-outline"
  //       }
  //     }
  //   ]
  // }
];

Object.keys(modules).forEach(key => {
  routes.push(modules[key].default);
});

/** 导出处理后的静态路由（三级及以上的路由全部拍成二级） */
export const constantRoutes: Array<RouteRecordRaw> = formatTwoStageRoutes(
  formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
);

/** 用于渲染菜单，保持原始层级 */
export const constantMenus: Array<RouteComponent> = ascending(
  routes.flat(Infinity)
).concat(...remainingRouter);

/** 不参与菜单的路由 */
export const remainingPaths = Object.keys(remainingRouter).map(v => {
  return remainingRouter[v].path;
});

/** 创建路由实例 */
export const router: Router = createRouter({
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY),
  routes: constantRoutes.concat(...(remainingRouter as any)),
  strict: true,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(resolve => {
      if (savedPosition) {
        return savedPosition;
      } else {
        if (from.meta.saveSrollTop) {
          const top: number =
            document.documentElement.scrollTop || document.body.scrollTop;
          resolve({ left: 0, top });
        }
      }
    });
  }
});

/** 重置路由 */
export function resetRouter() {
  router.getRoutes().forEach(route => {
    const { name, meta } = route;
    if (name && router.hasRoute(name) && meta?.backstage) {
      router.removeRoute(name);
      router.options.routes = formatTwoStageRoutes(
        formatFlatteningRoutes(
          buildHierarchyTree(ascending(routes.flat(Infinity)))
        )
      );
    }
  });
  usePermissionStoreHook().clearAllCachePage();
}

/** 路由白名单 */
const whiteList = ["/login"];

const { VITE_HIDE_HOME } = import.meta.env;

router.beforeEach((to: ToRouteType, _from, next) => {
  if (to.meta?.keepAlive) {
    handleAliveRoute(to, "add");
    if (_from.name === undefined || _from.name === "Redirect") {
      handleAliveRoute(to);
    }
  }
  if (to.path === '/examination') {
    localStorage.setItem('redirectPath', to.fullPath);
  } else if (to.path !== '/login') {
    localStorage.removeItem('redirectPath');
  }
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  NProgress.start();
  const externalLink = isUrl(to?.name as string);
  if (!externalLink) {
    to.matched.some(item => {
      if (!item.meta.title) return "";
      const Title = getConfig().Title;
      if (Title) document.title = `${item.meta.title} | ${Title}`;
      else document.title = item.meta.title as string;
    });
  }
  function toCorrectRoute() {
    whiteList.includes(to.fullPath) ? next(_from.fullPath) : next();
  }
  if (Cookies.get(multipleTabsKey) && userInfo) {
    if (to.meta?.roles && !isOneOfArray(to.meta?.roles, userInfo?.roles)) {
      next({ path: "/error/403" });
    }
    if (VITE_HIDE_HOME === "true" && to.fullPath === "/classify") {
      next({ path: "/error/404" });
    }
    if (_from?.name) {
      // name为超链接
      if (externalLink) {
        openLink(to?.name as string);
        NProgress.done();
      } else {
        toCorrectRoute();
      }
    } else {
      // 刷新
      if (
        usePermissionStoreHook().wholeMenus.length === 0 &&
        to.path !== "/login"
      ) {
        initRouter().then((router: Router) => {
          if (!useMultiTagsStoreHook().getMultiTagsCache) {
            const { path } = to;
            const route = findRouteByPath(
              path,
              router.options.routes[0].children
            );
            getTopMenu(true);
            // query、params模式路由传参数的标签页不在此处处理
            if (route && route.meta?.title) {
              if (isAllEmpty(route.parentId) && route.meta?.backstage) {
                // 此处为动态顶级路由（目录）
                const { path, name, meta } = route.children[0];
                useMultiTagsStoreHook().handleTags("push", {
                  path,
                  name,
                  meta
                });
              } else {
                const { path, name, meta } = route;
                useMultiTagsStoreHook().handleTags("push", {
                  path,
                  name,
                  meta
                });
              }
            }
          }
          // 确保动态路由完全加入路由列表并且不影响静态路由（注意：动态路由刷新时router.beforeEach可能会触发两次，第一次触发动态路由还未完全添加，第二次动态路由才完全添加到路由列表，如果需要在router.beforeEach做一些判断可以在to.name存在的条件下去判断，这样就只会触发一次）
          if (isAllEmpty(to.name)) router.push(to.fullPath);
        });
      }
      toCorrectRoute();
    }
  } else {
    if (to.path !== "/login") {
      if (whiteList.indexOf(to.path) !== -1) {
        next();
      } else {
        removeToken();
        next({ path: "/login" });
      }
    } else {
      next();
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
