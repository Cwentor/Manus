---
title: "photo-get-mcp"
tagline: "基于 MCP 协议的免版权图片搜索下载服务器"
cover: "/assets/products/photo-get-mcp.svg"
repo_url: "[https://github.com/Cwentor/photo-get-mcp](https://github.com/Cwentor/photo-get-mcp)"
status: "Active"
tech_stack: ["JavaScript", "Node.js", "MCP"]
order: 5
---

## 项目概述

**photo-get-mcp** 是一个基于 MCP（Model Context Protocol）协议的图片抓取服务器：让 AI 客户端一句话完成「搜图 + 下载到本地」。

提供一个 `search_and_download_images` 工具，Claude Desktop、Cursor 等支持 MCP 的客户端可以直接调用。

## 核心能力

- **多图库搜索**：Pixabay / Picjumbo 两个免版权图源，按关键词检索
- **批量下载**：单次 1–200 张，多来源自动分配数量并去重
- **三种尺寸**：150px 预览图 / 640px 网络尺寸 / 原始大图
- **安全搜索**：过滤成人内容（Pixabay 源）
- **完整元数据**：返回本地路径、原始 URL、作者、标签等信息

## 使用方式

1. `npm` 安装，要求 Node.js ≥ 18
2. 在 Claude Desktop / Cursor 等 MCP 客户端中注册该服务器
3. 对话中直接说「帮我找 20 张海边的免版权图并下载」，工具自动完成搜索与落盘

## 仓库

源码见 GitHub：[Cwentor/photo-get-mcp](https://github.com/Cwentor/photo-get-mcp)（MIT License）
