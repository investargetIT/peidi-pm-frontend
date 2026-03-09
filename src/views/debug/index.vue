<script setup lang="ts">
import { transferGemini } from "@/api/aiDraw";
import imageUrl1 from "./assets/绘图1.png";
import imageUrl2 from "./assets/绘图2.jpg";
import imageUrl3 from "./assets/信息点.jpg";

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
给你的图是一个商品的主图，我已经标记了信息点。
你需要根据图中的信息点，提取出一个对象数据，对象数据包含所有信息点。
数据对象最后要加上一个参数，参数名为"images"，参数值为"[{name: "产品图片", eg_name: "image_product"}...]"，告诉用户需要传哪些素材图，小图你自动过滤掉，因为小图字体会变形
可参考的对象数据：\'
[
 {
  "name": "产品卖点",
  "eg_name": "product_selling_point",
  "value": "特色酥骨工艺"
 }
 ...
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
              url: base64Url3
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
