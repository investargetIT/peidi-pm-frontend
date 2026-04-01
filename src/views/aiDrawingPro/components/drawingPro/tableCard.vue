<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  exportConfigToExcel,
  importConfigFromExcel
} from "./utils/exportConfigExcel";
import { transferDraw } from "@/api/aiDraw";
import imageUrl1 from "@/views/debug/assets/绘图1.png";
import imageUrl2 from "@/views/debug/assets/绘图2.jpg";
import { blobManager } from "../../utils/blobManager";
import ResultDialog from "./resultDialog.vue";
import OnlineImg from "../../common/onlineImg.vue";
import { Download, Refresh, Upload } from "@element-plus/icons-vue";
import { FORMAT_PROMPT } from "./utils/prompt";
import {
  compositeImage,
  generateCompositeElements,
  downloadCompositeImage
} from "../../utils/compositeImage";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const props = defineProps({
  imageConfig: {
    type: Array<any>,
    required: true
  },
  imageName: {
    type: String,
    required: true
  },
  fileList: {
    type: Array<any>,
    required: true
  },
  materialList: {
    type: Object as PropType<{ [key: string]: any[] }>,
    default: () => ({})
  }
});

// 存储导入的数据
const importedDataList = ref<Array<Record<string, any> & { _id: number }>>([]);

// 存储生成结果
const generatedResults = ref<Record<number, string[]>>({});

// 批量生成状态
const batchGenerating = ref(false);
const generatingProgress = ref(0);
const currentGeneratingId = ref<number | null>(null);

// 动态生成表头列
const tableColumns = computed(() => {
  const columns: Array<{
    prop: string;
    label: string;
    width?: number;
    type?: "text" | "image" | "aiRef" | "keepRef" | "remark";
  }> = [];

  let index = 0;
  props.imageConfig.forEach(item => {
    if (item.type === "text" && item.content) {
      item.content.forEach(field => {
        columns.push({
          prop: `${item.id}_${field.label}`,
          label: `${field.label}`,
          width: 150,
          type: "text"
        });
      });
    } else if (item.type === "image") {
      columns.push({
        prop: `${item.id}_image`,
        label: `${item.name}`,
        width: 200,
        type: "image"
      });
      columns.push({
        prop: `${item.id}_aiRef`,
        label: `AI 引用`,
        width: 100,
        type: "aiRef"
      });
      columns.push({
        prop: `${item.id}_keepRef`,
        label: `是否保留`,
        width: 100,
        type: "keepRef"
      });
    } else if (item.type === "group" && item.content) {
      item.content.forEach(field => {
        columns.push({
          prop: `${item.id}_${field.label}`,
          label: `${field.label}`,
          width: 150,
          type: "text"
        });
      });
    }
  });

  // 添加备注列
  columns.push({
    prop: "remark",
    label: "第一优先级提示词",
    width: 200,
    type: "remark"
  });

  return columns;
});

const exportConfig = () => {
  // console.log("imageConfig:", props.imageConfig, props.imageName);
  exportConfigToExcel(props.imageConfig, props.imageName);
};

/**
 * 在素材库中寻找是否有符合要求的图片
 */
const findMaterialImage = (
  materialList: { [key: string]: any[] },
  imageType: string,
  imageUrl: string
) => {
  // console.log(
  //   "在素材库中寻找是否有符合要求的图片:",
  //   materialList,
  //   imageType,
  //   imageUrl
  // );
  const material = materialList[imageType]?.find((item: any) =>
    item.objectName?.includes("/" + imageUrl + ".")
  );
  return material?.objectName || null;
};

/**
 * Excel 数据解析函数
 */
const parseExcelData = (jsonData: any[]) => {
  const result: Array<Record<string, any> & { _id: number }> = [];

  for (const row of jsonData) {
    try {
      const parsedRow: Record<string, any> = {};

      props.imageConfig.forEach(item => {
        if (item.type === "text" && item.content) {
          item.content.forEach(field => {
            // console.log("field:", field);
            const key = `${item.id}_${field.label}`;
            parsedRow[key] = row[field.label] || "";
          });
        } else if (item.type === "image") {
          const imageKey = `${item.id}_image`;
          const aiRefKey = `${item.id}_aiRef`;
          const keepRefKey = `${item.id}_keepRef`;

          const imageName = row[item.name];
          // console.log("数据解析函数", imageName, props.materialList);

          if (imageName && props.materialList["componentMaterial"]) {
            const materialObjectName = findMaterialImage(
              props.materialList,
              "componentMaterial",
              imageName
            );

            // console.log("materialObjectName:", materialObjectName);

            if (materialObjectName) {
              parsedRow[imageKey] = materialObjectName;
            } else {
              parsedRow[imageKey] = null;
            }
          } else {
            parsedRow[imageKey] = null;
          }

          parsedRow[aiRefKey] =
            row[`${item.name}-AI 引用`] === "是" ||
            row[`${item.name}-AI 引用`] === true ||
            false;
          parsedRow[keepRefKey] =
            row[`${item.name}-是否保留`] === "是" ||
            row[`${item.name}-是否保留`] === true ||
            false;
        } else if (item.type === "group" && item.content) {
          item.content.forEach(field => {
            const key = `${item.id}_${field.label}`;
            parsedRow[key] = row[field.label] || "";
          });
        }
      });

      // 解析备注字段
      if (row["备注 Remark"] || row["Remark"] || row["备注"]) {
        parsedRow["remark"] =
          row["备注 Remark"] || row["Remark"] || row["备注"];
      }

      result.push(parsedRow as Record<string, any> & { _id: number });
    } catch (error) {
      console.error("解析 Excel 行数据错误:", error);
    }
  }

  return result;
};

// 导入配置
const importConfig = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls";
  input.style.display = "none";

  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      document.body.removeChild(input);
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event: ProgressEvent<FileReader>) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(data, { type: "array" });
          // console.log("workbook:", workbook);

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            ElMessage.warning("Excel 文件中没有数据");
            document.body.removeChild(input);
            return;
          }

          const importedData = parseExcelData(jsonData);

          ElMessageBox.confirm(
            `成功导入 ${importedData.length} 条配置数据，是否添加到列表？`,
            "导入确认",
            {
              confirmButtonText: "确定",
              cancelButtonText: "取消",
              type: "warning"
            }
          )
            .then(async () => {
              const dataWithId = importedData.map((data, index) => ({
                ...data,
                _id: Date.now() + index
              }));

              importedDataList.value = [
                ...importedDataList.value,
                ...dataWithId
              ];

              // const testB4 = await imageToBase64(imageUrl1);
              // generatedResults.value[importedDataList.value[0]._id] = [testB4];

              // 为每条数据初始化生成结果
              // const testB4 = await imageToBase64(imageUrl1);
              // dataWithId.forEach(item => {
              //   generatedResults.value[item._id] = [testB4];
              // });

              console.log("导入数据:", importedDataList.value);

              ElMessage.success(`导入成功，共 ${importedData.length} 条数据`);
            })
            .catch(() => {});
        } catch (error) {
          console.error("Excel 解析错误:", error);
          ElMessage.error("Excel 文件解析失败：" + (error as Error).message);
        } finally {
          document.body.removeChild(input);
        }
      };

      reader.onerror = () => {
        ElMessage.error("文件读取失败");
        document.body.removeChild(input);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      ElMessage.error("导入失败：" + (error as Error).message);
      document.body.removeChild(input);
    }
  };

  input.oncancel = () => {
    document.body.removeChild(input);
  };

  document.body.appendChild(input);
  input.click();
};

// 删除某行数据
const deleteRow = (index: number) => {
  ElMessageBox.confirm("确定要删除这行数据吗？", "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      importedDataList.value.splice(index, 1);
      ElMessage.success("删除成功");
    })
    .catch(() => {
      // 用户取消
    });
};

// 清空所有数据
const clearAll = () => {
  if (importedDataList.value.length === 0) {
    ElMessage.warning("暂无数据可清空");
    return;
  }

  ElMessageBox.confirm("确定要清空所有数据吗？", "清空确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      importedDataList.value = [];
      generatedResults.value = {};
      ElMessage.success("清空成功");
    })
    .catch(() => {
      // 用户取消
    });
};

// 单元格渲染
const renderCell = (row: Record<string, any>, column: any) => {
  const prop = column.property;
  const value = row[prop];

  // AI 引用列显示开关状态
  if (prop.endsWith("_aiRef")) {
    return value ? "是" : "否";
  }

  // 是否保留列显示开关状态
  if (prop.endsWith("_keepRef")) {
    return value ? "是" : "否";
  }

  // 其他列直接显示值
  return value || "-";
};

// 清空所有数据
const closeClearAll = () => {
  importedDataList.value = [];
  generatedResults.value = {};
};

/**
 * 将图片 URL 转换为 base64
 */
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

/**
 * 构建 AI 生成的 prompt
 */
const buildPrompt = (rowData: Record<string, any>) => {
  const config = props.imageConfig.map((item, index) => {
    const baseItem = {
      id: item.id,
      name: item.name,
      type: item.type,
      rect: item.rect
    };

    if (item.type === "text" && item.content) {
      const updatedContent = item.content.map(field => ({
        label: field.label,
        text: rowData[`${item.id}_${field.label}`] || field.text
      }));
      return {
        ...baseItem,
        content: updatedContent
      };
    }

    if (item.type === "image") {
      // return { ...baseItem };
      const imageData = rowData[`${item.id}_image`];
      const aiRef = rowData[`${item.id}_aiRef`];
      const keepRef = rowData[`${item.id}_keepRef`];

      if (aiRef && imageData) {
        return {
          ...baseItem,
          image: `第 ${index + 2} 张图`
        };
      }
      if (!imageData && keepRef) {
        return {
          ...baseItem,
          image: null,
          keep: true
        };
      } else {
        return {
          ...baseItem,
          image: null,
          keep: false
        };
      }
    }

    return baseItem;
  });

  const prompt = FORMAT_PROMPT(
    JSON.stringify(props.imageConfig),
    JSON.stringify(config)
  );

  // 如果有备注字段，添加到 prompt 中
  if (rowData.remark) {
    return `${prompt}\n${rowData.remark}`;
  }
};

/**
 * 收集需要引用的图片素材
 */
const collectImageUrls = (rowData: Record<string, any>): string[] => {
  const urls: string[] = [];

  console.log("collectImageUrls", props.imageConfig);
  props.imageConfig.forEach(item => {
    if (item.type === "image") {
      const imageData = rowData[`${item.id}_image`];
      const aiRef = rowData[`${item.id}_aiRef`];

      if (aiRef && imageData) {
        if (props.materialList[item.id]) {
          const material = props.materialList[item.id].find(
            (mat: any) => mat.objectName === imageData || mat.url === imageData
          );
          if (material && material.url) {
            urls.push(material.url);
          } else if (
            typeof imageData === "string" &&
            imageData.startsWith("http")
          ) {
            urls.push(imageData);
          }
        } else if (
          typeof imageData === "string" &&
          imageData.startsWith("http")
        ) {
          urls.push(imageData);
        }
      }
    }
  });

  return urls;
};

/**
 * 单张图片生成逻辑
 */
const generateSingleImage = async (
  row: Record<string, any> & { _id: number }
) => {
  try {
    // 转换示例图片为 base64
    const [base64Url1, base64Url2] = await Promise.all([
      imageToBase64(imageUrl1),
      imageToBase64(imageUrl2)
    ]);

    // 收集素材图片
    const materialUrls = collectImageUrls(row);
    console.log("素材图片:", materialUrls, row);
    // return;

    // 转换素材图片为 base64
    const base64MaterialUrls: string[] = [];
    for (const url of materialUrls) {
      try {
        const base64 = await imageToBase64(url);
        base64MaterialUrls.push(base64);
      } catch (error) {
        console.error("素材图片转 base64 失败:", error);
      }
    }

    const base64Url1_ = await blobManager.blobToBase64(props.fileList[0].raw);

    const params = {
      model: "nano-banana-2",
      prompt: buildPrompt(row),
      aspectRatio: "auto",
      imageSize: "4K",
      shutProgress: false,
      urls: [base64Url1_, ...base64MaterialUrls]
      // urls: [base64Url1_]
    };
    console.log("params:", params);
    // return;

    const response: any = await transferDraw({
      urlParam: JSON.stringify(params)
    });

    if (response.code === 200 && response.data?.[0]) {
      // 将结果图片转为 base64
      const resultImg = new Image();
      resultImg.crossOrigin = "anonymous";

      return new Promise<string>((resolve, reject) => {
        resultImg.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = resultImg.width;
          canvas.height = resultImg.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("无法获取 canvas 上下文"));
            return;
          }
          ctx.drawImage(resultImg, 0, 0);
          const base64 = canvas.toDataURL("image/png");
          resolve(base64);
        };
        resultImg.onerror = () => {
          reject(new Error("结果图片加载失败"));
        };
        resultImg.src = response.data[0];
      });
    } else {
      throw new Error(response?.msg || "生成失败");
    }
  } catch (error: any) {
    console.error("生成图片失败:", error);
    throw error;
  }
};

/**
 * 批量生成图片
 */
const handleBatchGenerate = async () => {
  if (importedDataList.value.length === 0) {
    ElMessage.warning("暂无数据可生成");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量生成 ${importedDataList.value.length} 张图片吗？`,
      "批量生成确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  batchGenerating.value = true;
  generatingProgress.value = 0;
  generatedResults.value = {};

  const total = importedDataList.value.length;
  const successCount = ref(0);
  const failCount = ref(0);

  for (let i = 0; i < importedDataList.value.length; i++) {
    const row = importedDataList.value[i];
    currentGeneratingId.value = row._id;
    generatingProgress.value = Math.round(((i + 1) / total) * 100);

    try {
      const resultBase64 = await generateSingleImage(row);
      generatedResults.value[row._id] = [resultBase64];
      successCount.value++;
      ElMessage.success(`第 ${i + 1} 张图片生成成功`);
    } catch (error: any) {
      failCount.value++;
      ElMessage.error(`第 ${i + 1} 张图片生成失败：${error.message}`);
      generatedResults.value[row._id] = [];
    }

    // 添加小延迟避免请求过快
    if (i < importedDataList.value.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  batchGenerating.value = false;
  currentGeneratingId.value = null;
  generatingProgress.value = 0;

  ElMessage.success(
    `批量生成完成，成功 ${successCount.value} 张，失败 ${failCount.value} 张`
  );
};

const resultDialogRef = ref<typeof ResultDialog>();

/**
 * 预览并编辑图片
 */
const handlePreviewImage = (imageUrl: string, rowData?: any) => {
  // console.log("预览图片:", imageUrl, rowData);
  resultDialogRef.value?.open(imageUrl, rowData, props.imageConfig);
};

/**
 * 从行数据中生成 Canvas 合成图片
 */
const generateCompositeFromRowData = async (
  imageUrl: string,
  rowData: Record<string, any>,
  imageConfig: any[],
  size: number = 800
): Promise<string | null> => {
  try {
    console.log("\n=== 开始生成合成图片 ===");
    console.log("背景图 URL:", imageUrl);
    console.log("行数据:", rowData);
    console.log("图片配置:", imageConfig);

    // 收集所有需要加载的图片配置
    const imageConfigs = imageConfig.filter(item => item.type === "image");
    console.log("图片类型配置数量:", imageConfigs.length);

    // 先收集所有需要加载的图片信息
    const loadImageTasks: Array<{
      config: any;
      base64Data: string;
    }> = [];

    for (const config of imageConfigs) {
      const imageKey = `${config.id}_image`;
      const aiRefKey = `${config.id}_aiRef`;
      const imageData = rowData[imageKey];
      const isAiReferenced = rowData[aiRefKey] === true;

      console.log(`\n处理配置: ${config.name}`, {
        imageKey,
        aiRefKey,
        imageData,
        isAiReferenced,
        hasImageData: !!imageData,
        rect: config.rect
      });

      if (imageData && !isAiReferenced) {
        let base64Data: string | null = null;

        if (
          typeof imageData === "string" &&
          imageData.startsWith("data:image")
        ) {
          base64Data = imageData;
          console.log(`✓ 使用 base64 数据：${config.name}`);
        } else if (typeof imageData === "string") {
          try {
            const material = props.materialList["componentMaterial"]?.find(
              (mat: any) =>
                mat.objectName === imageData || mat.url === imageData
            );

            console.log(`查找素材 ${config.name}:`, material);

            if (material) {
              // 优先使用 material.url，如果没有则尝试从 objectName 构建完整 URL
              let materialUrl = material.url || material.objectName;

              console.log(`使用素材 URL: ${materialUrl}`);

              // 如果 URL 不是完整的 http 地址，需要从服务器下载
              if (!materialUrl.startsWith("http")) {
                // 使用 downloadFile API 下载文件
                const { downloadFile } = await import("@/api/aiDraw");
                const blob: any = await downloadFile({
                  objectName: materialUrl
                });
                base64Data = await blobManager.blobToBase64(blob);
                console.log(`✓ 从素材库下载并转换成功：${config.name}`);
              } else {
                const response = await fetch(materialUrl);
                const blob = await response.blob();
                base64Data = await blobManager.blobToBase64(blob);
                console.log(`✓ 从 HTTP URL 加载成功：${config.name}`);
              }
            } else if (imageData.startsWith("http")) {
              const response = await fetch(imageData);
              const blob = await response.blob();
              base64Data = await blobManager.blobToBase64(blob);
              console.log(`✓ 从 HTTP URL 加载成功：${config.name}`);
            } else {
              console.warn(`✗ 未找到素材 ${config.name}`);
            }
          } catch (error) {
            console.warn(`✗ 加载素材 ${config.name} 失败:`, error);
            continue;
          }
        }

        if (base64Data) {
          loadImageTasks.push({
            config,
            base64Data
          });
          console.log(`✓ 添加到加载任务：${config.name}`);
        } else {
          console.warn(`✗ 没有 base64 数据：${config.name}`);
        }
      } else {
        console.log(`⊘ 跳过 ${config.name}:`, {
          hasImageData: !!imageData,
          isAiReferenced
        });
      }
    }

    console.log(`\n准备加载 ${loadImageTasks.length} 个图片素材...`);

    // 现在按顺序加载所有图片并创建元素
    const elements: Array<{
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (const task of loadImageTasks) {
      const { config, base64Data } = task;

      const img = new Image();
      await new Promise<void>(resolve => {
        img.onload = () => {
          console.log(`✓ 图片加载成功：${config.name}`, {
            width: img.width,
            height: img.height
          });
          resolve();
        };
        img.onerror = () => {
          console.warn(`✗ 图片加载失败：${config.name}`);
          resolve();
        };
        img.src = base64Data;
      });

      if (img.width > 0 && img.height > 0) {
        const element = {
          src: base64Data,
          x: (config.rect?.x * 700 || 50 + elements.length * 20) * (size / 700),
          y: (config.rect?.y * 700 || 50 + elements.length * 20) * (size / 700),
          width:
            (config.rect?.width * 700 || Math.min(img.width, 200)) *
            (size / 700),
          height:
            (config.rect?.height * 700 || Math.min(img.height, 200)) *
            (size / 700)
        };
        elements.push(element);
        console.log(`✓ 添加元素到数组：${config.name}`, element);
      }
    }

    console.log(`\n最终加载的元素数量: ${elements.length}`);
    console.log("元素列表:", elements);

    if (elements.length > 0) {
      console.log("开始 Canvas 合成...");
      const compositeBase64 = await compositeImage(imageUrl, elements, size);
      console.log("✓ Canvas 合成成功");
      return compositeBase64;
    } else {
      console.warn("✗ 没有可合成的素材元素，返回 null");
    }

    return null;
  } catch (error) {
    console.error("✗ 根据配置生成图片失败:", error);
    throw error;
  }
};

/**
 * 批量导出所有结果图
 */
const exportAllResults = async () => {
  if (importedDataList.value.length === 0) {
    ElMessage.warning("没有可导出的数据");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要批量导出 ${importedDataList.value.length} 张图片吗？`,
      "批量导出确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
  } catch {
    return;
  }

  const zip = new JSZip();
  const successCount = ref(0);
  const failCount = ref(0);
  const exportProgress = ref(0);

  const message = ElMessage({
    message: "正在批量导出图片，请稍候...",
    type: "info",
    duration: 0
  });

  try {
    for (let i = 0; i < importedDataList.value.length; i++) {
      const rowData = importedDataList.value[i];
      exportProgress.value = Math.round(
        ((i + 1) / importedDataList.value.length) * 100
      );

      try {
        // 获取生成的结果图 URL（base64）
        const resultImageUrl = generatedResults.value[rowData._id]?.[0];

        if (!resultImageUrl) {
          console.warn(`第 ${i + 1} 行数据没有生成的结果图，跳过`);
          failCount.value++;
          continue;
        }

        console.log("批量导出:", resultImageUrl, rowData, props.imageConfig);

        const compositeBase64 = await generateCompositeFromRowData(
          resultImageUrl,
          rowData,
          props.imageConfig,
          800
        );

        console.log("批量导出合成结果图:", compositeBase64);

        if (compositeBase64) {
          const fileName = `${rowData.productName || `AI_Image_${i + 1}`}.png`;

          const base64Data = compositeBase64.split(",")[1];
          const binaryString = atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let j = 0; j < len; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          zip.file(fileName, bytes);
          successCount.value++;
          console.log(`成功生成第 ${i + 1} 张图片：${fileName}`);
        } else {
          failCount.value++;
          console.warn(`第 ${i + 1} 张图片没有可合成的素材`);
        }
      } catch (error) {
        failCount.value++;
        console.error(`导出第 ${i + 1} 张图片失败:`, error);
      }

      if (i < importedDataList.value.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    message.close();

    if (successCount.value > 0) {
      const loadingMsg = ElMessage({
        message: "正在打包压缩文件，请稍后...",
        type: "info",
        duration: 0
      });

      const content = await zip.generateAsync({ type: "blob" });

      loadingMsg.close();

      const timestamp = new Date().getTime();
      saveAs(content, `AI_Images_Batch_Export_${timestamp}.zip`);

      ElMessage.success(
        `批量导出完成，成功 ${successCount.value} 张，失败 ${failCount.value} 张`
      );
    } else {
      ElMessage.warning("所有图片导出失败，请检查是否有可合成的素材");
    }
  } catch (error) {
    message.close();
    console.error("批量导出失败:", error);
    ElMessage.error("批量导出失败：" + (error as Error).message);
  }
};

defineExpose({
  closeClearAll
});
</script>

<template>
  <div>
    <el-card
      shadow="never"
      style="border-radius: 10px; background-color: #f5f7fa"
    >
      <template #header>
        <div class="card-header">
          <span>
            <span>批量生成模式</span>
          </span>
        </div>
      </template>
      <div class="flex items-center justify-between mb-4 flex-wrap">
        <div class="text-base font-bold text-gray-800">
          配置表
          <span class="text-sm text-gray-500 font-normal">
            (点击右侧导出配置表，支持多次导入配置表)
          </span>
        </div>
        <div class="flex items-center">
          <el-button
            color="#217346"
            size="small"
            @click="exportConfig"
            :icon="Download"
          >
            导出配置表
          </el-button>
          <el-button
            type="primary"
            size="small"
            @click="importConfig"
            :icon="Upload"
          >
            导入配置表
          </el-button>
          <el-button
            type="danger"
            size="small"
            @click="clearAll"
            :disabled="importedDataList.length === 0"
            :icon="Refresh"
          >
            清空全部
          </el-button>
          <el-button
            color="#534CE7"
            type="primary"
            size="small"
            @click="handleBatchGenerate"
            :loading="batchGenerating"
            :disabled="importedDataList.length === 0"
          >
            ✨ 开始绘制
          </el-button>
          <el-button
            color="#CC6600"
            type="primary"
            size="small"
            @click="exportAllResults"
            :disabled="importedDataList.length === 0 || batchGenerating"
          >
            📥 导出全部结果图
          </el-button>
        </div>
      </div>

      <div v-if="importedDataList.length > 0">
        <el-table
          :data="importedDataList"
          style="width: 100%"
          :header-cell-style="{
            background: '#f5f7fa',
            color: '#333',
            fontWeight: 'bold'
          }"
          :cell-style="{ padding: '8px 0' }"
          border
          :height="500"
          default-expand-all
        >
          <!-- 图片结果 -->
          <el-table-column type="expand" label="结果" width="60">
            <template #default="props">
              <div class="mx-5 my-1">
                <div
                  v-if="
                    batchGenerating && currentGeneratingId === props.row._id
                  "
                  class="flex items-center justify-start py-8"
                >
                  <el-progress
                    type="circle"
                    :percentage="generatingProgress"
                    :stroke-width="10"
                    color="#534CE7"
                  />
                  <span class="ml-4 text-gray-600">正在生成...</span>
                </div>

                <img
                  v-else-if="generatedResults[props.row._id]?.[0]"
                  :src="generatedResults[props.row._id][0]"
                  alt="生成结果"
                  :style="{
                    width: `${100}px`,
                    height: `${100}px`,
                    objectFit: 'contain'
                  }"
                  class="shadow-md cursor-pointer rounded-lg"
                  @click="
                    handlePreviewImage(
                      generatedResults[props.row._id][0],
                      props.row
                    )
                  "
                />

                <div
                  v-else-if="generatedResults[props.row._id]?.length === 0"
                  class="text-left py-8 text-gray-400"
                >
                  生成失败
                </div>

                <div v-else class="text-left py-8 text-gray-400">
                  暂无结果，请点击「✨ 开始绘制」
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 序号列 -->
          <el-table-column
            type="index"
            label="序号"
            width="60"
            align="center"
          />

          <!-- 动态生成的列 -->
          <el-table-column
            v-for="col in tableColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            align="center"
          >
            <template #default="{ row }">
              <div v-if="col.type === 'image' && row[col.prop]">
                <div>
                  <p class="text-xs w-full">{{ row[col.prop] }}</p>
                  <OnlineImg :url="row[col.prop]" size="70px" />
                </div>
              </div>
              <div
                v-else
                v-html="renderCell(row, { property: col.prop })"
              ></div>
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column
            label="操作"
            width="100"
            fixed="right"
            align="center"
          >
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="deleteRow($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="mt-4 text-sm text-gray-600">
          共 {{ importedDataList.length }} 条数据
        </div>
      </div>

      <div
        v-else
        class="empty-data-tip"
        style="text-align: center; padding: 100px 0"
      >
        <el-empty description="暂无数据，请点击「导入配置表」添加数据" />
      </div>
    </el-card>
  </div>

  <ResultDialog ref="resultDialogRef" />
</template>

<style scoped>
.empty-data-tip {
  color: #909399;
}
</style>
