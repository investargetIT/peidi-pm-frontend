const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: "登录",
      showLink: false,
      rank: 101
    }
  },
  {
    path: "/redirect",
    component: Layout,
    meta: {
      title: "加载中...",
      showLink: false,
      rank: 102
    },
    children: [
      {
        path: "/redirect/:path(.*)",
        name: "Redirect",
        component: () => import("@/layout/redirect.vue")
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
      // showParent: false,
      showLink: false
    }
  }
] satisfies Array<RouteConfigsTable>;
