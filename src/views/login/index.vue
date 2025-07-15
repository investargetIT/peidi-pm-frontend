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
import { getUserInfo, register } from "../../api/user";
import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import Lock from "@iconify-icons/ri/lock-fill";
import User from "@iconify-icons/ri/user-3-fill";
import * as dd from "dingtalk-jsapi";
import { useRoute } from 'vue-router'
const route = useRoute()

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD = "Aa123456";
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
const ruleForm = reactive({
  // username: "taijp@peidibrand.com",
  // password: "Aa123456"
    username: "",
  password: ""
});
const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: ruleForm.password
        })
        .then(res => {
          if (res.success) {
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

            }else{
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
            const { org_email, name, userid } = ddUserInfo;
            if (org_email) {
              console.log("ddEmail", org_email);
              ddUserEmail = org_email;
              // 获取到钉钉用户企业邮箱，调用注册接口
              ruleForm.username = ddUserEmail;
              ruleForm.password = DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD;
              return register({
                email: org_email,
                emailCode: "",
                password: DINGTALK_LOGIN_FREE_DEFAULT_PASSWORD,
                username: name,
                dingId: userid
              });
            } else {
              message("获取钉钉用户企业邮箱失败：" + JSON.stringify(res), {
                type: "error"
              });
            }
          } else {
            message("用户注册失败：" + JSON.stringify(res), { type: "error" });
          }
        })
        .then(res => {
          if (res) {
            if (
              res.success ||
              (res.code === 100100002 &&
                res.msg === "EMAIL_ACCOUNT_ALREADY_EXIST")
            ) {
              // 注册成功，调用登录接口
              onLogin(ruleFormRef.value);
            } else {
              message("用户注册失败：" + JSON.stringify(res), {
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
    onLogin(ruleFormRef.value);
  }
}

onMounted(() => {
  window.document.addEventListener("keypress", onkeypress);
});

onBeforeUnmount(() => {
  window.document.removeEventListener("keypress", onkeypress);
});
</script>

<template>
  <div class="select-none">
    <img :src="bg" class="wave" />
    <div class="flex-c absolute right-5 top-3">
      <!-- 主题 -->
      <el-switch
        v-model="dataTheme"
        inline-prompt
        :active-icon="dayIcon"
        :inactive-icon="darkIcon"
        @change="dataThemeChange"
      />
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

          <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
          >
            <Motion :delay="100">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: '请输入账号',
                    trigger: 'blur'
                  }
                ]"
                prop="username"
              >
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder="账号"
                  :prefix-icon="useRenderIcon(User)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item prop="password">
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  show-password
                  placeholder="密码"
                  :prefix-icon="useRenderIcon(Lock)"
                />
              </el-form-item>
            </Motion>

            <Motion :delay="250">
              <el-button
                class="w-full mt-4"
                size="default"
                type="primary"
                :loading="loading"
                @click="onLogin(ruleFormRef)"
              >
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
</style>
