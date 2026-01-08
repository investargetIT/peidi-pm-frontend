export interface ExcelTableItem {
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
}
