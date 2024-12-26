import Axios from "axios";
import { ElLoading } from "element-plus";
export const default_upload_url = "/web_packages/test/uploadFile";

const DINGTALK_CORP_ID = "dingfc722e531a4125b735c2f4657eb6378f";
const port = 5000;
const USERNAME = "夏琰";
const PASSWORD = "X81y0122";
let sid = "";
let ipThis = "";
const ips = ["192.168.1.252", "12.18.1.16", "192.168.110.252"];
const ipsName = [
  {
    url: "192.168.1.252",
    name: "A区"
  },
  {
    url: "12.18.1.16",
    name: "B区"
  },
  {
    url: "192.168.110.252",
    name: "CD区"
  }
];
import { jsonp } from "vue-jsonp";

const testResults: any = [];
let uploadUrl = "";

const testIPWithJsonp = ip => {
  return new Promise((resolve, reject) => {
    jsonp(
      `http://${ip}:${port}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`,
      {
        callbackName: "callback", // 自定义回调函数名，需和服务端配合
        timeout: 5000 // 设置超时时间（单位毫秒）
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
        console.log("ddddsss");

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

  return new Promise((resolve, reject) => {
    let localIp = localStorage.getItem('ipThis')
    if (localIp) {
      uploadUrl = `http://${localIp}:6001`;
      resolve(chaohuilogin());
    }else{
    const loadingInstance1 = ElLoading.service({
      fullscreen: true,
      text: "上传地址查询中。。。"
    });
    Promise.race([
      testIPWithJsonp(ipsName[0].url),
      testIPWithJsonp(ipsName[1].url),
      testIPWithJsonp(ipsName[2].url)
    ])
      .then(res => {
        console.log("Promise race", res);
      })
      .catch(err => {
        console.log("ddsqqqqqq");

        console.log("Promise race", err);
        const { ip, error } = err;
        localStorage.setItem('ipThis',ip)
        if (error.statusText != "Request Timeout") {
          uploadUrl = `http://${ip}:6001`;
          // uploadUrl = `http://192.168.2.52:3000`;
          console.log("ssss");
          loadingInstance1.close();
          resolve(chaohuilogin());
        }
      });
    }
  });
};

// 登陆
export const chaohuilogin = () => {
  // debugger;
  console.log("ddddd");

  return new Promise((resolve, reject) => {
    Axios.get(
      `${uploadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`
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
        console.log("res", res);
      })
      .catch(err => {
        // reject(err)
        console.log("err", err);
        localStorage.removeItem('ipThis');
        testAllIPs();
      });
  });
};

// 下载
export const chaohuiDownload = filename => {
  console.log("filename", filename ,  `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${"/web_packages/test/uploadFile"}/${filename}&_sid=${sid}`);

  Axios.get(
    `${uploadUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${"/web_packages/test/uploadFile"}/${filename}&_sid=${sid}`,
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
              localStorage.removeItem('ipThis');
        testAllIPs();
    });
};
