export const DSL_SCHEMA = {
  canvas: {
    size: "1242x1242",
    background: {
      color: "#F6F1E8",
      texture: "traditional_wave_pattern"
    }
  },
  brand: {
    logo: "meatyway",
    position: "top_left"
  },
  event_badge: {
    id: "double_festival",
    type: "image",
    image_ref: "double_festival_logo",
    position: "top_left",
    anchor: "canvas",
    offset: { x: 200, y: 0 },
    scale: 1.0,
    priority: "high",
    replaceable: true
  },
  badge: {
    type: "official_flagship",
    text: "官方旗舰店",
    position: "top_right",
    style: {
      shape: "circle",
      color: "gold_black"
    }
  },
  title: {
    text: "特色酥骨工艺 蜜汁兔脊",
    highlight: {
      text: "特色酥骨工艺",
      color: "#FF4D2E"
    },
    position: "center_top",
    font: "bold"
  },
  subtitle: {
    text: "兔脊骨 120g",
    style: {
      background: "#1F6B4A",
      color: "white",
      radius: "pill"
    }
  },
  product: {
    image: "rabbit_spine_honey_pack",
    position: "center",
    shadow: "soft"
  },
  promo_box: {
    position: "left_center",
    border: "red",
    header: {
      title: "全场满199送",
      badge: "赠"
    },
    body: {
      text: "爵宴狗粮随行装试吃（50g*4）",
      gift_items: {
        layout: "horizontal",
        spacing: "small",
        items: [
          { image_ref: "gift_food_1" },
          { image_ref: "gift_food_2" },
          { image_ref: "gift_food_3" },
          { image_ref: "gift_food_4" }
        ]
      }
    }
  },
  price: {
    label: "到手价",
    value: "¥34.3",
    position: "bottom_left",
    style: {
      color: "white",
      background: "red",
      font: "bold"
    }
  },
  coupon: {
    text: "会员抢券 全场满199-15",
    position: "bottom_center",
    style: {
      background: "red",
      color: "white"
    }
  },
  activity_time: {
    text: "活动时间：12/15 00:00:00 - 12/25 23:59:59",
    position: "bottom",
    font_size: "small"
  }
};
