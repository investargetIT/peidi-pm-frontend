import { http } from "@/utils/http";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export const baseUrlApi = (url: string) => {
  return `https://srm.peidigroup.cn${url}`;
};

const commonUrlApi = (url: string) => `${"https://user.peidigroup.cn"}${url}`;

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<UserResult>(
    "post",
    commonUrlApi("/user/login/password"),
    {
      data,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
};

// 获取jsapi的签名
export const getJsApi = params => {
  return http.request("get", commonUrlApi("/ding/jsapi"), {
    params
  });
};
// 根据code拿到个人信息
export const getUserInfo = code => {
  return http.request(
    "get",
    `https://user.peidigroup.cn/ding/userInfo?code=${code}`,
    {}
  );
};

// 注册
export const register = data => {
  return http.request(
    "post",
    `https://user.peidigroup.cn/user/email-register`,
    {
      data
    }
  );
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http.request<RefreshTokenResult>("post", "/refresh-token", { data });
};

// 获取所有分类
export const getAllCate = params => {
  return http.request("get", baseUrlApi("/category/all"), {
    params
  });
};

// 获取分页所有分类
export const getPageCate = params => {
  return http.request("get", baseUrlApi("/category/page"), {
    params
  });
};

// 添加新的分类
export const addCate = data => {
  return http.request("post", baseUrlApi("/category/new"), {
    data
  });
};

// 更改分类信息
export const updateCate = data => {
  return http.request("post", baseUrlApi("/category/update"), {
    data
  });
};

// 更改分类信息
export const deleteCate = data => {
  return http.request("post", baseUrlApi("/category/delete"), {
    data
  });
};

// 获取所有分类
export const getAllPd = params => {
  return http.request("get", baseUrlApi("/product/all"), {
    params
  });
};

// 获取分页所有分类
export const getPagePd = params => {
  return http.request("get", baseUrlApi("/product/page"), {
    params
  });
};

// 获取业务单元
