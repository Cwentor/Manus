---
title: AI 浏览器技能探究：六条技术路线
summary: 浏览器自动化工具有 50+ 个，底层只有 6 条技术路线。
tags:
  - 随笔
  - vibe
read_time: 3 min
slug: ai浏览器技能探究六条技术路线
category: draft
---
# AI 浏览器技能探究：六条技术路线

浏览器自动化工具有 50+ 个，底层只有 **6 条技术路线**。

## 路线一：CDP 直控（Chrome DevTools Protocol）

- Chrome 浏览器的远程控制协议
- 自动化工具建立 WebSocket 连接，发 CDP 命令过去
- 覆盖页面控制、DOM 操作、网络拦截、JS 执行
- **代表工具**：Playwright（29K+ Star，跨浏览器抽象）、Puppeteer（仅 Chrome）

## 路线二：无障碍树（Accessibility Tree）

- 浏览器为屏幕阅读器维护的纯文本树
- 记录每个元素的角色、名称、状态
- 一个页面约 **500-2000 Token**，性价比极高
- **代表工具**：Ken（Playwright MCP），Token 成本控制极好

## 路线三：截图识别

- 截取页面图片给多模态模型，让 AI 判断该点哪里
- 一张截图约 **5 万 Token**
- 坐标点击便宜但页面布局一变就废
- **2026 年事实标准是无障碍树**（性价比碾压）

## 路线四：云浏览器

- 解决环境隔离问题
- 每次启动全新实例，IP 随机分配，用完销毁
- **代表工具**：BrowserBase、Stealth（企业级）
- 费用：BrowserBase $0.15/小时，Stealth $200+/月

## 路线五：反检测

网站检测机器人的四层机制：
1. **TLS 握手指纹** — 不同浏览器引擎特征不同
2. **Canvas 渲染指纹** — 像素级差异识别
3. **WebDriver 标志位** — 自动化工具留下的标记
4. **鼠标轨迹分析** — 太规律的就是机器人

**代表工具**：Camoufox（基于定制 Firefox，在 C++ 层面修改指纹）

## 路线六：AI 原生

- 传统方式：写选择器（`.submit-btn`），页面一改版就废
- AI 原生：只说"点击提交按钮"，LLM 自己去页面找
- 自愈机制：找错了换个选择器再试
- **代表工具**：Stage（V3 重写为 CDP 直连）、Browser AI（内置子代理）

## MCP 协议的角色

> MCP 是 AI 模型和浏览器之间的标准接口。它不替代任何一条技术路线。

- 没有 MCP：写一堆适配代码
- 有了 MCP：Playwright 暴露标准化工具，Claude 直接调用
- 胶水代码不用写了

## 选型指南

| 场景 | 推荐方案 |
|------|----------|
| 调试 Web 应用 | DevTools MCP（29 个工具：审计、追踪、网络） |
| 通用自动化 | Playwright MCP（2026 默认选择） |
| Coding Agents | Ken（18K Token 压到几百） |
| 反爬虫/反检测 | Camoufox |
| 大规模并行 | BrowserBase |
| AI 原生控制 | Stage V3 / Browser AI |

## 核心结论

> 工具会不停出新，但底层的架构原理就这几条。看到新工具，花 30 秒想它走的是哪条路线，能力边界在哪，心里就有数了。
