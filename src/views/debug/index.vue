<script setup lang="ts">
import { transferGemini } from "@/api/aiDraw";
import imageUrl1 from "./assets/绘图1.png";
import imageUrl2 from "./assets/绘图2.jpg";
import imageUrl3 from "./assets/信息点1.jpg";
import imageUrl4 from "./assets/信息点2.png";
import imageUrl5 from "./assets/信息点3.png";

// 将图片 URL 转换为 base64
const imageToBase64 = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("无法获取 canvas 上下文"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL("image/png");
      resolve(base64);
    };
    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };
    img.src = imageUrl;
  });
};
// 测试中转gemini模型
const testTransferGemini = async () => {
  // 转换图片为 base64
  let base64Url1 = "";
  let base64Url2 = "";
  let base64Url3 = "";

  try {
    [base64Url1, base64Url2, base64Url3] = await Promise.all([
      imageToBase64(imageUrl1),
      imageToBase64(imageUrl2),
      imageToBase64(imageUrl3)
    ]);
  } catch (error) {
    console.error("图片转 base64 失败:", error);
    return;
  }

  // 任务需求
  const TASK_REQUIREMENT = `
第一张图是模板图，第二张图是进行了标记的模板图。
请返回给我一个可以在模板图上渲染方块（包含方块信息）的参数数组，
我用来告诉用户哪些地方是可以修改的，你还应该告诉我里面的内容，比如产品卖点 可以修改卖点文案 内容为特色酥骨工艺
参考格式：
[
  {
    id: "event_logo",
    name: "活动logo",
    type: "image",
    rect: {
      x: 0.275,
      y: 0.06,
      width: 0.125,
      height: 0.065
    }
  },
  {
    id: "product_selling_point",
    name: "1.产品卖点",
    content: [
      {
        label: "卖点文案",
        text: "特色酥骨工艺"
      },
    ]
    type: "text",
    rect: {
      x: 0.06,
      y: 0.23,
      width: 0.65,
      height: 0.075
    }
  },
]

\'
`;

  const params = {
    model: "gemini-3.1-pro",
    stream: true,
    messages: [
      {
        role: "system",
        content: "你是一名专业的电商主图设计与模板复用 AI"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${TASK_REQUIREMENT}`
          },
          {
            type: "image_url",
            image_url: {
              url: base64Url2
            }
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl5
            }
          }
        ]
      }
    ]
  };

  transferGemini({
    urlParam: JSON.stringify(params)
  }).then((res: any) => {
    // console.log("中转gemini模型:", res);
    if (res.code === 200) {
      const content = res.data;
      console.log("截取后的内容:", content);
    }
  });
};
</script>

<template>
  <div>
    <h4>debug</h4>
    <el-button type="primary" @click="testTransferGemini">
      testTransferGemini
    </el-button>
  </div>
</template>
