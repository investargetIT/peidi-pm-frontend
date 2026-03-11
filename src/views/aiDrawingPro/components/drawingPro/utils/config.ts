// export const IMG_CONFIG = [
//   {
//     id: "brand_logo",
//     name: "品牌Logo",
//     type: "image",
//     rect: {
//       x: 0.085,
//       y: 0.025,
//       width: 0.15,
//       height: 0.12
//     }
//   },
//   {
//     id: "event_logo",
//     name: "活动Logo",
//     type: "image",
//     rect: {
//       x: 0.275,
//       y: 0.06,
//       width: 0.125,
//       height: 0.065
//     }
//   },
//   {
//     id: "store_badge",
//     name: "官方旗舰店角标",
//     type: "image",
//     rect: {
//       x: 0.725,
//       y: 0.015,
//       width: 0.235,
//       height: 0.235
//     }
//   },
//   {
//     id: "selling_point_1",
//     name: "产品卖点1",
//     type: "text",
//     content: [
//       {
//         label: "卖点文案",
//         text: "特色酥骨工艺"
//       }
//     ],
//     rect: {
//       x: 0.065,
//       y: 0.23,
//       width: 0.365,
//       height: 0.065
//     }
//   },
//   {
//     id: "product_name",
//     name: "产品名称",
//     type: "text",
//     content: [
//       {
//         label: "产品名文案",
//         text: "蜜汁兔脊"
//       }
//     ],
//     rect: {
//       x: 0.445,
//       y: 0.23,
//       width: 0.25,
//       height: 0.065
//     }
//   },
//   {
//     id: "product_spec",
//     name: "产品规格标签",
//     type: "text",
//     content: [
//       {
//         label: "规格文案",
//         text: "兔脊骨120g"
//       }
//     ],
//     rect: {
//       x: 0.06,
//       y: 0.325,
//       width: 0.205,
//       height: 0.045
//     }
//   },
//   {
//     id: "promo_box",
//     name: "左侧赠品促销区",
//     type: "image",
//     rect: {
//       x: 0.065,
//       y: 0.405,
//       width: 0.25,
//       height: 0.295
//     }
//   },
//   {
//     id: "main_product_image",
//     name: "产品主图",
//     type: "image",
//     rect: {
//       x: 0.265,
//       y: 0.355,
//       width: 0.71,
//       height: 0.45
//     }
//   },
//   {
//     id: "activity_time",
//     name: "活动时间栏",
//     type: "text",
//     content: [
//       {
//         label: "时间文案",
//         text: "活动时间：12/15 00:00:00 - 12/25 23:59:59"
//       }
//     ],
//     rect: {
//       x: 0.42,
//       y: 0.835,
//       width: 0.415,
//       height: 0.025
//     }
//   },
//   {
//     id: "price_number",
//     name: "主推价格",
//     type: "text",
//     content: [
//       {
//         label: "价格数值",
//         text: "34.3"
//       }
//     ],
//     rect: {
//       x: 0.075,
//       y: 0.88,
//       width: 0.18,
//       height: 0.085
//     }
//   },
//   {
//     id: "benefit_slogan",
//     name: "底部利益点",
//     type: "text",
//     content: [
//       {
//         label: "利益点文案",
//         text: "会员抢券 全场满199-15"
//       }
//     ],
//     rect: {
//       x: 0.295,
//       y: 0.89,
//       width: 0.655,
//       height: 0.07
//     }
//   }
// ];

export const IMG_CONFIG = [
  {
    id: "brand_event_header",
    name: "顶部活动头图",
    type: "text",
    content: [
      {
        label: "品牌名称",
        text: "SmartBones"
      },
      {
        label: "活动名称",
        text: "3·8焕新周"
      }
    ],
    rect: {
      x: 0.03,
      y: 0.02,
      width: 0.51,
      height: 0.08
    }
  },
  {
    id: "event_time",
    name: "活动时间",
    type: "text",
    content: [
      {
        label: "时间文案",
        text: "活动售卖 02/24 00:00 - 03/09 23:59"
      }
    ],
    rect: {
      x: 0.65,
      y: 0.02,
      width: 0.33,
      height: 0.08
    }
  },
  {
    id: "main_title",
    name: "主标题/核心卖点",
    type: "text",
    content: [
      {
        label: "主标题文案",
        text: "磨牙洁齿 安抚情绪"
      }
    ],
    rect: {
      x: 0.15,
      y: 0.12,
      width: 0.7,
      height: 0.11
    }
  },
  {
    id: "sub_title",
    name: "副标题/产品名",
    type: "text",
    content: [
      {
        label: "副标题文案",
        text: "多口味迷你咬胶50支"
      }
    ],
    rect: {
      x: 0.28,
      y: 0.23,
      width: 0.44,
      height: 0.06
    }
  },
  {
    id: "main_product_image",
    name: "主产品图",
    type: "image",
    rect: {
      x: 0.12,
      y: 0.32,
      width: 0.56,
      height: 0.44
    }
  },
  {
    id: "gift_box_module",
    name: "赠品利益点模块",
    type: "group",
    content: [
      {
        label: "赠品条件",
        text: "前100名赠"
      },
      {
        label: "赠品价值",
        text: "价值 25.9"
      },
      {
        label: "赠品描述",
        text: "赠编织球7只"
      }
    ],
    rect: {
      x: 0.7,
      y: 0.38,
      width: 0.25,
      height: 0.32
    }
  },
  {
    id: "gift_product_image",
    name: "赠品图",
    type: "image",
    rect: {
      x: 0.75,
      y: 0.46,
      width: 0.13,
      height: 0.17
    }
  },
  {
    id: "price_module",
    name: "到手价模块",
    type: "text",
    content: [
      {
        label: "价格前缀",
        text: "预估到手价 ￥"
      },
      {
        label: "核心价格",
        text: "94"
      },
      {
        label: "价格后缀",
        text: "起"
      }
    ],
    rect: {
      x: 0.0,
      y: 0.78,
      width: 0.45,
      height: 0.22
    }
  },
  {
    id: "promo_tag_1",
    name: "促销标签1",
    type: "text",
    content: [
      {
        label: "标签文案",
        text: "官方立减享85折"
      }
    ],
    rect: {
      x: 0.62,
      y: 0.81,
      width: 0.36,
      height: 0.06
    }
  },
  {
    id: "promo_tag_2",
    name: "促销标签2",
    type: "text",
    content: [
      {
        label: "横幅文案",
        text: "下单立减24"
      }
    ],
    rect: {
      x: 0.45,
      y: 0.88,
      width: 0.55,
      height: 0.12
    }
  }
];
