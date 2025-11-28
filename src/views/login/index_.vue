<script setup lang="ts">
import { onMounted } from 'vue';
import { initRouter, getTopMenu } from "@/router/utils";
import { useRoute, useRouter } from 'vue-router';
import { message } from "@/utils/message";
import { useUserStoreHook } from '../../store/modules/user';
import { storageLocal } from '@pureadmin/utils';
import { getUserCheck } from '../../api/user';
import { decryptMessage, encryptMessage } from './utils/cryptojs';

const route = useRoute()
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
  // const userInfo = storageLocal().getItem("peidi-userInfo");
  let userInfo: { username: string; password: string; site?: string } | null =
    storageLocal().getItem("peidi-userInfo") || null;

  console.log("queryKey", queryKey);

  // 如果有记住密码的参数，就按照参数来处理
  if (queryKey.key3) {
    const isRemember = decryptMessage(queryKey.key3);
    console.log("isRemember", isRemember);
    if (isRemember === "true") {
      storageLocal().setItem("peidi-userInfo", {
        username: decryptMessage(queryKey.key1 || ""),
        password: decryptMessage(queryKey.key2 || ""),
        site: null
      });
    } else {
      storageLocal().removeItem("peidi-userInfo");
    }
  }

  // username and password
  if (queryKey.key1 && queryKey.key2) {
    const username = decryptMessage(queryKey.key1);
    const password = decryptMessage(queryKey.key2);
    userInfo = { username, password };
  }
  console.log('userInfo', userInfo);

  if (userInfo) {
    useUserStoreHook()
      .loginByUsername({
        username: userInfo?.username,
        password: userInfo?.password,
        site: userInfo?.site || null
      })
      .then((res) => {
        if (res.success) {

          getUserCheck(res?.data).then((res: any) =>
            localStorage.setItem(
              "ddUserInfo",
              JSON.stringify({
                userid: res?.data?.id,
                dept_id_list: [res?.data?.deptId]
              })
            )
          );

          // 获取后端路由
          const redirectPath = localStorage.getItem('redirectPath') || '/';
          if (redirectPath.includes('/examination')) {
            return initRouter().then(() => {
              router.push('/examination');
            });
          } else if (route.query.tabName == 'worker') {
            return initRouter().then(() => {
              router.push({ path: '/my/index', query: { tabName: 'worker' } });
            });

          } else {
            return initRouter().then(() => {
              router.push(getTopMenu(true).path).then(() => {
                message("登录成功", { type: "success" });
              });
            });
          }
        } else {
          message("登录失败", { type: "error" });
          window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
        }
      })
  } else {
    if (process.env.NODE_ENV === "development") {
      // window.location.href = `http://localhost:8848/#/login?source=${encryptMessage(window.location.href)}`;
      window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
    } else {
      window.location.href = `https://login.peidigroup.cn/#/login?source=${encryptMessage(window.location.href)}`;
    }
  }
})
</script>

<template>
  <div></div>
</template>
