<script setup lang="ts">
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { useNav } from "@/layout/hooks/useNav";
import { ElMessage, type FormInstance } from "element-plus";
import { useLayout } from "@/layout/hooks/useLayout";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { bg, avatar, illustration } from "./utils/static";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { ref, reactive, toRaw, onMounted, onBeforeUnmount } from "vue";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { initDingH5RemoteDebug } from "dingtalk-h5-remote-debug";
import { getUserInfo, register, registerMobile, getUserSite, getUserCheck } from "../../api/user";
import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import Lock from "@iconify-icons/ri/lock-fill";
import User from "@iconify-icons/ri/user-3-fill";
import * as dd from "dingtalk-jsapi";
import { useRoute } from 'vue-router'
import { DDUSERINFO } from "./utils/constants";
const route = useRoute()

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD = "Aa123456";
const DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD_ENCRYPTED =
  "U2FsdGVkX1/pC5emPAlvIsXeST8WGcK7+inXwej0YG8cv7GwuSmwuubV2X2h0aZ6";
defineOptions({
  name: "Login"
});
const router = useRouter();
const loading = ref(false);
const ruleFormRef = ref<FormInstance>();

const { initStorage } = useLayout();
initStorage();

const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title } = useNav();
initDingH5RemoteDebug();
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
const onLogin = async (formEl: FormInstance | undefined, isDingTalkLogin: boolean = true) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    // console.log(valid, fields, ruleForm); return;
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD_ENCRYPTED,
          site: ruleForm.site || null
        })
        .then(res => {
          if (res.success) {
            // if (!isDingTalkLogin) {
            //   getUserCheck(res?.data).then(res => localStorage.setItem("ddUserInfo", JSON.stringify({ userid: res?.data?.id, dept_id_list: [res?.data?.deptId] })))
            // }
            return getUserCheck(res?.data)
              .then(res => localStorage.setItem("user-check-info", JSON.stringify({ ...res?.data })))
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
            message("登录失败", { type: "error" });
          }
        })
        .finally(() => (loading.value = false));
    }
  });
};
const ddLogin = () => {
  let ddUserEmail = "";
  dd.runtime.permission.requestAuthCode({
    corpId: DINGTALK_CORP_ID, // 企业id
    onSuccess: function (info) {
      console.log(info);
      const { code } = info;

      // 通过该免登授权码可以获取用户身份
      getUserInfo(code)
        .then(res => {
          console.log(res);
          if (res.success) {
            const { data: ddUserInfo } = res;
            console.log("ddUserInfo", ddUserInfo);
            // alert(JSON.stringify(ddUserInfo));
            localStorage.setItem("ddUserInfo", JSON.stringify(ddUserInfo));
            const { org_email, name, userid, mobile } = ddUserInfo;
            if (org_email) {
              console.log("ddEmail", org_email);
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
              console.log("使用手机号注册，mobile:", mobile);
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
        .then(res => {
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
              console.log("邮箱注册结果:", res);
            } else {
              // 手机号注册的判断条件
              registrationSuccess =
                res.success ||
                (res.code === 100100003 &&
                  res.msg === "PHONE_ACCOUNT_ALREADY_EXIST");
              console.log("手机号注册结果:", res);
            }

            if (registrationSuccess) {
              // 注册成功，调用登录接口
              console.log("注册成功，开始登录");
              onLogin(ruleFormRef.value);
            } else {
              const registrationType = isEmailRegistration ? "邮箱" : "手机号";
              message(`${registrationType}注册失败：` + JSON.stringify(res), {
                type: "error"
              });
            }
          }
        })
        .then(res => {
          if (res) {
            if (res.success) {
              localStorage.setItem("token", res.data);
              // 登录成功，跳转到指定页面
              const urlParams = new URL(window.location.href).searchParams;
              window.location.href = urlParams.get("redirect") || "/";
            } else {
              setErrMsg("用户登录失败：" + JSON.stringify(res));
            }
          }
        });
    },
    onFail: function (err) {
      // setErrMsg('获取钉钉免登授权码失败：' + JSON.stringify(err))
      message(JSON.stringify(err), { type: "error" });
    }
  });
};

ddLogin();

/** 使用公共函数，避免`removeEventListener`失效 */
function onkeypress({ code }: KeyboardEvent) {
  if (["Enter", "NumpadEnter"].includes(code)) {
    onLogin(ruleFormRef.value, false);
  }
}

onMounted(() => {
  // 不在钉钉环境下，跳转到新登录页
  if (!navigator.userAgent.includes("DingTalk")) {
    window.location.href = `${window.location.origin}/#/login_`;
  }

  window.document.addEventListener("keypress", onkeypress);

  // 获取基地信息
  getUserSite().then(res => {
    if (res.success) {
      const { data } = res;
      console.log("siteList", data);
      siteList.value = data;
    }
  });
});

onBeforeUnmount(() => {
  window.document.removeEventListener("keypress", onkeypress);
});
</script>

<template>
  <div class="select-none" v-show="false">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch v-model="dataTheme" inline-prompt :active-icon="dayIcon" :inactive-icon="darkIcon"
        @change="dataThemeChange" />
    </div>
    <div class="login-container">
      <div class="img">
        <component :is="toRaw(illustration)" />
      </div>
      <div class="login-box">
        <div class="login-form">
          <!-- <avatar class="avatar" /> -->
          <Motion>
            <h2 class="outline-none">{{ title }}</h2>
          </Motion>

          <el-form ref="ruleFormRef" :model="ruleForm" :rules="loginRules" size="large">
            <Motion :delay="100">
              <el-form-item :rules="[
                {
                  required: true,
                  message: '请输入账号',
                  trigger: 'blur',
                },
              ]" prop="username">
                <el-input v-model="ruleForm.username" clearable placeholder="账号" :prefix-icon="useRenderIcon(User)" />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input v-model="ruleForm.password" clearable show-password placeholder="密码"
                  :prefix-icon="useRenderIcon(Lock)" />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="site">
                <el-select v-model="ruleForm.site" clearable placeholder="基地">
                  <template #prefix>
                    <el-icon size="14" style="margin-right: 2px">
                      <LocationFilled />
                    </el-icon>
                  </template>
                  <el-option v-for="item in siteList" :key="item.id" :label="item.siteName" :value="item.id" />
                </el-select>
              </el-form-item>
            </Motion>

            <Motion :delay="250">
              <el-button class="w-full mt-4" size="default" type="primary" :loading="loading"
                @click="onLogin(ruleFormRef, false)">
                登录
              </el-button>
            </Motion>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

:deep(.el-select__wrapper) {
  padding: 1px 15px;

  span {
    font-size: 14px;
  }
}
</style>
