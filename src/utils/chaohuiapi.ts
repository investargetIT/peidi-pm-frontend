import Axios from "axios";
import { ElLoading } from "element-plus";
export const default_upload_url = "/web_packages/test/uploadFile";
import { message } from "@/utils/message";
import { pingIP, getYourIP, pingIP2 } from "@/utils/ip";

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const port = 5001;
const USERNAME = "夏琰";
const PASSWORD = "X81y0122";
let sid = "";
let ipThis = "";
const ips = ["192.168.110.252", "12.18.1.16", "192.168.1.252"];
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
import { jsonp } from "vue-jsonp";

const testResults: any = [];
// 定义一个标识来判断当前是否使用了内网地址
let isUsingInternalIP = true;

let downloadUrl = "http://pm.peidigroup.cn/nas"; // 固定为外网地址，不会变
// let uploadUrl = "http://9vx396nm1505.vicp.fun:6001";
let uploadUrl = "http://pm.peidigroup.cn/nas"; // 上传地址：会根据内外网判断而变化
// let uploadUrl = "http://12.18.1.16:6001";
// let uploadUrl = "/nasapi"
// console.log("uploadUrl", uploadUrl);

const testIPWithJsonp = ip => {
  return new Promise((resolve, reject) => {
    jsonp(
      `https://${ip}:${port}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`,
      {
        callbackName: "callback", // 自定义回调函数名，需和服务端配合
        timeout: 2000 // 设置超时时间（单位毫秒）
      }
    )
      .then(response => {
        console.log("1", response);

        // 如果成功获取到响应数据，认为可访问
        testResults.push({
          ip: ip,
          port: port,
          message: "is accessible"
        });
        ipThis = ip;
        resolve(ip);
      })
      .catch(error => {
        // 如果出现错误，认为不可访问，记录错误信息
        console.log("ddddsss", error);

        testResults.push({
          ip: ip,
          port: port,
          message: `is not accessible, error: ${error.message}`
        });
        reject({ error, ip });
      });
  });
};

// 导入这个方法，导入后会自动登陆chaohui
export const testAllIPs = async () => {
  // 默认使用外网地址
  uploadUrl = "http://pm.peidigroup.cn/nas"; // 外网地址

  //#region 内外网判断
  // 按顺序测试内网IP，300毫秒内能ping通则使用内网地址
  for (let i = 0; i < ips.length; i++) {
    const isReachable = await pingIP(ips[i]);
    if (isReachable) {
      uploadUrl = ipsName[i].url; // 使用当前可用的内网地址
      console.log(`使用内网地址: ${ipsName[i].name} (${ipsName[i].url})`);
      break;
    }
  }
  //#endregion

  //#region 测试内网IP是否可访问
  // 按顺序测试内网IP，300毫秒内能ping通则使用内网地址
  // for (let i = 0; i < ips.length; i++) {
  //   const isReachable = await pingIP2(ips[i]);
  //   if (isReachable) {
  //     uploadUrl = ipsName[i].url; // 使用当前可用的内网地址
  //     console.log(`使用内网地址: ${ipsName[i].name} (${ipsName[i].url})`);
  //     break;
  //   }
  // }
  //#endregion

  return new Promise((resolve, reject) => {
    resolve(chaohuilogin());
  });
};
// getYourIP();
// 登陆
export const chaohuilogin = () => {
  // debugger;
  console.log("ddddd");
  // const loadingInstance1 = ElLoading.service({
  //   fullscreen: true,
  //   text: "局域网上传连接中。。。"
  // });
  return new Promise((resolve, reject) => {
    Axios.get(
      `${uploadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`,
      {
        timeout: 3000
      }
    )
      .then(res => {
        if (res?.data?.data?.sid) {
          sid = res?.data?.data?.sid;
          resolve({
            sid: res?.data?.data?.sid,
            postUrl: `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Upload&method=upload&version=2&_sid=${res?.data?.data?.sid}`
          });
        }
        // localStorage.setItem('QunHuiToken', res.data.data.sid)
        // resolve(res.data.data.sid)
        console.log("res-------", res);
      })
      .catch(err => {
        // reject(err)
        // console.log("chaohuilogin err", err);
        localStorage.removeItem("ipThis");
        // testAllIPs();

        // 如果报错说明没连上内网，直接返回外网
        // 标记为使用了内网地址
        isUsingInternalIP = false;

        Axios.get(
          `${downloadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`
        )
          .then(res => {
            if (res?.data?.data?.sid) {
              sid = res?.data?.data?.sid;
              resolve({
                sid: res?.data?.data?.sid,
                postUrl: `${downloadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Upload&method=upload&version=2&_sid=${res?.data?.data?.sid}`
              });
            }
          })

          .catch(err => {
            message("文件服务器连接异常。请联系管理员，或稍后重试。", {
              type: "error"
            });
          });
      })
      .finally(() => {
        // loadingInstance1.close();
      });
  });
};

// 下载
export const chaohuiDownload = filename => {
  const encodedFilename = encodeURIComponent(filename);
  console.log(
    "filename",
    filename,
    encodedFilename,
    `${isUsingInternalIP ? uploadUrl : downloadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${"/web_packages/test/uploadFile"}/${encodedFilename}&_sid=${sid}`
  );
  Axios.get(
    `${isUsingInternalIP ? uploadUrl : downloadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${"/web_packages/test/uploadFile"}/${encodedFilename}&_sid=${sid}`,
    {
      responseType: "blob"
    }
  )
    .then(res => {
      const link = document.createElement("a");
      const objectURL = window.URL.createObjectURL(res.data);
      link.href = objectURL;
      link.download = filename; // 自定义文件名，可选
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectURL); // 释放临时URL对象
    })
    .catch(err => {
      localStorage.removeItem("ipThis");
      testAllIPs();
    });
};
