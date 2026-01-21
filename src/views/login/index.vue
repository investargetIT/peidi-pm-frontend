<script setup lang="ts">
import { ref, reactive, toRaw, onMounted, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";

import { ElMessage, type FormInstance } from "element-plus";
import * as dd from "dingtalk-jsapi";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";
import Lock from "@iconify-icons/ri/lock-fill";
import User from "@iconify-icons/ri/user-3-fill";

import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useLayout } from "@/layout/hooks/useLayout";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

import Motion from "./utils/motion";
import { loginRules } from "./utils/rule";
import { bg, avatar, illustration } from "./utils/static";
import { DDUSERINFO } from "./utils/constants";
import { getUserInfo, register, registerMobile, getUserSite, getUserCheck } from "../../api/user";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD = "Aa123456";
const DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD_ENCRYPTED =
  "U2FsdGVkX1/pC5emPAlvIsXeST8WGcK7+inXwej0YG8cv7GwuSmwuubV2X2h0aZ6";

defineOptions({
  name: "Login"
});

initDingH5RemoteDebug();

const route = useRoute();
const router = useRouter();

const { initStorage } = useLayout();
initStorage();

const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);

const { title } = useNav();

const loading = ref(false);
const siteList = ref([
  // {
  //   label: "杭州",
  //   value: "hangzhou"
  // }
]);
const ruleForm = reactive({
  // username: "taijp@peidibrand.com",
  // password: "Aa123456"
  username: "",
  password: "",
  site: ""
});
const ruleFormRef = ref<FormInstance>();

const onLogin = async () => {
  loading.value = true;
  useUserStoreHook()
    .loginByUsername({
      username: ruleForm.username,
      password: DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD_ENCRYPTED,
    })
    .then((res: any) => {
      if (res.success) {

        return getUserCheck(res?.data)
          .then((res: any) => localStorage.setItem("user-check-info", JSON.stringify({ ...res?.data })))
          .catch((error: any) => {
            console.error('获取用户信息失败:', error)
            message("获取用户信息失败:" + error.message, { type: "error" })
          })
          .then(() => { return initRouterAndRedirect() });

        // 获取后端路由
        function initRouterAndRedirect() {
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
        }

      } else {
        message("登录失败:" + res?.msg, { type: "error" });
      }
    })
    .finally(() => (loading.value = false));
};

const ddLogin = () => {
  let ddUserEmail = "";
  dd.runtime.permission.requestAuthCode({
    corpId: DINGTALK_CORP_ID, // 企业id
    // @ts-ignore
    onSuccess: function (info) {
      // console.log("dingtalk login info:", info);
      const { code } = info;

      // 通过该免登授权码可以获取用户身份
      getUserInfo(code)
        .then((res: any) => {
          // console.log("dingtalk login getUserInfo res:", res);
          if (res.success) {
            const { data: ddUserInfo } = res;
            // console.log("ddUserInfo", ddUserInfo);
            // alert(JSON.stringify(ddUserInfo));
            localStorage.setItem("ddUserInfo", JSON.stringify(ddUserInfo));
            const { org_email, name, userid, mobile } = ddUserInfo;
            if (org_email) {
              // console.log("ddEmail", org_email);
              ddUserEmail = org_email;
              // 获取到钉钉用户企业邮箱，调用注册接口
              // ruleForm.username = `${ddUserEmail}&${mobile}`;
              ruleForm.username = `${ddUserEmail}`;
              ruleForm.password = DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD;

              return register({
                email: org_email,
                emailCode: "",
                password: DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD,
                username: name,
                dingId: userid,
                mobile: mobile
              });
            } else if (mobile) {
              // console.log("使用手机号注册，mobile:", mobile);
              ruleForm.username = `${mobile}`;
              ruleForm.password = DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD;

              // 使用手机号注册，添加标识
              return registerMobile({
                mobile,
                mobileCode: "",
                password: DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD,
                username: name,
                dingId: userid
              });
            } else {
              message(
                "获取钉钉用户邮箱和手机号都失败：" + JSON.stringify(res),
                {
                  type: "error"
                }
              );
            }
          } else {
            message("用户注册失败：" + JSON.stringify(res), { type: "error" });
          }
        })
        .then((res: any) => {
          if (res) {
            // 获取当前用户信息来判断注册类型
            const ddUserInfo = JSON.parse(
              localStorage.getItem("ddUserInfo") || "{}"
            );
            const isEmailRegistration = !!ddUserInfo.org_email;

            let registrationSuccess = false;

            if (isEmailRegistration) {
              // 邮箱注册的判断条件
              registrationSuccess =
                res.success ||
                (res.code === 100100002 &&
                  res.msg === "EMAIL_ACCOUNT_ALREADY_EXIST");
              // console.log("邮箱注册结果:", res);
            } else {
              // 手机号注册的判断条件
              registrationSuccess =
                res.success ||
                (res.code === 100100003 &&
                  res.msg === "PHONE_ACCOUNT_ALREADY_EXIST");
              // console.log("手机号注册结果:", res);
            }

            if (registrationSuccess) {
              // 注册成功，调用登录接口
              // console.log("注册成功，开始登录");
              onLogin();
            } else {
              const registrationType = isEmailRegistration ? "邮箱" : "手机号";
              message(`${registrationType}注册失败：` + JSON.stringify(res), {
                type: "error"
              });
            }
          }
        })
    },
    onFail: function (err) {
      // setErrMsg('获取钉钉免登授权码失败：' + JSON.stringify(err))
      message(JSON.stringify(err), { type: "error" });
    }
  });
};

ddLogin();

onMounted(() => {
  // 不在钉钉环境下，跳转到新登录页
  if (!navigator.userAgent.includes("DingTalk")) {
    window.location.href = `${window.location.origin}/#/login_`;
  }
});
</script>

<template>
  <div></div>
</template>
