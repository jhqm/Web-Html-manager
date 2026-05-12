---
name: AI HTML Asset Manager - 完整开发计划
overview: 为 AI HTML 资产管理器制定包含 MVP 和阶段性验收节点的完整开发计划
todos:
  - id: db-init
    content: 创建 SQLite 数据库模块，实现数据表初始化和基础CRUD操作
    status: completed
  - id: db-store
    content: 创建 Pinia store，实现文件状态管理和与数据库的同步
    status: completed
    dependencies:
      - db-init
  - id: version-rollback
    content: 完善版本回滚功能，添加版本预览和确认恢复流程
    status: completed
    dependencies:
      - db-store
  - id: file-delete
    content: 实现文件删除功能，包括确认对话框和版本快照清理
    status: completed
    dependencies:
      - db-store
  - id: file-import
    content: 实现手动添加HTML和自动扫描导入功能
    status: completed
    dependencies:
      - db-store
  - id: tag-system
    content: 实现标签系统，包含创建、编辑、筛选功能
    status: completed
    dependencies:
      - db-store
  - id: settings-panel
    content: 实现设置面板，包含仓库路径管理和应用配置
    status: completed
  - id: package-config
    content: 完善打包配置，添加应用图标，设置构建选项
    status: completed
    dependencies:
      - db-init
      - file-delete
  - id: ui-optimize
    content: 界面优化：添加加载状态、错误提示、空状态展示
    status: completed
    dependencies:
      - tag-system
      - settings-panel
  - id: docs-update
    content: 更新SPEC.md文档，记录已完成功能和里程碑
    status: completed
---

## 产品概述

AI HTML Asset Manager 是一款个人AI生成HTML资产管理器，用于统一管理所有AI工具产出的HTML文件，将零散的AI产出变成可沉淀、可检索、可迭代的知识库。

## 核心功能规划

### MVP阶段（V1.0）- P0优先级

| 功能 | 描述 | 验收标准 |
| --- | --- | --- |
| SQLite数据库集成 | 建立本地数据库存储文件索引和元数据 | 数据库初始化成功，可读写文件/文件夹/版本表 |
| 版本回滚完善 | 修复恢复版本功能，支持选择版本恢复 | 选择历史版本后原文件内容被覆盖恢复 |
| 文件删除功能 | 支持删除选中的HTML文件及关联版本 | 删除后文件从列表消失，版本快照同步清理 |
| 手动添加HTML | 按钮添加本地HTML文件到仓库 | 弹出文件选择器，选中文件复制到仓库目录 |
| 自动扫描导入 | 启动时自动扫描指定路径下所有HTML文件（含子目录递归扫描） | 无需操作，自动递归扫描加载所有HTML到列表，支持设置多个扫描路径 |
| 应用打包配置 | electron-builder配置，应用图标 | 生成可运行的.app/.exe安装包 |


### 完善阶段（V1.1）- P1优先级

| 功能 | 描述 | 验收标准 |
| --- | --- | --- |
| 标签系统 | 为文件添加/管理自定义标签 | 可创建、编辑、删除标签，支持按标签筛选 |
| 元数据优化 | 自动记录来源、文件大小、时间 | 文件卡片显示完整元数据信息 |
| 设置面板 | 仓库路径管理、版本策略配置 | 可修改仓库路径，设置快照保留策略 |
| 界面优化 | 加载状态、错误提示、空状态UI | 各操作有loading反馈，异常情况友好提示 |


### V2.0规划（暂缓）

| 功能 | 描述 | 状态 |
| --- | --- | --- |
| 浏览器插件 | 自动抓取AI网站HTML代码 | 暂不考虑 |
| 智能标签 | AI辅助自动分类打标 | 后续版本 |
| 导出功能 | HTML转PDF/图片 | 后续版本 |


## 里程碑

| 阶段 | 目标 | 验收节点 |
| --- | --- | --- |
| Sprint 1 | 数据库 + 回滚 + 删除 | 数据库读写正常，版本可恢复/可删除 |
| Sprint 2 | 文件导入完善 | 手动添加+自动扫描可用 |
| Sprint 3 | 打包发布 | 生成可分发的安装包 |
| Sprint 4 | 标签系统 + 界面优化 | 完整V1.0功能集 |


## 技术架构

### 系统架构

- **架构模式**：主进程( Electron ) + 渲染进程( Vue3 ) 分离架构
- **IPC通信**：通过 preload 脚本安全暴露API
- **状态管理**：Pinia store 管理文件列表、当前选中、版本历史状态
- **文件扫描**：支持配置多个扫描路径，递归扫描子目录HTML文件

### 目录结构

```
web-html-manager/
├── electron/
│   ├── main.ts           # 主进程：窗口管理、IPC处理
│   ├── preload.ts        # 预加载：安全API暴露
│   └── database.ts       # [NEW] SQLite数据库操作
├── src/
│   ├── components/       # Vue组件
│   │   ├── Sidebar/      # 侧边栏（文件夹树+标签筛选）
│   │   ├── FileList/     # 文件列表
│   │   ├── Preview/      # 预览面板（iframe渲染）
│   │   └── common/       # 通用组件（空状态、加载等）
│   ├── composables/      # 组合式函数
│   │   └── useScanner.ts # [NEW] 文件扫描逻辑
│   ├── stores/           # Pinia状态管理
│   │   ├── file.ts       # [NEW] 文件状态
│   │   └── tag.ts        # [NEW] 标签状态
│   ├── types/            # TypeScript类型
│   │   └── index.ts      # [NEW] 类型定义
│   ├── App.vue            # 主视图
│   └── main.ts
├── package.json          # [MODIFY] 依赖调整
├── electron-builder.json # [MODIFY] 打包配置
└── SPEC.md               # [MODIFY] 更新规格文档
```

### 关键数据模型

- **files表**：id, name, path, title, description, size, created_at, updated_at, folder_id
- **folders表**：id, name, parent_id, path, created_at
- **versions表**：id, file_id, version_path, snapshot_at, remark
- **tags表**：id, name, color
- **file_tags表**：file_id, tag_id

### 实现要点

- SQLite使用better-sqlite3同步API，配合Electron主进程
- 数据库文件存储在用户数据目录，跨平台兼容
- 版本快照使用文件副本存储，数据库仅存储引用
- IPC通道采用命名规范：db-xxx, file-xxx, version-xxx

# Agent Extensions

本项目无需使用Agent扩展。

---

## 任务清单

| ID | 任务 | 依赖 | 状态 |
| --- | --- | --- | --- |
| db-init | 创建 SQLite 数据库模块，实现数据表初始化和基础CRUD操作 | - | 待开发 |
| db-store | 创建 Pinia store，实现文件状态管理和与数据库的同步 | db-init | 待开发 |
| version-rollback | 完善版本回滚功能，添加版本预览和确认恢复流程 | db-store | 待开发 |
| file-delete | 实现文件删除功能，包括确认对话框和版本快照清理 | db-store | 待开发 |
| file-import | 实现手动添加HTML和自动扫描导入功能，支持多路径配置和递归扫描 | db-store | 待开发 |
| tag-system | 实现标签系统，包含创建、编辑、筛选功能 | db-store | 待开发 |
| settings-panel | 实现设置面板，包含扫描路径管理、仓库路径和应用配置 | file-import | 待开发 |
| package-config | 完善打包配置，添加应用图标，设置构建选项 | db-init, file-delete | 待开发 |
| ui-optimize | 界面优化：添加加载状态、错误提示、空状态展示 | tag-system, settings-panel | 待开发 |
| docs-update | 更新SPEC.md文档，记录已完成功能和里程碑 | - | 待开发 |