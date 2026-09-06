# Manus · 个人主页展厅

一个「内容与 UI 彻底分离」的静态个人主页：Markdown 驱动、零打包工具（纯 Node.js 预构建），带工作台、文章整页、暗色星空等特性。

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ 特性

- **内容与 UI 分离**：所有内容来自 `content/` 下的 Markdown / JSON，Front-matter 即数据契约，构建脚本渲染为原生 HTML
- **零打包工具**：无 Webpack / Vite，`build.js` 一个文件完成构建（shiki 构建期语法高亮，0 运行时开销）
- **双页架构**：主页展示个人形象；工作台（Workspace）归类管理全部文档，支持分类筛选与 `Ctrl+K` 全文查找（Zensical 风格结果面板：结果计数 + 分类/日期面包屑 + 标题与正文摘要关键词高亮，`↑↓` 选择、回车打开）
- **文章整页**：每篇长文 / 产品构建为独立静态页（`/articles/<slug>.html`），可分享、可收藏
- **沉浸式动效**：入场开屏、暗色流体极光 + 动态星空（闪烁 / 视差 / 流星）、头像 3D 翻转、卡片光斑跟随、滚动进度条
- **博客迁移设计**（借鉴自 Cat-Drink 的 Zensical 博客，按本站风格适配，无 Zensical 依赖）：
  霞鹜文楷字体、时段问候语条、多句循环打字机、GitHub 贡献热力图、Hero 交互网格 Canvas、
  代码块复制按钮、点击爱心漂浮、标签页切换彩蛋、页脚一言、菱形分隔线 / 渐变引用等文章排版
- **阅读体验**：主页抽屉秒开（内容池 `<template>` 预载）、亮 / 暗双主题、响应式、`prefers-reduced-motion` 无障碍降级

## 🚀 快速开始

```bash
# 环境要求：Node.js >= 18
npm install     # 安装依赖
npm run build   # 构建到 dist/
npm run dev     # 构建 + 本地预览（http://localhost:4173）
npm run serve   # 仅启动本地预览
```

## 📁 目录结构

```
ManusNote/
├── build.js              # 核心预构建脚本（读取内容 → 渲染 → 装配页面）
├── scripts/
│   └── serve.js          # 零依赖静态服务器（本地预览）
├── content/              # ✏️ 所有内容都在这里（改这里就够了）
│   ├── profile.json      # 个人信息 / 社交链接 / 打字机短语 / GitHub 用户名
│   ├── products/*.md     # 产品卡片（Front-matter: title/tagline/cover/status/tech_stack/order…）
│   └── blog/*.md         # 长文（Front-matter: title/date/summary/tags/read_time）
├── templates/            # 页面骨架（index / workspace / article / 卡片模板）
├── public/               # 静态资源（css / js / 图片），构建时原样复制
└── dist/                 # 构建产物（git 忽略，部署它即可）
```

## ✍️ 写一篇新文章

在 `content/blog/` 新建 `my-post.md`：

```markdown
---
title: "文章标题"
date: "2026-09-06"
summary: "一句话摘要"
tags: ["Tag1", "Tag2"]
read_time: "5 min"
---

正文支持完整 Markdown，代码块构建期高亮。
```

重新 `npm run build` 后：主页长文列表、工作台文档归档、`/articles/my-post.html` 整页会全部自动生成。

## 📦 依赖

运行时零依赖；构建期依赖（`package.json`）：

| 依赖 | 用途 |
|------|------|
| [gray-matter](https://github.com/jonschlinkert/gray-matter) | 解析 Markdown Front-matter 元数据 |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown → HTML 渲染（`html:false` 安全加固） |
| [shiki](https://github.com/shikijs/shiki) | 构建期代码语法高亮（vitesse-dark 主题） |

## 🌐 部署

`dist/` 是纯静态目录，任意静态托管皆可：GitHub Pages、Vercel、Netlify、Cloudflare Pages、Nginx。构建命令 `npm run build`，产物目录 `dist`。

## License

MIT
