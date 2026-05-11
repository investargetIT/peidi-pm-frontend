# Utils 工具模块说明

本目录包含 AI 绘图模块的通用工具函数，方便后续开发人员理解和复用。

---

## 模块列表

### 1. blobManager (`blobManager/index.ts`)

**功能**: Blob 对象管理单例，负责 Blob 数据的转换、URL 创建和内存管理。

**主要方法**:
- `base64ToBlob(base64Data, mimeType)` - 将 base64 字符串转换为 Blob 对象
- `blobToBase64(blob)` - 将 Blob 对象转换为 base64 字符串
- `createBlobURL(blobId, blob)` - 创建 Blob URL 并管理引用计数
- `getBlobURL(blobId)` - 获取已存在的 Blob URL
- `releaseBlobURL(blobId)` - 释放 Blob URL 引用
- `releaseAll()` - 强制释放所有 Blob URL
- `getStats()` - 获取缓存统计信息

**使用示例**:
```ts
import { blobManager } from './blobManager';

// base64 转 Blob
const blob = blobManager.base64ToBlob('data:image/png;base64,...');

// Blob 转 base64
const base64 = await blobManager.blobToBase64(blob);
```

---

### 2. imageCache (`imageCache/index.ts`)

**功能**: 基于 IndexedDB 的图片缓存管理，支持存储原图和压缩图的 Blob 数据。

**主要方法**:
- `storeImage(id, originalData, compressedData)` - 存储图片数据（支持 base64 或 Blob）
- `getImageURL(id, type)` - 获取图片的 Blob URL
- `getImageBlob(id, type)` - 获取图片的 Blob 对象
- `getImageData(id)` - 获取完整的图片数据对象
- `deleteImage(id)` - 删除指定图片缓存
- `clearAll()` - 清空所有图片缓存
- `hasImage(id)` - 检查图片是否存在
- `getStats()` - 获取缓存统计信息（数量和大小）

**参数说明**:
- `type`: `'originalBlob' | 'compressedBlob'`，默认为 `'compressedBlob'`

**使用示例**:
```ts
import { imageCache } from './imageCache';

// 存储图片
await imageCache.storeImage('/ai/1.png', originalBase64, compressedBase64);

// 获取压缩图的 URL
const url = await imageCache.getImageURL('/ai/1.png', 'compressedBlob');

// 检查是否存在
const exists = await imageCache.hasImage('/ai/1.png');
```

---

### 3. requestQueue (`requestQueue/index.ts`)

**功能**: 通用请求队列管理器（单例模式），控制并发请求数量，防止过多请求导致页面卡顿。

**特性**:
- 支持最大并发数限制（默认 3）
- 支持请求去重（相同请求复用 Promise）
- 支持优先级队列
- 支持取消请求（队列中或正在执行）
- 支持获取队列状态

**主要方法**:
- `addRequest(id, params, handler, priority)` - 添加请求到队列
- `setMaxConcurrent(max)` - 设置最大并发数
- `getQueueStatus()` - 获取队列状态
- `clearQueue()` - 清空队列
- `cancelRequest(id, params)` - 取消队列中的请求
- `cancelRunningRequest(id, params)` - 强制取消正在执行的请求
- `isRequestPending(id, params)` - 检查请求是否正在执行或等待中
- `getRunningRequests()` - 获取正在执行的请求信息

**使用示例**:
```ts
import { requestQueueManager } from './requestQueue';

// 设置最大并发数为 5
requestQueueManager.setMaxConcurrent(5);

// 添加请求
const result = await requestQueueManager.addRequest(
  'fetchImage',
  { url: '/api/image.png' },
  async (params) => {
    return await fetch(params.url);
  }
);

// 获取队列状态
const status = requestQueueManager.getQueueStatus();
// { currentRunning: 2, queueLength: 5, maxConcurrent: 5, pendingRequests: 7 }
```

---

### 4. compressImage (`compressImage/index.ts`)

**功能**: 图片压缩工具，支持通用压缩和 PNG 专用压缩。

**主要方法**:
- `compressImage(base64Data, quality)` - 使用 compressorjs 压缩图片
- `compressPNG(file)` - 使用 UPNG 压缩 PNG 图片
- `smartCompressImage(originalBase64, imageUrl, quality)` - 智能选择压缩方式
- `processImageCompression(originalBase64, imageUrl, quality)` - 统一的图片压缩处理

**参数说明**:
- `quality`: 压缩质量，范围 0-1，默认 0.8 或 0.5
- PNG 图片会自动使用 UPNG 压缩（接近 TinyPNG 效果）

**使用示例**:
```ts
import { smartCompressImage, processImageCompression } from './compressImage';

// 智能压缩（自动识别 PNG）
const compressedBase64 = await smartCompressImage(originalBase64, '/image.png', 0.5);

// 统一处理，返回原图和压缩图
const result = await processImageCompression(originalBase64, '/image.jpg');
// { originalBase64: '...', compressedBase64: '...' }
```

---

### 5. compositeImage (`compositeImage/index.ts`)

**功能**: Canvas 图片合成工具，将背景图和素材元素合成为一张图片。

**主要方法**:
- `compositeImage(backgroundImage, elements, outputSize)` - 合成单张图片
- `batchCompositeImages(tasks, concurrentLimit)` - 批量合成图片
- `downloadCompositeImage(base64Data, filename)` - 下载合成的图片
- `generateCompositeElements(imageElements, containerSize, outputSize)` - 生成合成参数

**参数说明**:
- `elements`: 素材元素数组，每个元素包含 `{ src, x, y, width, height }`
- `outputSize`: 输出尺寸（正方形），默认 800

**使用示例**:
```ts
import { compositeImage, batchCompositeImages } from './compositeImage';

// 合成单张图片
const result = await compositeImage(
  backgroundImage,
  [
    { src: 'element1.png', x: 100, y: 200, width: 50, height: 50 },
    { src: 'element2.png', x: 300, y: 400, width: 80, height: 80 }
  ],
  800
);

// 批量合成
const results = await batchCompositeImages([
  { background: 'bg1.png', elements: [...], outputSize: 800 },
  { background: 'bg2.png', elements: [...], outputSize: 800 }
], 3);
```

---

### 6. imageLoader (`imageLoader/index.ts`)

**功能**: 图片加载工具，支持缓存管理、加载提示和取消功能。

**主要方法**:
- `loadImage(imageUrl, imageCacheManager, options)` - 加载图片

**参数说明**:
- `imageUrl`: 图片 URL
- `imageCacheManager`: 图片缓存管理器（可选）
- `options`: 配置选项
  - `loadingMessage`: 加载提示消息
  - `successMessage`: 成功提示消息
  - `errorMessage`: 失败提示消息

**返回值**:
- `{ promise, cancel }` - 可取消的 Promise 和取消函数

**使用示例**:
```ts
import { loadImage } from './imageLoader';
import { imageCache } from './imageCache';

// 基础使用
const { promise, cancel } = loadImage('/api/image.png');
const base64 = await promise;

// 使用缓存管理器
const { promise, cancel } = loadImage('/api/image.png', imageCache, {
  loadingMessage: '正在加载图片...',
  successMessage: '图片加载成功'
});

// 取消加载
cancel();
```

---

### 7. general (`general/index.ts`)

**功能**: 通用工具函数集合。

**主要方法**:
- `getNameFromObjectName(objectName)` - 从对象名称提取文件名（不含扩展名）
- `generateID()` - 生成随机字符串 ID
- `fileToBase64(file)` - 将文件转换为 base64 字符串
- `downloadImageFromUrl(url, filename, options)` - 从 URL 下载图片，支持尺寸控制

**使用示例**:
```ts
import { generateID, fileToBase64, downloadImageFromUrl } from './general';

// 生成随机 ID
const id = generateID(); // 'abc123xyz'

// 文件转 base64
const base64 = await fileToBase64(file);

// 下载图片
await downloadImageFromUrl('/api/image.png', 'myImage.png', {
  width: 400,
  height: 400
});
```

---

### 8. operationIogic (`operationIogic/saveToMaterialLibrary.ts`)

**功能**: 保存图片到素材库的业务逻辑。

**主要方法**:
- `saveToMaterialLibrary(imageUrl, materialType, customTypeObj, defaultName)` - 保存到素材库

**参数说明**:
- `imageUrl`: 图片 URL 地址
- `materialType`: 素材类型（如 `'template'`, `'resultImage'` 等）
- `customTypeObj`: 自定义类型对象（可选，会合并到 type 中）
- `defaultName`: 默认素材名称（可选）

**使用示例**:
```ts
import { saveToMaterialLibrary } from './operationIogic/saveToMaterialLibrary';

// 保存到素材库
const success = await saveToMaterialLibrary(
  '/api/result.png',
  'resultImage',
  { category: 'portrait' },
  'myPortrait'
);
```

---

## 模块依赖关系

```
imageCache ──→ blobManager
compressImage ──→ blobManager
imageLoader ──→ blobManager (可选)
```

---

## 注意事项

1. **blobManager** 和 **imageCache** 都是单例模式，全局共享同一实例
2. 使用 **imageCache** 时，记得在不需要时调用 `releaseImageURL()` 释放引用
3. **requestQueue** 的去重功能基于 `id + params` 生成唯一键
4. PNG 压缩使用 UPNG 库，效果接近 TinyPNG
5. **compositeImage** 的元素坐标基于容器尺寸 700 计算