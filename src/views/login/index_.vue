<script setup lang="ts">
import { onMounted } from "vue";
import { initRouter, getTopMenu } from "@/router/utils";
import { useRoute, useRouter } from "vue-router";
import { message } from "@/utils/message";
import { useUserStoreHook } from "../../store/modules/user";
import { storageLocal } from "@pureadmin/utils";
import { getUserCheck } from "../../api/user";
import { decryptMessage, encryptMessage } from "./utils/cryptojs";

const route = useRoute();
const router = useRouter();

const getKeyFromUrl = () => {
  const url = window.location.href;
  const key1Match = url.match(/key1=([^&]+)/);
  const key2Match = url.match(/key2=([^&]+)/);
  const key3Match = url.match(/key3=([^&]+)/);
  const key1 = key1Match ? key1Match[1] : null;
  const key2 = key2Match ? key2Match[1] : null;
  const key3 = key3Match ? key3Match[1] : null;
  console.log("key1", key1);
  console.log("key2", key2);
  console.log("key3", key3);
  return { key1, key2, key3 };
};
const queryKey = getKeyFromUrl();

onMounted(() => {
  const stored = storageLocal().getItem<{
    username?: string;
    password?: string;
    site?: string;
  }>("peidi-userInfo");
  // 结构不完整（脏数据 / 存了空账号密码）一律视为没记住
  let userInfo: { username: string; password: string; site?: string } | null =
    stored?.username && stored?.password
      ? {
          username: stored.username,
          password: stored.password,
          site: stored.site
        }
      : null;

  console.log("queryKey", queryKey);

  // 门户勾选「记住我」：落盘账号密码；取消勾选：清除
  if (queryKey.key3) {
    const isRemember = decryptMessage(queryKey.key3);
    console.log("isRemember", isRemember);
    const rememberedUsername = decryptMessage(queryKey.key1 || "");
    const rememberedPassword = decryptMessage(queryKey.key2 || "");
    if (isRemember === "true" && rememberedUsername && rememberedPassword) {
      storageLocal().setItem("peidi-userInfo", {
        username: rememberedUsername,
        password: rememberedPassword,
        site: null
      });
    } else {
      storageLocal().removeItem("peidi-userInfo");
    }
  }

  // 本次登录用的是不是「记住的密码」（URL 没带账号密码时才成立）
  const fromRemembered = !(queryKey.key1 && queryKey.key2);

  // username and password
  if (queryKey.key1 && queryKey.key2) {
    const username = decryptMessage(queryKey.key1);
    const password = decryptMessage(queryKey.key2);
    userInfo = { username, password };
    // 门户没带 key3：若和记住的账号不是同一个，清掉旧凭据，避免下次静默登录成上一个用户
    if (!queryKey.key3) {
      const remembered = storageLocal().getItem<{ username?: string }>(
        "peidi-userInfo"
      );
      if (remembered && remembered.username !== username) {
        storageLocal().removeItem("peidi-userInfo");
      }
    }
  }

  if (userInfo) {
    useUserStoreHook()
      .loginByUsername({
        username: userInfo?.username,
        password: userInfo?.password,
        site: userInfo?.site || null
      })
      .then(res => {
        if (res.success) {
          return getUserCheck(res?.data)
            .then((res: any) => {
              // 模拟出Web端的ddUserInfo对象
              localStorage.setItem(
                "ddUserInfo",
                JSON.stringify({
                  ...res?.data,
                  userid: res?.data?.id,
                  dept_id_list: [res?.data?.deptId],
                  name: res?.data?.username
                })
              );
              // 需要有个新的对象来存储userCheckInfo
              localStorage.setItem(
                "user-check-info",
                JSON.stringify({
                  ...res?.data
                })
              );
            })
            .catch((error: any) => {
              console.error("获取用户信息失败:", error);
              message("获取用户信息失败:" + error.message, { type: "error" });
            })
            .then(() => {
              return initRouterAndRedirect();
            });

          // 获取后端路由
          function initRouterAndRedirect() {
            const redirectPath = localStorage.getItem("redirectPath") || "/";
            if (redirectPath.includes("/examination")) {
              return initRouter().then(() => {
                // 解析原始路径的 query 参数，加上 firstLogin 标记
                const redirectUrl = new URL(redirectPath, window.location.origin);
                const query: Record<string, string> = {};
                redirectUrl.searchParams.forEach((value, key) => {
                  query[key] = value;
                });
                query.firstLogin = "true";
                router.push({
                  path: "/examination",
                  query
                });
              });
            } else if (redirectPath.includes("/aiDrawingApp")) {
              return initRouter().then(() => {
                // 解析原始路径的 query 参数，加上 firstLogin 标记
                const redirectUrl = new URL(redirectPath, window.location.origin);
                const query: Record<string, string> = {};
                redirectUrl.searchParams.forEach((value, key) => {
                  query[key] = value;
                });
                query.firstLogin = "true";
                router.push({
                  path: "/aiDrawingApp",
                  query
                });
              });
            } else if (redirectPath.includes("/workHoursBoard")) {
              return initRouter().then(() => {
                // 解析原始路径的 query 参数，加上 firstLogin 标记
                const redirectUrl = new URL(redirectPath, window.location.origin);
                const query: Record<string, string> = {};
                redirectUrl.searchParams.forEach((value, key) => {
                  query[key] = value;
                });
                query.firstLogin = "true";
                router.push({
                  path: "/workHoursBoard",
                  query
                });
              });
            } else if (route.query.tabName == "worker") {
              return initRouter().then(() => {
                router.push({
                  path: "/my/index",
                  query: { tabName: "worker" }
                });
              });
            } else {
              return initRouter().then(() => {
                router.push(getTopMenu(true).path).then(() => {
                  message("登录成功", { type: "success" });
                });
              });
            }
          }
        } else {
          message("登录失败", { type: "error" });
          // 记住的密码已失效（改密 / 账号被禁用等）：先清掉，避免每次打开都拿废凭据失败一次
          if (fromRemembered) {
            storageLocal().removeItem("peidi-userInfo");
          }
          window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
        }
      });
  } else {
    if (process.env.NODE_ENV === "development") {
      // window.location.href = `http://localhost:8848/#/login?source=${encryptMessage(window.location.href)}`;
      window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
    } else {
      window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
    }
  }
});
</script>

<template>
  <div></div>
</template>
