# AI HTML Asset Manager

个人AI生成HTML资产管理器 - 统一管理所有AI工具产出的HTML文件。

## 产品定位

将零散的AI HTML产出（PPT、方案、产品文档、调研报告、Demo页）变成可沉淀、可检索、可迭代的个人知识库。

> 适用人群：产品经理、运营、PM、游戏策划、咨询、自媒体等高频使用AI做方案的人群。

## 核心功能

- **统一收纳**：一站式管理所有AI产出的HTML文件
- **树形分类**：文件夹结构、标签管理、搜索筛选
- **实时预览**：内置WebView，无需外部浏览器即可预览
- **版本历史**：自动快照支持回滚，追踪迭代记录
- **元数据提取**：自动提取标题、描述、时间等信息

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron | 桌面客户端框架 |
| Vue 3 | 前端框架（Composition API） |
| Vite | 构建工具 |
| Pinia | 状态管理 |
| Element Plus | UI组件库 |
| SQLite | 本地数据库 |

## 项目结构

```
web-html-manager/
├── electron/
│   ├── main.ts           # Electron主进程
│   ├── preload.ts        # 预加载脚本
│   └── ipc/              # IPC通信模块
├── src/
│   ├── assets/           # 静态资源
│   ├── components/       # Vue组件
│   │   ├── Sidebar/      # 侧边栏（树形文件夹）
│   │   ├── FileList/     # 文件列表
│   │   ├── Preview/      # 预览面板
│   │   └── common/       # 通用组件
│   ├── composables/      # 组合式函数
│   ├── stores/           # Pinia状态管理
│   ├── types/            # TypeScript类型定义
│   ├── views/            # 页面视图
│   ├── App.vue
│   └── main.ts
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包发布

```bash
npm run package
```

## 使用说明

### 1. 设置仓库目录
首次使用时，选择一个本地文件夹作为HTML资产仓库。

### 2. 添加HTML文件
- 手动添加：点击「添加文件」按钮选择HTML文件
- 自动扫描：启动时自动扫描仓库目录

### 3. 浏览和预览
- 左侧：文件夹树形目录
- 中间：文件列表（支持排序、搜索）
- 右侧：HTML实时预览

### 4. 版本管理
- 自动快照：文件变更时自动保存版本
- 回滚：选择历史版本一键恢复

## 版本路线图

| 版本 | 特性 |
|------|------|
| V1.0 | MVP桌面端：基础文件管理、预览、版本历史 |
| V2.0 | 浏览器插件：自动抓取AI网站HTML |
| V3.0 | 云端同步：多设备访问、分享协作 |

## 开发指南

### 添加新组件

```vue
<!-- src/components/common/MyComponent.vue -->
<template>
  <div class="my-component">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 组件逻辑
</script>

<style scoped>
.my-component {
  /* 样式 */
}
</style>
```

### 使用Store

```ts
// src/stores/file.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFileStore = defineStore('file', () => {
  const files = ref<File[]>([])
  
  function addFile(file: File) {
    files.value.push(file)
  }
  
  return { files, addFile }
})
```

### IPC通信

主进程和渲染进程通过IPC通信：

```ts
// 渲染进程
import { ipcRenderer } from 'electron'

// 调用主进程方法
const result = await ipcRenderer.invoke('select-folder')
```

## 许可证

MIT License