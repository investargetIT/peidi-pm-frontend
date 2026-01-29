import Axios from "axios";
import { pingIPUseXHR } from "@/utils/ip";
import { message } from "@/utils/message";
import { ElMessage } from "element-plus";

const USERNAME = "夏琰";
const PASSWORD = "X81y0122";

const ips = ["192.168.110.252:6001", "12.18.1.16:6001", "192.168.1.252:6001"];
const ipsName = [
  {
    url: "http://192.168.110.252:6001",
    name: "CD区"
  },
  {
    url: "http://12.18.1.16:6001",
    name: "B区"
  },
  {
    url: "http://192.168.1.252:6001",
    name: "A区"
  }
];

let uploadUrl = "http://pm.peidigroup.cn/nas";
let sid = "";

export const default_upload_url = "/web_packages/test/uploadFile";

export const testAllIPs = async () => {
  // 默认使用外网地址
  uploadUrl = "http://pm.peidigroup.cn/nas";

  // 按顺序测试内网IP，300毫秒内能ping通则使用内网地址
  for (let i = 0; i < ips.length; i++) {
    const isReachable = await pingIPUseXHR(ips[i]);
    if (isReachable) {
      uploadUrl = ipsName[i].url; // 使用当前可用的内网地址
      console.log(`使用内网地址: ${ipsName[i].name} (${ipsName[i].url})`);
      break;
    }
  }

  return new Promise((resolve, reject) => {
    resolve(chaohuilogin());
  });
};

export const chaohuilogin = () => {
  return new Promise((resolve, reject) => {
    Axios.get(
      `${uploadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`,
      {
        timeout: 1000 * 10
      }
    )
      .then((res: any) => {
        if (res?.data?.data?.sid) {
          sid = res?.data?.data?.sid;
          resolve({
            sid,
            postUrl: `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Upload&method=upload&version=2&_sid=${sid}`
          });
        }
      })
      .catch(err => {
        uploadUrl = "http://pm.peidigroup.cn/nas";
        Axios.get(
          `${uploadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`
        )
          .then(res => {
            if (res?.data?.data?.sid) {
              sid = res?.data?.data?.sid;
              resolve({
                sid,
                postUrl: `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Upload&method=upload&version=2&_sid=${sid}`
              });
            }
          })
          .catch(err => {
            message(
              "文件服务器连接异常。请联系管理员，或稍后重试:" + err.message,
              {
                type: "error"
              }
            );
          });
      });
  });
};

// 下载
export const chaohuiDownload = (filename: string = "") => {
  const messageInfo = ElMessage({
    message: `正在下载 ${filename} ，请稍后...`,
    type: "info",
    duration: 0
  });
  const encodedFilename = encodeURIComponent(filename);
  Axios.get(
    `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${"/web_packages/test/uploadFile"}/${encodedFilename}&_sid=${sid}`,
    {
      responseType: "blob",
      timeout: 0
    }
  )
    .then(res => {
      const link = document.createElement("a");
      const objectURL = window.URL.createObjectURL(res.data);
      link.href = objectURL;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectURL);
      message(`文件 ${filename} 下载完成`, {
        type: "success"
      });
    })
    .catch(err => {
      message("文件下载异常。请联系管理员，或稍后重试:" + err.message, {
        type: "error"
      });
    })
    .finally(() => {
      messageInfo.close();
    });
};
