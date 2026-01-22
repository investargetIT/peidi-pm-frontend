import * as dd from "dingtalk-jsapi";
/**
 * 获取当前设备的内网ip 需要开启WebRTC
 */
export function getYourIP() {
  console.log("=========================================");
  //获取内网ip
  let RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  if (RTCPeerConnection) (
    function () {
      let rtc = new RTCPeerConnection({ iceServers: [] });
      if (1 || window.mozRTCPeerConnection) {
        rtc.createDataChannel('', { reliable: false });
      };

      rtc.onicecandidate = function (evt) {
        if (evt.candidate) grepSDP("a=" + evt.candidate.candidate);
      };
      rtc.createOffer(function (offerDesc) {
        grepSDP(offerDesc.sdp);
        rtc.setLocalDescription(offerDesc);
      }, function (e) { console.warn("offer failed", e); });
      let addrs = Object.create(null);
      addrs["0.0.0.0"] = false;
      function updateDisplay(newAddr) {
        if (newAddr in addrs) return;
        else addrs[newAddr] = true;
        let displayAddrs = Object.keys(addrs).filter(function (k) { return addrs[k]; });
        for (let i = 0; i < displayAddrs.length; i++) {
          if (displayAddrs[i].length > 16) {
            displayAddrs.splice(i, 1);
            i--;
          }
        }
        //打印出该设备连接的所有内网ip
        localStorage.setItem("peidi-ip", JSON.stringify(displayAddrs));
        console.log("该设备连接的所有内网ip为：", displayAddrs);
        //排第一个ip
        console.log("该设备连接的第一个内网ip为：", displayAddrs[0]);
      }
      function grepSDP(sdp) {
        let hosts = [];
        sdp.split('\r\n').forEach(function (line, index, arr) {
          if (~line.indexOf("a=candidate")) {
            let parts = line.split(' '),
              addr = parts[4],
              type = parts[7];
            if (type === 'host') updateDisplay(addr);
          } else if (~line.indexOf("c=")) {
            let parts = line.split(' '),
              addr = parts[2];
            updateDisplay(addr);
          }
        });
      }
    })();
  else {
    console.log("请使用主流浏览器：chrome,firefox,opera,safari");
  }
  console.log("=========================================");
}

//  ping 函数, 检测与内网连接是否能在300ms 内响应
export function pingIP(ip) {
  // 不在钉钉环境下
  // if (!navigator.userAgent.includes("DingTalk")) {
  if (true) {
    return new Promise((resolve, reject) => {
      let img = new Image();
      let start = new Date().getTime();
      img.src = "http://" + ip + "?t=" + start;
      let flag = false;
      let hasResponded = false;

      img.onload = function () {
        hasResponded = true;
        const responseTime = new Date().getTime() - start;
        // 300毫秒内响应返回true，否则返回false
        resolve(responseTime <= 300);
      }
      img.onerror = function () {
        hasResponded = true;
        const responseTime = new Date().getTime() - start;
        // 300毫秒内响应返回true，否则返回false
        resolve(responseTime <= 300);
      };

      let timer = setTimeout(function () {
        if (!hasResponded) {
          resolve(false); // 超时返回false
        }
      }, 300); // 改为300毫秒超时
    });
  } else {
    // 在钉钉环境下用钉钉自带的httpRequest 函数
    return new Promise((resolve, reject) => {
      const start = new Date().getTime();
      let hasResponded = false;
      let timeoutTimer;

      console.log(`钉钉环境下开始ping IP: ${ip}`);

      // 设置超时定时器
      timeoutTimer = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          console.log(`IP ${ip} 请求超时`);
          resolve(false);
        }
      }, 300);

      dd.httpRequest({
        url: `http://${ip}/`,
        method: 'HEAD',
        timeout: 300,
        onSuccess: function (res) {
          if (hasResponded) return;
          hasResponded = true;
          clearTimeout(timeoutTimer);

          const responseTime = new Date().getTime() - start;
          console.log(`IP ${ip} 请求成功, 响应时间: ${responseTime}ms`);

          // 300毫秒内响应返回true，否则返回false
          resolve(responseTime <= 300);
        },
        onFail: function (err) {
          if (hasResponded) return;
          hasResponded = true;
          clearTimeout(timeoutTimer);

          const responseTime = new Date().getTime() - start;
          console.log(`IP ${ip} 请求失败, 错误:`, err, `响应时间: ${responseTime}ms`);

          // 即使请求失败，只要在300ms内收到响应也认为连通
          resolve(responseTime <= 300);
        }
      });
    });
  }
}

//  ping 函数, 检测与内网连接是否能在300ms 内响应
export function pingIPUseXHR(ip) {
  return new Promise((resolve, reject) => {
    const start = new Date().getTime();
    const xhr = new XMLHttpRequest();
    let hasResponded = false;

    console.log(`开始ping IP: ${ip}`);
    xhr.timeout = 300;

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (hasResponded) return;
        hasResponded = true;
        const responseTime = new Date().getTime() - start;

        console.log(`IP ${ip} 请求完成, readyState: ${xhr.readyState}, 状态码: ${xhr.status}, 响应时间: ${responseTime}ms`);

        // 检查状态码，200-399表示成功响应
        if (xhr.status >= 200 && xhr.status < 400) {
          console.log(`IP ${ip} 收到成功响应, 状态码: ${xhr.status}, 返回true`);
          resolve(true);
        } else {
          console.log(`IP ${ip} 收到错误响应, 状态码: ${xhr.status}, 返回false`);
          resolve(false);
        }
      }
    };

    xhr.onload = function () {
      if (hasResponded) return;
      hasResponded = true;
      const responseTime = new Date().getTime() - start;

      console.log(`IP ${ip} onload触发, 状态码: ${xhr.status}, 响应时间: ${responseTime}ms`);

      // 检查状态码，200-399表示成功响应
      if (xhr.status >= 200 && xhr.status < 400) {
        console.log(`IP ${ip} onload触发且状态码正常, 返回true`);
        resolve(true);
      } else {
        console.log(`IP ${ip} onload触发但状态码异常, 返回false`);
        resolve(false);
      }
    };

    xhr.onerror = function () {
      if (hasResponded) return;
      hasResponded = true;
      console.log(`IP ${ip} 发生错误`);
      // 发生错误，返回false
      resolve(false);
    };

    xhr.ontimeout = function () {
      if (hasResponded) return;
      hasResponded = true;
      console.log(`IP ${ip} 请求超时`);
      resolve(false);
    };

    try {
      // 使用最简单的URL格式
      const url = `http://${ip}/`;
      console.log(`发送HEAD请求到: ${url}`);

      xhr.open('HEAD', url, true);
      xhr.send();

    } catch (error) {
      console.log(`IP ${ip} 发生异常:`, error);
      // 如果发生异常，返回false
      resolve(false);
    }
  });
}