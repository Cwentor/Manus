---
title: "FutureBI"
tagline: "企业级 ChatBI / Data Agent：契约约束的 DSL 确定性编译为 SQL"
cover: "/assets/products/futurebi.svg"
repo_url: "[https://github.com/Cwentor/FutureBI](https://github.com/Cwentor/FutureBI)"
status: "Active"
tech_stack: ["Python", "DuckDB", "LLM"]
order: 2
---

## 项目概述

**FutureBI** 是一个面向企业场景的 ChatBI / Data Agent：用自然语言问数，但**绝不让 LLM 直接写 SQL**。

核心思路是把「生成」与「执行」彻底分离：LLM 只负责理解意图并输出**契约绑定的 DSL**，再由确定性编译器把 DSL 编译成可在 DuckDB 上执行的 SQL。

## 为什么这样设计

- **零幻觉**：DSL 受契约约束，字段、聚合、过滤全部合法，不存在「编造列名」
- **零注入**：LLM 触不到 SQL 文本层，提示注入无法越权拼接语句
- **确定性**：同样的 DSL 永远编译出同样的 SQL，可测试、可回放、可审计

## 架构一览

```
自然语言 → LLM(意图理解) → 契约绑定 DSL → 确定性编译器 → SQL → DuckDB 执行
```

DuckDB 作为分析引擎，单机即可跑出不错的交互性能，适合企业内网轻量部署。

## 仓库

源码见 GitHub：[Cwentor/FutureBI](https://github.com/Cwentor/FutureBI)
