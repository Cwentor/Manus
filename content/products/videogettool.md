---
title: "VideoGetTool"
tagline: "轻量优雅的抖音 / B 站视频获取桌面工具，解析下载一条龙"
cover: "/assets/products/videogettool.svg"
repo_url: "[https://github.com/Cwentor/VideoGetTool](https://github.com/Cwentor/VideoGetTool)"
status: "Active"
tech_stack: ["Tauri", "Python", "桌面应用"]
order: 1
---

## 项目概述

**VideoGetTool** 是一个开箱即用的桌面端视频获取工具：粘贴链接，剩下的交给它。

支持抖音、B 站等主流平台的短视频、图文、长视频解析与下载，把「找到内容 → 保存到本地」这条路径做到零摩擦。

## 核心能力

- **多形态解析**：短视频、图集图文、长视频全覆盖
- **灵活抓取**：单链接 / 批量队列 / 主页订阅三种模式
- **断点续传 + 并发加速**：大文件不怕中断，多任务并行拉满带宽
- **开箱即用**：基于 Tauri 的轻量桌面端，安装即用，无需配置环境

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳 | Tauri |
| 解析与下载内核 | Python |
| 分发形态 | 安装包，开箱即用 |

Tauri + Python 的组合兼顾了界面轻量与解析生态：Python 侧丰富的解析库负责应对各平台规则变化，Tauri 保证包体积与启动速度。

## 仓库

源码与发布包见 GitHub：[Cwentor/VideoGetTool](https://github.com/Cwentor/VideoGetTool)
