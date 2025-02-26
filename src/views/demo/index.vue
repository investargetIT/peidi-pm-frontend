<template>
  <div class="poster-container">
    <div class="poster" ref="poster">
      <div class="card-image">Card Image</div>
      <div class="main-image">Main Image</div>
      <div class="footer-image">Footer Image</div>
    </div>
    <button @click="generatePoster">生成海报</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import html2canvas from 'html2canvas'

const poster = ref(null)

const generatePoster = async () => {
  try {
    const canvas = await html2canvas(poster.value, {
      scale: 2,
      useCORS: true
    })
    const imgData = canvas.toDataURL('image/png')
    // 创建一个链接元素用于下载图片
    const link = document.createElement('a')
    link.href = imgData
    link.download = 'poster.png'
    link.click()
    console.log('海报生成成功')
  } catch (error) {
    console.error('生成海报失败：', error)
  }
}
</script>

<style scoped>
.poster-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
}

.poster {
  width: 300px;
  height: 500px;
  border: 1px solid #ccc;
  position: relative;
}

.card-image {
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  background-color: #f00; /* 红色块代表Card图片 */
}

.main-image {
  width: 100%;
  height: 300px;
  background-color: #0f0; /* 绿色块代表Main图片 */
  margin-top: 100px;
}

.footer-image {
  width: 100%;
  height: 100px;
  background-color: #00f; /* 蓝色块代表Footer图片 */
}
</style> 