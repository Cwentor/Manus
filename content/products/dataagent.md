---
title: "DataAgent"
tagline: "企业级数据 Agent：受控 DSL 确定性编译为 SQL，把 LLM 关进契约的笼子"
cover: "/assets/products/dataagent.svg"
repo_url: "[https://github.com/Cwentor/DataAgent](https://github.com/Cwentor/DataAgent)"
status: "Active"
tech_stack: ["Python", "DuckDB", "LangGraph", "LLM"]
order: 2
---

## 项目概述

**DataAgent** 是一个企业级数据智能体（Data Agent）：用自然语言问数，但**绝不让 LLM 直接生成裸 SQL**。

链路是把「生成」与「执行」彻底分离：LLM 只负责理解意图并输出**受控 DSL**，再由确定性编译器把 DSL 编译成可在 DuckDB 上执行的 SQL——零幻觉、零注入、零随意 Join。

## 为什么这样设计

- **受限 DSL 契约**：Pydantic V2 + `extra="forbid"`，字段、操作符、聚合全部白名单枚举，越界 JSON 在编译前即被拒绝
- **确定性编译**：SQL 只由编译器生成，支持聚合、比率、时间窗口、补零、Top-N、同比环比
- **纵深安全**：JWT + Session 认证、表/列/行级 RLS 强制注入、sqlglot AST 审计在执行前熔断只读违规，扫描与返回行数设上限
- **裸 SQL 三重防线**：字符串载荷、SQL 键、自由文本 SQL 在网关层直接拒绝

## 编排与沙箱

- **LangGraph StateGraph**：澄清（HITL）→ 规划 → 受控取数 → 沙箱分析 → 反思重规划 → 综合报告，六节点单引擎，SSE 流式推送九类事件
- **审批门**：`interrupt` 泛化审批（澄清 / 计划评审 / 高危二次确认），L1–L4 自主性分级，受控自愈 ≤ 3 次
- **沙箱代码解释器**：AST 静态守卫 + Docker 强隔离（断网、全量 drop capability），数据 PII 脱敏后物化为 Parquet，可 sha256 审计
- **归因技能包**：熵下钻、乘法分解树（GMV = UV × CR × AOV）、加法差额分解、DTW、Holt-Winters 异常检测、Shapley 值归因，均与解析解对拍
- **多模型网关**：OpenAI / Anthropic / Gemini 多协议适配，支持请求级模型切换

## 技术栈

| 层 | 选型 |
| --- | --- |
| 编排 | LangGraph StateGraph |
| 服务层 | FastAPI / uvicorn |
| 分析引擎 | DuckDB |
| 前端 | 原生 JS + ECharts，零框架 |

生产运行时仅 4 个依赖（pydantic、duckdb、python-dotenv、sqlglot），质量保障有 pytest 766 用例与 Golden 评测 25 用例，适合企业内网轻量部署。

## 仓库

源码见 GitHub：[Cwentor/DataAgent](https://github.com/Cwentor/DataAgent)（MIT License）
