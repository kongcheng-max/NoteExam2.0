# BUG-047-PWA-Manifest不可用且缺少link标签

## 基本信息

| 字段 | 值 |
|------|-----|
| BUG-ID | BUG-047 |
| 优先级 | P2 |
| 发现日期 | 2026-06-30 |
| 发现阶段 | 测试验收（v1.3） |
| 所属模块 | 前端 - PWA |
| 影响范围 | PWA 安装、离线功能 |

## 问题描述

v1.3 引入了 PWA 支持（`vite-plugin-pwa` + `OfflineBanner` 组件），但存在两个问题：

1. **manifest.webmanifest 不可用**：访问 `/manifest.webmanifest` 返回的是 `index.html`（SPA fallback）而非 JSON manifest
2. **index.html 缺少 `<link rel="manifest">`** 标签：浏览器无法发现 manifest，PWA 安装提示无法触发

## 复现步骤

1. 启动前端 dev server
2. 访问 `http://localhost:3000/manifest.webmanifest`
3. 观察返回内容为 HTML 而非 JSON
4. 检查 `index.html` 源码，无 `<link rel="manifest" href="/manifest.webmanifest">`

## 影响

- `OfflineBanner` 组件的安装提示永远不会触发
- 用户无法将应用安装到桌面
- PWA 离线缓存虽可通过 sw.js 工作，但安装入口缺失