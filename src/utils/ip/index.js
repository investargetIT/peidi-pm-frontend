/**
 * 获取当前设备的内网ip 需要开启WebRTC
 */
export function getYourIP(){
    console.log("=========================================");
    //获取内网ip
    let RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (RTCPeerConnection) (
            function () {
      let rtc = new RTCPeerConnection({iceServers:[]});
      if (1 || window.mozRTCPeerConnection) {
        rtc.createDataChannel('', {reliable:false});
      };

      rtc.onicecandidate = function (evt) {
        if (evt.candidate) grepSDP("a="+evt.candidate.candidate);
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
        for(let i = 0; i < displayAddrs.length; i++){
          if(displayAddrs[i].length > 16){
            displayAddrs.splice(i, 1);
            i--;
          }
        }
        //打印出该设备连接的所有内网ip
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
    else{
      console.log("请使用主流浏览器：chrome,firefox,opera,safari");
    }
    console.log("=========================================");
}

//  ping 函数, 检测与内网连接是否能在100ms 内响应. 实测实验室电脑连接内网 ping 为 9-11ms 左右
export function pingIP(ip) {
  return new Promise((resolve, reject) => {
    let img = new Image();
    let start = new Date().getTime();
    img.src = "http://" + ip + "?t=" + start;
    let flag = false;
    img.onload = function () {
      flag = true;
      resolve(flag);
    }
    img.onerror = function () {
      flag = true;
      resolve(flag);
    };
 
    let timer = setTimeout(function () {
      if (!flag) {
        flag = false;
        resolve(flag);
      }
    }, 300);
  });
}