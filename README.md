# Manus · 个人主页展厅

一个「内容与 UI 彻底分离」的静态个人主页：Markdown 驱动、零打包工具（纯 Node.js 预构建），带工作台、文章整页、暗色星空等特性。

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ 特性

- **内容与 UI 分离**：所有内容来自 `content/` 下的 Markdown / JSON，Front-matter 即数据契约，构建脚本渲染为原生 HTML
- **零打包工具**：无 Webpack / Vite，`build.js` 一个文件完成构建（shiki 构建期语法高亮，0 运行时开销）
- **双页架构**：主页展示个人形象；工作台（Workspace）是仿文档站的三栏阅读器——左侧分类文档树（每个文件夹首位是自动生成的「Wiki 导览」，列出本目录全部子目录与文章；文件夹可折叠、计数、状态持久化）、中间当前文档阅读区（面包屑可点击跳转到对应文件夹导览 + 标签 + 上一篇/下一篇）、右侧本文目录（TOC 滚动跟随高亮），支持 `Ctrl+K` 全文查找（Zensical 风格结果面板：结果计数 + 分类/日期面包屑 + 标题与正文摘要关键词高亮，`↑↓` 选择、回车打开），`#/slug` hash 路由可直接分享定位
- **文章整页**：每篇长文 / 产品 / 导览构建为独立静态页（`/articles/<slug>.html`），可分享、可收藏，也是工作台阅读器的按需取用数据源
- **沉浸式动效**：入场开屏、暗色流体极光 + 动态星空（闪烁 / 视差 / 流星）、头像 3D 翻转、卡片光斑跟随、滚动进度条
- **博客迁移设计**（借鉴自 Cat-Drink 的 Zensical 博客，按本站风格适配，无 Zensical 依赖）：
  霞鹜文楷字体、时段问候语条、多句循环打字机、GitHub 贡献热力图、Hero 交互网格 Canvas、
  代码块复制按钮、标签页切换彩蛋、页脚一言、菱形分隔线 / 渐变引用等文章排版
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
│   └── blog/             # 全部文档（递归扫描，一级子目录即工作台分类）
│       ├── *.md          # 长文（Front-matter: title/date/summary/tags/read_time + 可选 slug/category/featured）
│       ├── job/          # 求职
│       ├── knowledge/    # 知识库
│       ├── draft/        # 随笔
│       ├── podcast/      # 播客
│       ├── relax/        # 闲聊
│       ├── web/          # 资源分享
│       ├── skills/       # 技能
│       ├── about/        # 关于
│       └── …非 .md 附件  # 图片 / 音频 / PDF 等，构建时复制到 dist/blog/<相对路径>
├── templates/            # 页面骨架（index / workspace / article / 卡片模板）
├── public/               # 静态资源（css / js / 图片），构建时原样复制
├── scripts/              # serve.js 本地预览 · normalize-blog.js 知识库迁移整理工具
└── dist/                 # 构建产物（git 忽略，部署它即可）
```

## ✍️ 写一篇新文章

在 `content/blog/`（或任意分类子目录，如 `content/blog/knowledge/`）新建 `my-post.md`：

```markdown
---
title: "文章标题"
date: "2026-09-06"
summary: "一句话摘要"
tags: ["Tag1", "Tag2"]
read_time: "5 min"
# 可选字段：
# slug: "my-post"       # 自定义 URL（缺省用文件名，重名自动用目录路径派生）
# category: "knowledge" # 工作台分类（缺省取一级目录名，根目录为 blog/长文）
# featured: true        # 出现在主页「精选长文」与首页内容池（缺省只进工作台归档）
---

正文支持完整 Markdown，代码块构建期高亮，允许原始 HTML（图片 / 音频 / 表格等）。
正文里的相对引用附件请放在同目录下，构建时会改写为 /blog/... 绝对路径；
也可直接使用 /blog/<相对路径> 绝对引用。
```

重新 `npm run build` 后：工作台文档归档、`/articles/<slug>.html` 整页会自动生成；标记 `featured: true` 的文章还会出现在主页「精选长文」。

> 知识库批量迁移可用 `node scripts/normalize-blog.js`：自动为旧文档补齐规范 Front-matter（只动元数据，正文逐字节校验零改动），原始 front-matter 备份在 `scripts/normalize-blog.backup.json`。

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
