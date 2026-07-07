<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  exportConfigToExcel,
  importConfigFromExcel
} from "./utils/exportConfigExcel";
import { AI_MODEL_OPTIONS } from "./utils/config";
import {
  transferDraw,
  transferDrawAliyun,
  transferDrawQnaigc,
  transferCodingPlan
} from "@/api/aiDraw";
import imageUrl1 from "@/views/debug/assets/绘图1.png";
import imageUrl2 from "@/views/debug/assets/绘图2.jpg";
import { blobManager } from "../../utils/blobManager";
import { imageCache } from "../../utils/imageCache";
import { downloadFile } from "@/api/aiDraw";
import ResultDialog from "./resultDialog.vue";
import OnlineImg from "../../common/onlineImg.vue";
import {
  Delete,
  Download,
  Refresh,
  Upload,
  Loading,
  CircleCheck
} from "@element-plus/icons-vue";
import { FORMAT_PROMPT, PromptType } from "./utils/prompt";
import {
  compositeImage,
  generateCompositeElements,
  downloadCompositeImage
} from "../../utils/compositeImage";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const aiModel = ref(AI_MODEL_OPTIONS[0].value);
const exportWidth = ref(1440);
const exportHeight = ref<number | null>(null);
const exportMaxSizeMB = ref<number | null>(null);
const exportPreferPNG = ref(false);
const showExportDialog = ref(false);
const showPreviewDialog = ref(false);
const regeneratingIndex = ref<number | null>(null);
const previewRemarks = ref<Record<number, string>>({});

// AI校验相关
const validatingIndex = ref<number | null>(null);
const isAllValidating = ref(false);
const validationResults = ref<
  Record<number, { passed: boolean; issues: string[]; suggestion: string }>
>({});

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
  },
  imageConfigFirstPrompt: {
    type: String,
    default: ""
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
const currentGeneratingIndex = ref(0);

// 动态生成表头列
const tableColumns = computed(() => {
  const columns: Array<{
    prop: string;
    label: string;
    width?: number;
    type?: "text" | "image" | "aiRef" | "eraseRef" | "remark";
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
      // columns.push({
      //   prop: `${item.id}_aiRef`,
      //   label: `AI 引用`,
      //   width: 100,
      //   type: "aiRef"
      // });
      columns.push({
        prop: `${item.id}_eraseRef`,
        label: `是否抹除`,
        width: 100,
        type: "eraseRef"
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
    label: "必做事项",
    width: 200,
    type: "remark"
  });

  return columns;
});

// 判断是否至少有一个结果
const hasAnyResult = computed(() => {
  return Object.keys(generatedResults.value).some(
    id => generatedResults.value[Number(id)]?.length > 0
  );
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
          const eraseRefKey = `${item.id}_eraseRef`;

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
          parsedRow[eraseRefKey] =
            row[`${item.name}-是否抹除`] === "是" ||
            row[`${item.name}-是否抹除`] === true ||
            false;
        } else if (item.type === "group" && item.content) {
          item.content.forEach(field => {
            const key = `${item.id}_${field.label}`;
            parsedRow[key] = row[field.label] || "";
          });
        }
      });

      // 解析备注字段
      if (row["第一优先级提示词"] || row["必做事项"]) {
        parsedRow["remark"] = row["第一优先级提示词"] || row["必做事项"];
      }

      // 全局的第一优先级提示词现在在 buildPrompt 中统一添加，不需要在这里添加

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

          const filteredData = jsonData.filter(row => {
            const hasValidField = Object.keys(row).some(key => {
              if (key === "__rowNum__" || key === "__rowIndex__") return false;
              const value = row[key];
              if (value === null || value === undefined) return false;
              if (typeof value === "string" && value.trim() === "")
                return false;
              return true;
            });
            return hasValidField;
          });

          console.log("jsonData:", jsonData, filteredData);

          const importedData = parseExcelData(filteredData);

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

// 重新生成某行数据
const regenerateRow = async (index: number, row: any) => {
  try {
    await ElMessageBox.confirm("确定要重新生成这张图片吗？", "重新生成确认", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  const rowId = row._id;
  currentGeneratingId.value = rowId;

  try {
    ElMessage.info("正在生成图片...");
    const resultBase64 = await generateSingleImage(row);
    generatedResults.value[rowId] = [resultBase64];
    ElMessage.success("图片重新生成成功");
  } catch (error: any) {
    ElMessage.error(`图片重新生成失败：${error.message}`);
    generatedResults.value[rowId] = [];
  } finally {
    currentGeneratingId.value = null;
  }
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
  // if (prop.endsWith("_keepRef")) {
  //   return value ? "是" : "否";
  // }

  // 是否抹除列显示开关状态
  if (prop.endsWith("_eraseRef")) {
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
 * 将图片 URL 转换为 base64（支持缓存）
 * @param imageUrl 图片 URL 或相对路径
 * @returns Promise<string> base64 字符串
 */
const imageToBase64 = async (imageUrl: string): Promise<string> => {
  console.log("将图片 URL 转换为 base64（支持缓存）:", imageUrl);
  if (!imageUrl) {
    throw new Error("图片 URL 不能为空");
  }

  // 如果已经是 base64，直接返回
  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  // 对于以 ai/ 开头的相对路径，先检查缓存
  if (imageUrl.startsWith("ai/")) {
    try {
      const cachedImageData = await imageCache.getImageData(imageUrl);

      if (cachedImageData) {
        // 从缓存获取原图并转为 base64
        const base64 = await blobManager.blobToBase64(
          cachedImageData.originalBlob
        );
        console.log(`从缓存加载图片：${imageUrl}`);
        return base64;
      }

      // 缓存中没有，需要下载并缓存
      console.log(`缓存中未找到图片，正在下载：${imageUrl}`);
      const response: any = await downloadFile({ objectName: imageUrl });

      // 将 Blob 转为 base64
      const base64 = await blobManager.blobToBase64(response);

      // 存储到缓存（同时存储原图和压缩图，这里简化处理，存储两份相同的）
      await imageCache.storeImage(imageUrl, response, response);

      console.log(`图片已下载并缓存：${imageUrl}`);
      return base64;
    } catch (error) {
      console.error(`图片处理失败 (${imageUrl}):`, error);
      throw new Error(`图片 ${imageUrl} 处理失败：${error.message}`);
    }
  }

  // 如果是完整的 http/https URL，使用原有的 Image 方式转换
  // if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
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
  // }

  // 其他情况（不支持的路径格式），抛出错误
  // throw new Error(`不支持的图片路径格式：${imageUrl}`);
};

/**
 * 构建 AI 生成的 prompt
 */
const buildPrompt = (rowData: Record<string, any>) => {
  let imageCount = 0;
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
      const eraseRef = rowData[`${item.id}_eraseRef`];

      if (aiRef && imageData) {
        imageCount++;
        return {
          ...baseItem,
          image: `第 ${imageCount + 1} 张图`
        };
      }
      if (!imageData && !eraseRef) {
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

  // 批量模式：只过滤掉是否抹除为 "是" 的 type="image" 的元素
  const filteredImageConfig = props.imageConfig.filter(item => {
    if (item.type !== "image") return true;
    // 保留不需要抹除的 image 元素
    const eraseRefKey = `${item.id}_eraseRef`;
    return !rowData[eraseRefKey];
  });

  const filteredConfig = config.filter(item => {
    if (item.type !== "image") return true;
    // 保留不需要抹除的 image 元素
    const eraseRefKey = `${item.id}_eraseRef`;
    return !rowData[eraseRefKey];
  });

  let prompt = FORMAT_PROMPT(
    JSON.stringify(filteredImageConfig),
    JSON.stringify(filteredConfig),
    PromptType.SelectiveAIPro
  );

  // 添加必做事项（如果有）
  if (props.imageConfigFirstPrompt) {
    prompt += "\n" + props.imageConfigFirstPrompt;
  }

  // 如果有备注字段，添加到 prompt 中
  if (rowData.remark) {
    prompt += "\n" + rowData.remark;
  }

  return prompt;
};

/**
 * 收集需要引用的图片素材
 */
const collectImageUrls = (rowData: Record<string, any>): string[] => {
  const urls: string[] = [];

  console.log(
    "collectImageUrls",
    props.imageConfig,
    rowData,
    props.materialList
  );
  props.imageConfig.forEach(item => {
    if (item.type === "image") {
      const imageData = rowData[`${item.id}_image`];
      const aiRef = rowData[`${item.id}_aiRef`];

      if (aiRef && imageData) {
        if (props.materialList["componentMaterial"]) {
          const material = props.materialList["componentMaterial"].find(
            (mat: any) => mat.objectName === imageData || mat.url === imageData
          );
          if (material && material.objectName) {
            urls.push(material.objectName);
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

    //#region 两套模型逻辑
    let params = {};
    let response = null;
    if (
      aiModel.value === "wan2.7-image" ||
      aiModel.value === "wan2.7-image-pro"
    ) {
      params = {
        model: aiModel.value,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: buildPrompt(row)
                },
                {
                  image: base64Url1_
                },
                ...base64MaterialUrls.map(url => ({ image: url }))
              ]
            }
          ]
        },
        parameters: {
          size: "2K",
          n: 1,
          watermark: false,
          thinking_mode: true
        }
      };
      console.log("params:", params);
      // return;
      response = await transferDrawAliyun({
        urlParam: JSON.stringify(params)
      });
      console.log("response:", response);

      if (response.code === 200 && response.data) {
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
          resultImg.src = response.data;
        });
      } else {
        throw new Error(response?.msg || "生成失败");
      }
    } else {
      // 切换接口为 qnaigc模型
      const processedImageList = [base64Url1_, ...base64MaterialUrls].map(
        url => {
          return url.replace(
            "data:application/json;base64,",
            "data:image/png;base64,"
          );
        }
      );

      params = {
        model: aiModel.value,
        prompt: buildPrompt(row),
        image: processedImageList,
        image_config: {
          aspect_ratio: "auto",
          image_size: "4K"
        }
      };
      console.log("通用模型请求参数：", params);

      response = await transferDrawQnaigc({
        urlParam: JSON.stringify(params)
      });
      console.log("通用模型响应：", response);

      if (response.code === 200 && response.data) {
        const dataArray =
          typeof response.data === "string"
            ? JSON.parse(response.data)
            : response.data;

        if (dataArray?.[0]?.b64_json) {
          const resultBase64 = "data:image/png;base64," + dataArray[0].b64_json;
          return resultBase64;
        } else {
          throw new Error("生成失败: 未获取到图片数据");
        }
      } else {
        throw new Error(response?.msg || "生成失败");
      }
    }
    // {
    //   params = {
    //     model: aiModel.value,
    //     prompt: buildPrompt(row),
    //     aspectRatio: "auto",
    //     imageSize: "4K",
    //     shutProgress: false,
    //     urls: [base64Url1_, ...base64MaterialUrls]
    //     // urls: [base64Url1_]
    //   };
    //   console.log("params:", params);
    //   // return;
    //   response = await transferDraw({
    //     urlParam: JSON.stringify(params)
    //   });
    //   console.log("response:", response);
    //   if (response.code === 200 && response.data?.[0]) {
    //     // 将结果图片转为 base64
    //     const resultImg = new Image();
    //     resultImg.crossOrigin = "anonymous";

    //     return new Promise<string>((resolve, reject) => {
    //       resultImg.onload = () => {
    //         const canvas = document.createElement("canvas");
    //         canvas.width = resultImg.width;
    //         canvas.height = resultImg.height;
    //         const ctx = canvas.getContext("2d");
    //         if (!ctx) {
    //           reject(new Error("无法获取 canvas 上下文"));
    //           return;
    //         }
    //         ctx.drawImage(resultImg, 0, 0);
    //         const base64 = canvas.toDataURL("image/png");
    //         resolve(base64);
    //       };
    //       resultImg.onerror = () => {
    //         reject(new Error("结果图片加载失败"));
    //       };
    //       resultImg.src = response.data[0];
    //     });
    //   } else {
    //     throw new Error(response?.msg || "生成失败");
    //   }
    // }
    //#endregion
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
  currentGeneratingIndex.value = 0;
  generatedResults.value = {};

  const total = importedDataList.value.length;
  const successCount = ref(0);
  const failCount = ref(0);

  for (let i = 0; i < importedDataList.value.length; i++) {
    const row = importedDataList.value[i];
    currentGeneratingId.value = row._id;
    currentGeneratingIndex.value = i + 1;

    try {
      const resultBase64 = await generateSingleImage(row);
      generatedResults.value[row._id] = [resultBase64];
      successCount.value++;
      generatingProgress.value = Math.round(((i + 1) / total) * 100);
      ElMessage.success(`第 ${i + 1} 张图片生成成功`);
    } catch (error: any) {
      failCount.value++;
      generatingProgress.value = Math.round(((i + 1) / total) * 100);
      ElMessage.error(`第 ${i + 1} 张图片生成失败：${error.message}`);
      generatedResults.value[row._id] = [];
    }

    // 添加小延迟避免请求过快
    if (i < importedDataList.value.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 生成完成后保持 100% 显示一小会儿
  await new Promise(resolve => setTimeout(resolve, 500));

  batchGenerating.value = false;
  currentGeneratingId.value = null;
  currentGeneratingIndex.value = 0;
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
  size: number = 800,
  fixedHeight?: number,
  maxSizeKB?: number,
  preferPNG?: boolean
): Promise<string | null> => {
  try {
    console.log("\n=== 开始生成合成图片 ===");
    console.log("背景图 URL:", imageUrl);
    console.log("行数据:", rowData);
    console.log("图片配置:", imageConfig);
    console.log("指定宽度:", size);
    console.log("指定高度:", fixedHeight || "自适应");

    const bgImg = new Image();
    await new Promise<void>((resolve, reject) => {
      bgImg.onload = () => resolve();
      bgImg.onerror = () => reject(new Error("背景图加载失败"));
      bgImg.src = imageUrl;
    });

    let canvasWidth = size;
    let canvasHeight: number;

    if (fixedHeight) {
      canvasHeight = fixedHeight;
      console.log(`使用指定高度: ${canvasHeight}px`);
    } else {
      canvasHeight = Math.round(size * (bgImg.height / bgImg.width));
      console.log(`自适应高度: ${canvasHeight}px (基于宽度 ${size}px)`);
    }

    console.log(`画布尺寸: ${canvasWidth} × ${canvasHeight}`);

    const imageConfigs = imageConfig.filter(item => item.type === "image");
    console.log("图片类型配置数量:", imageConfigs.length);

    const loadImageTasks: Array<{
      config: any;
      base64Data: string;
      imgElement: HTMLImageElement;
    }> = [];

    for (const config of imageConfigs) {
      const imageKey = `${config.id}_image`;
      const aiRefKey = `${config.id}_aiRef`;
      const imageData = rowData[imageKey];
      const isAiReferenced = rowData[aiRefKey] === true;

      console.log(`\n处理配置：${config.name}`, {
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
              let materialUrl = material.url || material.objectName;

              console.log(`使用素材 URL: ${materialUrl}`);

              if (!materialUrl.startsWith("http")) {
                const { downloadFile } = await import("@/api/aiDraw");
                const blob: any = await downloadFile({
                  objectName: materialUrl
                });
                base64Data = await blobManager.blobToBase64(blob);
                console.log(`✓ 从素材库下载并转换成功：${config.name}`);
              } else {
                const response = await fetch(materialUrl);
                if (!response.ok) {
                  throw new Error(`HTTP error: ${response.status}`);
                }
                const blob = await response.blob();
                base64Data = await blobManager.blobToBase64(blob);
                console.log(`✓ 从 HTTP URL 加载成功：${config.name}`);
              }
            } else if (imageData.startsWith("http")) {
              const response = await fetch(imageData);
              if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
              }
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
          const img = new Image();
          await new Promise<void>(resolve => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = base64Data;
          });

          loadImageTasks.push({
            config,
            base64Data,
            imgElement: img
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

    // 如果没有需要合成的素材，直接返回原图片
    if (loadImageTasks.length === 0) {
      console.log("⊘ 没有可合成的素材元素，直接返回原图片");
      return imageUrl;
    }

    const elements: Array<{
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (const task of loadImageTasks) {
      const { config, imgElement } = task;

      let elementWidth: number;
      let elementHeight: number;
      let imgRatio: number;
      let offsetX = 0;
      let offsetY = 0;

      if (config.rect?.width && config.rect?.height) {
        const targetWidth = config.rect.width * canvasWidth;
        const targetHeight = config.rect.height * canvasHeight;

        imgRatio = imgElement.width / imgElement.height;
        const targetRatio = targetWidth / targetHeight;

        if (imgRatio > targetRatio) {
          elementWidth = targetWidth;
          elementHeight = targetWidth / imgRatio;
          offsetY = (targetHeight - elementHeight) / 2;
        } else {
          elementHeight = targetHeight;
          elementWidth = targetHeight * imgRatio;
          offsetX = (targetWidth - elementWidth) / 2;
        }
      } else {
        elementWidth = Math.min(imgElement.width, 200);
        elementHeight = Math.min(imgElement.height, 200);
        imgRatio = imgElement.width / imgElement.height;
      }

      const element = {
        src: task.base64Data,
        x:
          (config.rect?.x * canvasWidth || 50 + elements.length * 20) + offsetX,
        y:
          (config.rect?.y * canvasHeight || 50 + elements.length * 20) +
          offsetY,
        width: elementWidth,
        height: elementHeight
      };
      elements.push(element);
      console.log(`✓ 添加元素到数组：${config.name}`, element, {
        originalSize: `${imgElement.width}x${imgElement.height}`,
        elementSize: `${elementWidth.toFixed(2)}x${elementHeight.toFixed(2)}`,
        ratio: imgRatio,
        offset: `${offsetX.toFixed(2)}, ${offsetY.toFixed(2)}`
      });
    }

    console.log(`\n最终加载的元素数量：${elements.length}`);
    console.log("元素列表:", elements);

    const hasGiftElement = loadImageTasks.some(
      task => task.config.name === "赠品"
    );

    if (!hasGiftElement) {
      const productImageTask = loadImageTasks.find(
        task => task.config.name === "商品图"
      );

      if (productImageTask) {
        const productElementIndex = elements.findIndex(
          (_, index) => loadImageTasks[index].config.name === "商品图"
        );

        if (productElementIndex !== -1) {
          // const containerWidth = 700;
          const productElement = elements[productElementIndex];
          productElement.x = (canvasWidth - productElement.width) / 2;

          console.log(
            `✓ 赠品不存在，商品图已居中，新X坐标: ${productElement.x.toFixed(2)}`
          );
        }
      }
    }

    console.log("开始 Canvas 合成...");
    const compositeBase64 = await compositeImage(
      imageUrl,
      elements,
      canvasWidth,
      canvasHeight,
      maxSizeKB || 0,
      preferPNG || false
    );
    console.log("✓ Canvas 合成成功");
    return compositeBase64;
  } catch (error) {
    console.error("✗ 根据配置生成图片失败:", error);
    throw error;
  }
};

/**
 * 打开预览对话框（先检查结果图）
 */
const exportAllResults = async () => {
  if (importedDataList.value.length === 0) {
    ElMessage.warning("没有可导出的数据");
    return;
  }

  // 检查是否有生成结果
  const hasResults = importedDataList.value.some(
    row => generatedResults.value[row._id]?.length > 0
  );
  if (!hasResults) {
    ElMessage.warning("请先生成图片后再导出");
    return;
  }

  showPreviewDialog.value = true;
};

/**
 * 在预览对话框中重新生成单张图片
 */
const regenerateInPreview = async (index: number) => {
  const row = importedDataList.value[index];
  regeneratingIndex.value = index;

  try {
    ElMessage.info(`正在重新生成第 ${index + 1} 张图片...`);

    // 复制行数据，添加临时备注
    const rowWithRemark = { ...row };
    if (previewRemarks.value[index] && previewRemarks.value[index].trim()) {
      // 如果已有备注，追加新备注
      if (rowWithRemark.remark) {
        rowWithRemark.remark =
          rowWithRemark.remark + "；" + previewRemarks.value[index].trim();
      } else {
        rowWithRemark.remark = previewRemarks.value[index].trim();
      }
    }

    const resultBase64 = await generateSingleImage(rowWithRemark);
    generatedResults.value[row._id] = [resultBase64];

    ElMessage.success(`第 ${index + 1} 张图片重新生成成功`);
  } catch (error: any) {
    ElMessage.error(`第 ${index + 1} 张图片重新生成失败：${error.message}`);
  } finally {
    regeneratingIndex.value = null;
  }
};

/**
 * 从预览对话框确认导出
 */
const confirmFromPreview = () => {
  showPreviewDialog.value = false;
  showExportDialog.value = true;
};

/**
 * 获取语义化的配置显示对象
 */
const getConfigDisplay = (row: Record<string, any>) => {
  const display: Record<string, any> = {};

  for (const key in row) {
    if (key === "_id" || key === "remark") continue;

    // 处理键名，去掉前面的 id 部分，只保留后面的标签
    let label = key;
    const underscoreIndex = key.indexOf("_");
    if (underscoreIndex !== -1) {
      label = key.substring(underscoreIndex + 1);
    }

    // 处理值
    let value = row[key];
    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === "boolean") {
      if (!value) continue; // 不显示"否"的值
      value = "是";
    }

    // 只显示有意义的值
    if (value !== "" && value !== "否") {
      display[label] = value;
    }
  }

  // 添加备注（如果有）
  if (row.remark) {
    display["原备注"] = row.remark;
  }

  return display;
};

/**
 * AI校验单张图片
 */
const validateSingleImage = async (index: number) => {
  const row = importedDataList.value[index];
  const resultImageUrl = generatedResults.value[row._id]?.[0];

  if (!resultImageUrl) {
    ElMessage.warning(`第 ${index + 1} 张图片没有生成结果，无法校验`);
    return;
  }

  validatingIndex.value = index;

  try {
    // 构建校验提示词 - 只提取文字类型的配置，忽略图片类型（图片是后面自己拼接的）
    const configDisplay = getConfigDisplay(row);

    // 只把文字类型的配置整理出来
    let configText = "";

    // 先从 props.imageConfig 中找出哪些是 text 类型的
    const textConfigKeys = new Set<string>();
    props.imageConfig.forEach(item => {
      if (item.type === "text" && item.content) {
        item.content.forEach(field => {
          // 生成对应的 key，和 getConfigDisplay 里的逻辑一致
          const underscoreIndex = `${item.id}_${field.label}`.indexOf("_");
          if (underscoreIndex !== -1) {
            const displayKey = `${item.id}_${field.label}`.substring(
              underscoreIndex + 1
            );
            textConfigKeys.add(displayKey);
          }
        });
      }
    });

    // 只添加文字类型的配置
    for (const key in configDisplay) {
      if (key !== "原备注" && textConfigKeys.has(key)) {
        configText += `${key}：${configDisplay[key]}\n`;
      }
    }

    const validatePrompt = `你是一个严格的广告图审核助手，负责对生成的图片进行质量把关。

【重要原则】
1. **只检查文字！**：图片是分两步制作的 - AI 只负责改文字区域，产品图片是后面人工拼接的，所以不要去检查产品图有没有显示！
2. 重点关注【预期配置】中列出的文字内容。
3. 对于未在配置中列出的区域，如果它们保持了原有的模板样式，请忽略；但如果出现了明显的视觉错误（如遮挡、乱绘），必须指出。
4. **不要因为空白区域报错**：空白区域是正常的，是留给后面拼接产品图用的！

【预期配置的文字信息】
${configText}

【审核维度】
1. **文字内容准确性**：
   - 检查配置中的文字是否正确显示，无错别字、无多余符号（如乱码、多余货币符号）。

2. **排版质量（关键）**：
   - 检查文字是否被截断、显示不全。
   - **遮挡检查**：检查目标文字是否溢出并遮挡了旁边的元素（如数字过大盖住了单位"起"、"元"）。
   - 如果配置中的文字较长，检查是否进行了合理的缩放以适应版面。

3. **画面纯净度**：
   - 检查是否存在明显的AI幻觉产物（如奇怪的装饰块、不该有的矩形框）。
   - 注意：模板原有的背景纹理、装饰元素不算错误，只有明显的违和生成物才算问题。
   - 再次强调：空白区域是正常的，是留给后面拼接产品图用的，不要因为空白报错！

【返回格式】
请**严格**返回纯 JSON 字符串，不要包含 markdown 标记（如 \`\`\`json），不要包含任何解释性文字。
返回结构如下：
{
  "passed": true,
  "issues": [],
  "suggestion": "审核通过"
}
如果存在问题：
{
  "passed": false,
  "issues": ["问题1：数字'200'字号过大，遮挡了右侧的'起'字", "问题2：图片中间出现了不存在的黑色方块"],
  "suggestion": "建议缩小数字字号，去除多余图形"
}
`;

    // 调用AI校验 - 使用新接口
    const params = {
      model: "qwen3.7-plus",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: resultImageUrl
              }
            },
            {
              type: "text",
              text: validatePrompt
            }
          ]
        }
      ],
      enable_thinking: false
    };

    const response = await transferCodingPlan({
      urlParam: JSON.stringify(params)
    });

    if (response.code === 200) {
      // 尝试解析AI返回的JSON
      let result;
      try {
        let content = response.data || response;
        let responseData;

        if (typeof content === "string") {
          try {
            responseData = JSON.parse(content);
          } catch {
            responseData = { content };
          }
        } else {
          responseData = content;
        }

        // 提取实际的文本内容
        let aiText =
          responseData?.output?.choices?.[0]?.message?.content?.[0]?.text ||
          responseData?.output?.choices?.[0]?.message?.content ||
          responseData?.choices?.[0]?.message?.content ||
          responseData?.message?.content ||
          responseData?.content ||
          responseData;

        // 如果 content 是数组，处理它
        if (Array.isArray(aiText)) {
          aiText =
            aiText.find(item => item.type === "text")?.text ||
            aiText[0]?.text ||
            aiText;
        }

        console.log("AI返回的原始文本:", aiText);

        if (!aiText) {
          throw new Error("未找到 AI 返回的文本内容");
        }

        // 从 AI 文本中提取 JSON（处理 ```json 包裹的情况）
        let jsonStr = "";
        if (typeof aiText === "string") {
          const jsonBlockMatch = aiText.match(/```json\s*([\s\S]*?)```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            jsonStr = jsonBlockMatch[1].trim();
          } else {
            // 尝试直接解析整个字符串
            jsonStr = aiText.trim();
          }
        } else if (typeof aiText === "object" && aiText.passed !== undefined) {
          // 如果 aiText 本身就是我们需要的对象
          result = aiText;
        }

        if (jsonStr && !result) {
          try {
            result = JSON.parse(jsonStr);
          } catch (parseError) {
            console.error("JSON 解析失败:", parseError, "原始字符串:", jsonStr);
            throw new Error("解析 JSON 失败");
          }
        }
      } catch (e) {
        // 如果解析失败，做一个默认的结果
        console.error("解析AI返回失败:", e);
        result = {
          passed: false,
          issues: ["AI返回格式异常，需要人工检查"],
          suggestion: "请人工检查图片"
        };
      }

      validationResults.value[index] = result;

      if (result.passed) {
        ElMessage.success(`第 ${index + 1} 张图片校验通过`);
      } else {
        ElMessage.warning(
          `第 ${index + 1} 张图片发现问题：${result.issues[0]}`
        );
      }
    } else {
      throw new Error(response?.msg || "AI校验失败");
    }
  } catch (error: any) {
    console.error("AI校验失败:", error);
    ElMessage.error(`第 ${index + 1} 张图片校验失败：${error.message}`);
  } finally {
    validatingIndex.value = null;
  }
};

/**
 * AI校验全部图片
 */
const validateAllImages = async () => {
  const hasResults = importedDataList.value.some(
    row => generatedResults.value[row._id]?.length > 0
  );

  if (!hasResults) {
    ElMessage.warning("请先生成图片后再校验");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要使用AI校验所有生成的图片吗？`,
      "AI校验确认",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "info"
      }
    );
  } catch {
    return;
  }

  isAllValidating.value = true;
  validationResults.value = {};

  try {
    for (let i = 0; i < importedDataList.value.length; i++) {
      const row = importedDataList.value[i];
      if (generatedResults.value[row._id]?.[0]) {
        await validateSingleImage(i);
        // 加个小延迟避免请求过快
        if (i < importedDataList.value.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    }

    // 统计结果
    const passedCount = Object.values(validationResults.value).filter(
      r => r.passed
    ).length;
    const failedCount = Object.values(validationResults.value).filter(
      r => !r.passed
    ).length;

    ElMessage.success(
      `AI校验完成！通过 ${passedCount} 张，发现问题 ${failedCount} 张`
    );
  } catch (error) {
    console.error("批量校验失败:", error);
  } finally {
    isAllValidating.value = false;
  }
};

const confirmExport = async () => {
  showExportDialog.value = false;

  try {
    const sizeTip = exportMaxSizeMB.value
      ? `最大 ${exportMaxSizeMB.value}MB`
      : "不限制大小";
    const heightTip = exportHeight.value
      ? `高度：${exportHeight.value}px`
      : "高度自适应";
    const formatTip = exportMaxSizeMB.value
      ? exportPreferPNG.value
        ? "，优先 PNG"
        : "，默认 JPEG"
      : "，PNG 格式";

    await ElMessageBox.confirm(
      `确定要批量导出 ${importedDataList.value.length} 张图片吗？（${heightTip}，${sizeTip}${formatTip}）`,
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
          exportWidth.value,
          exportHeight.value || undefined,
          exportMaxSizeMB.value ? exportMaxSizeMB.value * 1024 : undefined,
          exportPreferPNG.value
        );

        console.log("批量导出合成结果图:", compositeBase64);

        if (compositeBase64) {
          // 查找rowData对象里是否有属性名带有产品名称的属性
          const productNameKey = Object.keys(rowData).find(key =>
            key.includes("产品名称")
          );
          // 根据 base64 头判断图片格式，选择正确的扩展名
          const isPNG = compositeBase64.startsWith("data:image/png");
          const extension = isPNG ? "png" : "jpg";

          // 构建文件名：如果有产品名称，就用"产品名称_序号"的格式，防止重名覆盖
          let fileName: string;
          if (productNameKey && rowData[productNameKey]) {
            fileName = `${rowData[productNameKey]}_${i + 1}.${extension}`;
          } else {
            fileName = `AI_Image_${i + 1}.${extension}`;
          }

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
          <div class="flex justify-between items-center flex-wrap">
            <div>批量生成模式</div>
            <div class="flex items-center flex-wrap">
              <div>
                <el-select
                  v-model="aiModel"
                  placeholder="请选择 AI 模型"
                  style="width: 180px; margin-right: 10px"
                  size="small"
                >
                  <el-option
                    v-for="item in AI_MODEL_OPTIONS"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
              <div class="flex items-center">
                <el-button
                  color="#217346"
                  size="small"
                  :icon="Download"
                  @click="exportConfig"
                >
                  生成配置表
                </el-button>
                <el-button
                  color="#427AED"
                  size="small"
                  :icon="Upload"
                  @click="importConfig"
                >
                  导入配置表
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
      <!-- 批量生成进度条区域 -->
      <div v-if="batchGenerating" class="progress-container mb-4">
        <div class="progress-title">
          目前生成序号 {{ currentGeneratingIndex }}，进度
          {{ currentGeneratingIndex }}/{{ importedDataList.length }}
        </div>
        <el-progress
          :percentage="generatingProgress"
          :stroke-width="12"
          :show-text="true"
          :text-inside="false"
          color="#534CE7"
          class="animated-progress"
        />
      </div>

      <div class="flex items-center justify-between mb-4 flex-wrap">
        <div class="text-base font-bold text-gray-800">
          配置表
          <span class="text-sm text-gray-500 font-normal">
            (点击右侧生成配置表，支持多次导入配置表，导出名称默认取带有产品名称的属性值)
          </span>
        </div>
        <div class="flex items-center gap-2">
          <el-button
            color="#CC6600"
            type="primary"
            size="small"
            :disabled="!hasAnyResult || batchGenerating"
            @click="exportAllResults"
          >
            📥 导出全部结果图
          </el-button>
          <el-button
            type="danger"
            size="small"
            :disabled="importedDataList.length === 0"
            :icon="Delete"
            @click="clearAll"
          >
            清空全部
          </el-button>
          <el-button
            color="#534CE7"
            type="primary"
            size="small"
            :loading="batchGenerating"
            :disabled="importedDataList.length === 0"
            @click="handleBatchGenerate"
          >
            ✨ 开始绘制
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
                    class="rotating-progress-circle"
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
            align="center"
          >
            <template #default="{ row }">
              <div v-if="col.type === 'image' && row[col.prop]">
                <div>
                  <p class="text-xs w-full">{{ row[col.prop] }}</p>
                  <OnlineImg :url="row[col.prop]" size="70px" />
                </div>
              </div>
              <div v-else v-text="renderCell(row, { property: col.prop })" />
            </template>
          </el-table-column>

          <!-- 操作列 -->
          <el-table-column
            label="操作"
            width="110"
            fixed="right"
            align="center"
          >
            <template #default="{ $index, row }">
              <el-tooltip
                effect="dark"
                content="重新生成"
                placement="top"
                :show-after="300"
              >
                <el-button
                  text
                  type="primary"
                  size="small"
                  :icon="Refresh"
                  @click="regenerateRow($index, row)"
                />
              </el-tooltip>
              <el-button
                text
                type="danger"
                size="small"
                :icon="Delete"
                @click="deleteRow($index)"
              />
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

  <!-- 结果图预览检查对话框 -->
  <el-dialog
    v-model="showPreviewDialog"
    title="检查生成结果图"
    width="1400px"
    :close-on-click-modal="false"
  >
    <div class="preview-dialog-content">
      <div class="mb-4 flex items-center justify-between">
        <div class="text-sm text-gray-600">
          请检查以下生成的结果图，旁边是配置信息方便核对，如有需要可添加备注后点击重新生成，确认无误后点击"确定导出"
        </div>
        <div class="flex items-center gap-3">
          <div v-if="Object.keys(validationResults).length > 0" class="text-sm">
            <span class="text-green-600">
              ✓ 通过:
              {{
                Object.values(validationResults).filter(r => r.passed).length
              }}
            </span>
            <span class="mx-2">|</span>
            <span class="text-red-500">
              ✗ 问题:
              {{
                Object.values(validationResults).filter(r => !r.passed).length
              }}
            </span>
          </div>
          <el-button
            type="warning"
            :icon="CircleCheck"
            :loading="isAllValidating"
            @click="validateAllImages"
          >
            {{ isAllValidating ? "AI校验中..." : "AI校验" }}
          </el-button>
        </div>
      </div>

      <div
        class="preview-images-list"
        style="max-height: 700px; overflow-y: auto"
      >
        <div
          v-for="(row, index) in importedDataList"
          :key="row._id"
          class="preview-item flex gap-4 p-5 mb-4 bg-gray-50 rounded-lg"
          :class="{
            'border-2 border-green-400 bg-green-50':
              validationResults[index]?.passed,
            'border-2 border-red-400 bg-red-50':
              validationResults[index] && !validationResults[index]?.passed
          }"
        >
          <div class="flex flex-col items-center gap-2">
            <div
              class="preview-number flex items-center justify-center w-12 h-12 bg-purple-600 text-white rounded-full font-bold text-xl flex-shrink-0"
            >
              {{ index + 1 }}
            </div>

            <!-- 校验结果标识 -->
            <div
              v-if="validationResults[index]"
              class="flex flex-col items-center"
            >
              <div
                v-if="validationResults[index].passed"
                class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold"
              >
                ✓
              </div>
              <div
                v-else
                class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-xl font-bold"
              >
                ✗
              </div>
            </div>

            <!-- 单个校验按钮 -->
            <el-button
              v-else
              type="info"
              size="small"
              :loading="validatingIndex === index"
              class="text-xs"
              @click="validateSingleImage(index)"
            >
              校验
            </el-button>
          </div>

          <div class="preview-image-config-wrapper flex-[2.5] flex gap-4">
            <div class="flex-1">
              <div
                v-if="regeneratingIndex === index"
                class="flex items-center justify-center w-full h-96 bg-gray-200 rounded-lg"
              >
                <el-icon class="is-loading text-7xl text-purple-600"
                  ><loading
                /></el-icon>
              </div>
              <img
                v-else-if="generatedResults[row._id]?.[0]"
                :src="generatedResults[row._id][0]"
                :alt="`第${index + 1}张结果图`"
                class="w-full h-96 object-contain border border-gray-200 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                @click="handlePreviewImage(generatedResults[row._id][0], row)"
              />
              <div
                v-else
                class="flex items-center justify-center w-full h-96 bg-gray-100 rounded-lg text-gray-400 text-lg"
              >
                暂无结果
              </div>
            </div>

            <div
              class="preview-config-wrapper w-56 flex-shrink-0 flex flex-col h-96"
            >
              <!-- 配置信息 -->
              <div
                class="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col flex-1"
              >
                <div
                  class="px-3 pt-3 pb-2 bg-white border-b border-gray-100 flex-shrink-0"
                >
                  <h4 class="font-bold text-gray-800 text-xs">配置信息</h4>
                </div>
                <div class="px-3 pb-3 overflow-y-auto flex-1">
                  <div class="config-items space-y-1 pt-1">
                    <div
                      v-for="(value, key) in getConfigDisplay(row)"
                      :key="key"
                      class="config-item flex gap-1"
                    >
                      <span
                        class="config-label font-medium text-gray-500 w-14 flex-shrink-0 text-right text-[10px]"
                        >{{ key }}：</span
                      >
                      <span
                        class="config-value text-gray-700 break-all text-[10px]"
                        >{{ value }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>

              <!-- AI校验结果 -->
              <div
                v-if="validationResults[index]"
                class="rounded-lg border p-3 mt-3 flex-shrink-0"
                :class="
                  validationResults[index].passed
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                "
              >
                <h4
                  class="font-bold mb-2 text-xs"
                  :class="
                    validationResults[index].passed
                      ? 'text-green-800'
                      : 'text-red-800'
                  "
                >
                  {{
                    validationResults[index].passed
                      ? "✓ 校验通过"
                      : "✗ 发现问题"
                  }}
                </h4>

                <div
                  v-if="
                    !validationResults[index].passed &&
                    validationResults[index].issues.length > 0
                  "
                  class="mb-2"
                >
                  <p class="text-xs text-red-700 font-medium mb-1">
                    问题列表：
                  </p>
                  <ul
                    class="text-[10px] text-red-600 list-disc list-inside space-y-1"
                  >
                    <li
                      v-for="(issue, issueIndex) in validationResults[index]
                        .issues"
                      :key="issueIndex"
                    >
                      {{ issue }}
                    </li>
                  </ul>
                </div>

                <div v-if="validationResults[index].suggestion">
                  <p class="text-[10px] text-gray-600 font-medium mb-1">
                    建议：
                  </p>
                  <p
                    class="text-[10px]"
                    :class="
                      validationResults[index].passed
                        ? 'text-green-700'
                        : 'text-red-700'
                    "
                  >
                    {{ validationResults[index].suggestion }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            class="preview-right-wrapper w-52 flex-shrink-0 flex flex-col gap-4"
          >
            <div
              class="remark-section bg-white p-3 rounded-lg border border-gray-200"
            >
              <label class="block text-xs font-medium text-gray-700 mb-2">
                生成效果备注（重新生成时生效）
              </label>
              <el-input
                v-model="previewRemarks[index]"
                type="textarea"
                :rows="4"
                placeholder="例如：颜色调亮一点，风格更写实..."
                class="text-xs"
                size="small"
              />
            </div>

            <div class="preview-action flex justify-end">
              <el-button
                type="primary"
                size="default"
                :icon="Refresh"
                :loading="regeneratingIndex === index"
                @click="regenerateInPreview(index)"
              >
                重新生成
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showPreviewDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmFromPreview"
          >确定导出</el-button
        >
      </span>
    </template>
  </el-dialog>

  <el-dialog
    v-model="showExportDialog"
    title="批量导出设置"
    width="450px"
    :close-on-click-modal="false"
  >
    <div class="export-dialog-content">
      <el-form label-width="100px">
        <el-form-item label="导出宽度">
          <el-input-number
            v-model="exportWidth"
            :min="100"
            :max="4096"
            :step="100"
            placeholder="请输入宽度"
            style="width: 100%"
            controls-position="right"
          />
          <div class="text-xs text-gray-500 mt-1">
            范围：100-4096px，默认 1440px
          </div>
        </el-form-item>
        <el-form-item label="导出高度">
          <el-input-number
            v-model="exportHeight"
            :min="100"
            :max="4096"
            :step="100"
            placeholder="留空自适应"
            style="width: 100%"
            controls-position="right"
          />
          <div class="text-xs text-gray-500 mt-1">
            范围：100-4096px，留空则根据宽度自适应
          </div>
        </el-form-item>
        <el-form-item label="最大大小(MB)">
          <el-input-number
            v-model="exportMaxSizeMB"
            :min="0.5"
            :max="10"
            :step="0.5"
            :precision="1"
            placeholder="留空不压缩"
            style="width: 100%"
            controls-position="right"
          />
          <div class="text-xs text-gray-500 mt-1">
            范围：0.5-10MB，留空则不限制大小（PNG 格式）
          </div>
        </el-form-item>
        <el-form-item v-if="exportMaxSizeMB" label="优先 PNG">
          <el-switch v-model="exportPreferPNG" />
          <span class="text-xs text-gray-500 ml-2">
            开启后优先尝试 PNG 压缩，PNG 无法压缩到目标大小时才使用 JPEG
          </span>
        </el-form-item>
        <el-form-item label="导出数量">
          <span>{{ importedDataList.length }} 张图片</span>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showExportDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmExport"> 确认导出 </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<style scoped>
.empty-data-tip {
  color: #909399;
}

.preview-dialog-content {
  padding: 10px 0;
}

.preview-item {
  transition: all 0.2s ease;
}

.preview-item:hover {
  background-color: #f0f4ff !important;
}

.preview-number {
  box-shadow: 0 2px 8px rgba(83, 76, 231, 0.3);
}

.preview-image-wrapper {
  position: relative;
}

.preview-right-wrapper {
  position: relative;
}

.preview-config-wrapper {
  position: relative;
}

.config-item {
  padding: 2px 0;
}

.remark-section {
  position: relative;
}

.progress-container {
  background: linear-gradient(135deg, #f0f4ff 0%, #f5f7fa 100%);
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(83, 76, 231, 0.1);
  border: 1px solid rgba(83, 76, 231, 0.1);
  animation: fadeIn 0.3s ease-out;
}

.progress-title {
  font-size: 14px;
  font-weight: 600;
  color: #534ce7;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-title::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: #534ce7;
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.animated-progress :deep(.el-progress-bar__outer) {
  border-radius: 6px;
  overflow: hidden;
  background-color: #e6e9f0;
}

.animated-progress :deep(.el-progress-bar__inner) {
  border-radius: 6px;
  background: linear-gradient(90deg, #534ce7 0%, #7a6ff0 100%);
  transition: width 0.4s ease-out;
  position: relative;
  overflow: hidden;
}

.animated-progress :deep(.el-progress-bar__inner::after) {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmer 2s infinite;
}

.animated-progress :deep(.el-progress__text) {
  font-size: 14px;
  font-weight: 600;
  color: #534ce7;
}

.rotating-progress-circle :deep(.el-progress-circle__track),
.rotating-progress-circle :deep(.el-progress-circle__path) {
  animation: rotate 2s linear infinite;
  transform-origin: center;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
