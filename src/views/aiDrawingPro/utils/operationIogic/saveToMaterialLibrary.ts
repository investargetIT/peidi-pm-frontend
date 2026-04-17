import { ElMessage, ElMessageBox } from "element-plus";
import { getMaterialPage, newMaterial, uploadDraw } from "@/api/aiDraw";

/**
 * 保存图片到素材库的通用函数
 * @param imageUrl 图片URL地址
 * @param materialType 素材类型，如 "template", "resultImage" 等
 * @param customTypeObj 自定义类型对象，如果提供将合并到type中
 * @param defaultName 默认素材名称（可选）
 * @returns Promise<boolean> 是否保存成功
 */
export const saveToMaterialLibrary = async (
  imageUrl: string,
  materialType: string,
  customTypeObj?: Record<string, any>,
  defaultName?: string
): Promise<boolean> => {
  try {
    const result = await ElMessageBox.prompt("请输入素材名称", "保存到素材库", {
      confirmButtonText: "保存",
      cancelButtonText: "取消",
      inputValue: defaultName,
      inputPattern: /.+/,
      inputErrorMessage: "请输入素材名称",
      beforeClose: async (action, instance, done) => {
        if (action === "confirm") {
          const materialName = instance?.inputValue;
          if (!materialName) {
            ElMessage.error("请输入素材名称");
            instance.confirmButtonLoading = false;
            done();
            return;
          }

          instance.confirmButtonLoading = true;

          try {
            // 检查素材名称是否存在
            const materialListResponse: any = await getMaterialPage({
              pageNo: 1,
              pageSize: 1,
              searchStr: JSON.stringify({
                searchName: "objectName",
                searchType: "like",
                searchValue: "/" + materialName + "."
              })
            });

            if (materialListResponse.data?.total > 0) {
              ElMessage.error("素材名称已存在");
              instance.confirmButtonLoading = false;
              done();
              return;
            }

            // 将图片URL转换为File对象进行上传
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // 获取文件扩展名
            const contentType = blob.type;
            let extension = "";
            if (contentType === "image/jpeg") {
              extension = ".jpg";
            } else if (contentType === "image/png") {
              extension = ".png";
            } else if (contentType === "image/gif") {
              extension = ".gif";
            } else if (contentType === "image/webp") {
              extension = ".webp";
            } else {
              // 根据URL推断扩展名
              const urlExt = imageUrl.substring(imageUrl.lastIndexOf("."));
              extension = urlExt.includes(".") ? urlExt : ".png";
            }

            // 创建新的File对象，使用用户输入的名称
            const file = new File([blob], materialName + extension, {
              type: contentType
            });

            const formData = new FormData();
            formData.append("file", file);

            // 上传图片到服务器
            const uploadRes: any = await uploadDraw(formData);

            if (uploadRes.code === 200) {
              // 上传成功后创建新素材记录
              const newMaterialRes: any = await newMaterial({
                objectName: uploadRes.data,
                type: JSON.stringify({ mtype: materialType, ...customTypeObj })
              });

              if (newMaterialRes.code === 200) {
                ElMessage.success(`素材 "${materialName}" 已保存到素材库`);
                instance.confirmButtonLoading = false;
                done();
                return true;
              } else {
                ElMessage.error("添加素材失败:" + newMaterialRes.msg);
                instance.confirmButtonLoading = false;
                done();
                return false;
              }
            } else {
              ElMessage.error("图片上传失败:" + uploadRes.msg);
              instance.confirmButtonLoading = false;
              done();
              return false;
            }
          } catch (error: any) {
            console.error("保存到素材库失败:", error);
            ElMessage.error("保存失败: " + error.message);
            instance.confirmButtonLoading = false;
            done();
            return false;
          }
        } else {
          done();
          return true;
        }
      }
    });

    return true;
  } catch (error: any) {
    console.error("保存到素材库失败:", error);
    if (error === "cancel" || error?.type === "cancel") {
      // 用户取消操作，不显示错误消息
      return false;
    }
    ElMessage.error("保存失败: " + error.message || error);
    return false;
  }
};
