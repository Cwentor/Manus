---
title: "Douyin Catcher"
tagline: "基于 Tauri 与 React 的桌面端视频管理与抓取工具"
cover: "/assets/products/catcher.svg"
demo_url: "[https://catcher.wanzhou.dev](https://catcher.wanzhou.dev)"
repo_url: "[https://github.com/wanzhou-dev/douyin-catcher](https://github.com/wanzhou-dev/douyin-catcher)"
status: "Active"
tech_stack: ["Tauri", "React", "Rust"]
order: 1
---

## 项目概述

**Douyin Catcher** 是一个面向内容创作者的桌面端视频管理工具：抓取、整理、去重、归档，一条流水线完成。

选择 Tauri 而非 Electron，是因为我们希望在拿到极致启动速度的同时，把包体积压到普通二合一本也能轻松负担的范围。

## 核心能力

- **批量抓取**：粘贴分享口令即可解析视频元信息与下载地址
- **智能归档**：按账号 / 话题 / 时间轴自动生成目录结构
- **本地去重**：基于感知哈希（perceptual hash）识别近似帧，杜绝重复素材
- **Rust 内核**：下载、哈希、元数据解析全部由 Rust 侧完成，内存占用可控

## 技术亮点

在 Rust 侧，我们用一个极简的下载队列把并发控制写得很干净：

```rust
use tokio::sync::Semaphore;

pub struct DownloadQueue {
    limiter: Arc<Semaphore>,
}

impl DownloadQueue {
    pub fn new(concurrency: usize) -> Self {
        Self { limiter: Arc::new(Semaphore::new(concurrency)) }
    }

    pub async fn push(&self, job: Job) -> Result<()> {
        let _permit = self.limiter.acquire().await?;
        fetch_and_save(job).await
    }
}
```

## 一些碎碎念

做这类工具最大的收获是：**工具的价值取决于它多大程度尊重用户的工作流**。与其提供一万个开关，不如把最常用的三条路径做到零摩擦。