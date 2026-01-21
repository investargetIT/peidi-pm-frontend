import { ExcelTableItem } from "../type/drawing";

// 模型名称
// export const GRSAI_MODEL_NAME = "nano-banana-fast";
export const GRSAI_MODEL_NAME = "nano-banana-pro";

// 生成的图片数量
export const MAX_PIC_COUNT = 1;
// export const MAX_PIC_COUNT = 3;

// 最大重试次数
export const MAX_RETRY_COUNT = 10;

// 轮询间隔
export const POLL_INTERVAL = 1000 * 120;

/**
 * 表格数据默认值
 */
export const EXCEL_TABLE_ITEM_DEFAULT: ExcelTableItem = {
  status: 1,
  uuid: null,
  uiid: null,
  id: "",
  templateImage: [] as string[], // 现在这里存储的是图片的base64字符串数组
  imageSize: "4K" as string, // 输出图像大小
  campaignLogoImage: [] as string[], // 活动LOGO图片
  highlightedSellingPoints: "特色酥骨工艺" as string, // 产品卖点-高亮
  normalSellingPoints: "特色酥骨工艺 蜜汁兔脊" as string, // 产品卖点-全部
  productName: "兔脊骨120g" as string, // 产品名
  productImage: [] as string[], // 产品图片
  fullGiftTitle: "全场满199送" as string, // 全场满赠-标题
  fullGiftDescription: "爵宴狗粮随行装试吃（50g*4）" as string, // 全场满赠-描述
  fullGiftTags: "赠" as string, // 全场满赠-标签
  fullGiftImages: [] as string[], // 全场满赠-图片
  handPriceTitle: "到手价" as string, // 到手价-标题
  handPrice: "￥34.3" as string, // 到手价-价格
  profitPoints: "会员抢券 全场满199-15" as string, // 利益点
  activityTime: "活动时间：12/15 00:00:00 - 12/25 23:59:59" as string, // 活动时间
  remark: "" as string, // 备注
  resultImages: [] as string[], // 生成的图片
  betterTemplateImage: {} as object, // 更好的模板图
  shopLogoImage: [] as string[], // 店铺LOGO
  brandLogoImage: [] as string[] // 品牌LOGO
};
