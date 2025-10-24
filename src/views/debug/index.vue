<script setup lang="ts">
import { ref } from "vue";
import axios from "axios";

const msg = ref("调试");
const fileInputRef = ref({ files: [] });
const fileData = ref();

const uploadFile = () => {
  const tem = fileInputRef.value.files[0];
  fileData.value = tem;
};

const upload = () => {
  // const formData = new FormData();
  // formData.append("path", "/web_packages/test/uploadFile");
  // formData.append("create_parents", "false");
  // formData.append("file", new Blob([fileData.value], { type: fileData.value.type }));

  // axios
  //   .post("/api/webapi/entry.cgi?api=SYNO.FileStation.Upload&method=upload&version=2&_sid=nyJZDWStaGJn2yPn6IboYq6kQ3O9mXFFPVgxZTklvJYho-WOexhY2kJzao9PP94LS0yx3i9FtvdZeGDlaiE1fA", formData, {
  //     headers: {
  //       "Content-Type": "multipart/form-data",
  //     },
  //     // 超时设置10秒
  //     timeout: 1000 * 60 * 30,
  //   })
  //   .then(() => {
  //     alert("上传成功");
  //   })
  //   .catch((err) => {
  //     console.log(err);
  //     alert("上传失败");
  //   });
  // axios.get(
  //   'https://12.18.1.16:5001/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=%E5%A4%8F%E7%90%B0&passwd=X81y0122&session=FileStation&format=cookie'
  //   // `${uploadUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`
  //   // `https://12.18.1.16:5001/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${USERNAME}&passwd=${PASSWORD}&session=FileStation&format=cookie`
  // )
  //   .then((res) => {
  //     console.log(res);
  //   })
}
</script>

<template>
  <div>
    <h1>{{ msg }}</h1>
    <input type="file" ref="fileInputRef" @change="uploadFile" />
    <button @click="upload">上传</button>
  </div>
</template>
