---
title: "photo-get-skill"
tagline: "零依赖免版权图片搜索下载工具，agent 一句话完成搜图落盘"
cover: "/assets/products/photo-get-skill.svg"
repo_url: "[https://github.com/Cwentor/photo-get-skill](https://github.com/Cwentor/photo-get-skill)"
status: "Active"
tech_stack: ["JavaScript", "Node.js", "Agent Skill"]
order: 5
---

## 项目概述

**photo-get-skill**（原名 photo-get-mcp）v2.0 起从 MCP 服务器迁移为 **agent skill 包**：装进 agent 的 skills 目录后，对它说一句「帮我找几张海边的图」，搜图与下载自动完成。

本体是一个零依赖的 CLI：纯 Node.js ≥ 18 内置模块实现，无需 `npm install`。

## 核心能力

- **6 个图源**：Pixabay / FreerangeStock / Pexels / Picjumbo / Noun Project / Magnific，默认 `pixabay,freerangestock` 开箱即用
- **批量下载**：单次 1–200 张，多来源自动分配数量并去重
- **三种尺寸**：preview 预览图 / webformat 网络尺寸（默认）/ large 原始大图
- **先看后下**：`--dry-run` 只预览不落盘；单来源失败记入 `search_warnings`，不影响整体
- **安全搜索**：Pixabay 源默认过滤成人内容，可关闭
- **结构化输出**：成功输出 JSON、exit 0；失败输出 `{"error": ...}`、exit 1，方便 agent 解析

## 使用方式

1. `git clone` 后运行 `install.ps1`（Windows）或 `install.sh`，安装到 agent 的 skills 目录
2. 或者直接命令行：`node scripts/cli.mjs --keyword "sunset beach" --count 5 --save-dir D:/images/sunset`
3. 测试全部离线可跑（63 个用例），`RUN_LIVE=1` 启用真实网络测试

## 仓库

源码见 GitHub：[Cwentor/photo-get-skill](https://github.com/Cwentor/photo-get-skill)（MIT License）
