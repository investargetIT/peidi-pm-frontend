export interface ExcelTableItem {
  status: number; // 0处理中 1完成 2失败
  uuid?: string; // uuid是服务器唯一id，如果存在uuid说明已经上传到服务器了
  uiid: string; // uiid是客户端唯一id
  id: string;
  templateImage: string[];
  imageSize: string;
  campaignLogoImage: string[];
  highlightedSellingPoints: string;
  normalSellingPoints: string;
  productName: string;
  productImage: string[];
  fullGiftTitle: string;
  fullGiftDescription: string;
  fullGiftTags: string;
  fullGiftImages: string[];
  handPriceTitle: string;
  handPrice: string;
  profitPoints: string;
  activityTime: string;
  remark: string;
  resultImages: string[];
  // 更好的模板图
  betterTemplateImage: object;
  // 店铺LOGO
  shopLogoImage: string[];
  // 品牌LOGO
  brandLogoImage: string[];
}
