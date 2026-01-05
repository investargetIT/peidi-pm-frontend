/**
 * localStorage 配置常量
 * 开发环境文档记录
 */

export const STORAGE_KEYS = {
  DD_USER_INFO: "ddUserInfo",
  PEIDI_UNIQUE_ID: "peidi-uniqueId",
  USER_CHECK_INFO: "user-check-info",
  WORKER_EX_ENUM: "workerExEnum"
} as const;

export const STORAGE_DESCRIPTIONS = {
  [STORAGE_KEYS.DD_USER_INFO]:
    "dingtalk-jsapi插件得到的钉钉用户基本信息，接手项目之前太多地方用到了这个storage，不在钉钉环境下没法使用，所以Web端自己实现了一个storage，后续考虑迁移",
  [STORAGE_KEYS.PEIDI_UNIQUE_ID]:
    "自己实现的用日期做一个唯一标识存入localStorage，用于判断是否是大版本更新，清空localStorage",
  [STORAGE_KEYS.USER_CHECK_INFO]:
    "对标ddUserInfo，和Web端自己实现的ddUserInfo数据一致，后续考虑全部使用这个key，不去影响ddUserInfo",
  [STORAGE_KEYS.WORKER_EX_ENUM]: "外部承接人列表"
};
