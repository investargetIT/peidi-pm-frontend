<script setup lang="ts">
import { onMounted } from 'vue';
import { initRouter, getTopMenu } from "@/router/utils";
import { useRoute, useRouter } from 'vue-router';
import { message } from "@/utils/message";
import { useUserStoreHook } from '../../store/modules/user';
import { storageLocal } from '@pureadmin/utils';
import { getUserCheck } from '../../api/user';

const route = useRoute()
const router = useRouter();

onMounted(() => {
  const userInfo = storageLocal().getItem("peidi-userInfo");
  console.log('userInfo', userInfo);
  if (userInfo) {
    useUserStoreHook()
      .loginByUsername({
        username: userInfo?.username,
        password: userInfo?.password,
        site: userInfo?.site
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
        }
      })
  } else {
    if (process.env.NODE_ENV === 'development') {
      // window.location.href = `http://localhost:8849/#/login?source=${window.location.href}`;
      window.location.href = `http://login.peidigroup.cn/#/login?source=${window.location.href}`;
    } else {
      window.location.href = `http://login.peidigroup.cn/#/login?source=${window.location.href}`;
    }
  }
})
</script>

<template>
  <div></div>
</template>
