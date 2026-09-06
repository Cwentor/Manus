---
title: 【干货】LangGraph / CrewAI 等 Agent 框架对比
summary: '------------------'
tags:
  - 随笔
  - vibe
read_time: 2 min
slug: 干货langgraph与crewai等agent框架对比
category: draft
---
# 【干货】LangGraph / CrewAI 等 Agent 框架对比

## 现状速览

| 框架 | 状态 | 评价 |
|------|------|------|
| LangGraph | ⚠️ 还有人用，但会被嘲笑 | 过度设计、太复杂、调试不方便 |
| CrewAI | ⚠️ 快速跑 Demo 可以，生产环境坑多 | 黑盒太多，封装过重 |
| AutoGen | ❌ 基本学术界在用 | 工业落地很少用 |
| LangChain | ❌ 已过时 | 底层依赖重 |
| Pydantic AI | ✅ 推荐 | 轻量级，数据校验，简单 |
| OpenAI SDK / Anthropic SDK | ✅ 推荐 | 越来越强，直接用 SDK |
| LLM Index | ✅ 特定场景 | 专门面向 RAG |

## LangGraph 为什么不再受欢迎

1. **太复杂**：节点、状态流转、Agent 间状态交接，上手不方便
2. **过度设计**：80% 以上的业务场景用简单的 if/else 条件判断就够
3. **调试困难**：多 Agent 场景下状态管理混乱

## CrewAI 的问题

- Demo 阶段很容易上手（角色分工协作）
- 生产环境坑多：Agent 互相交流停不下来、甚至开始闲聊
- 控制困难、封装太黑盒
- 早期基于 LangChain，底层依赖重

## 现在大家在实际用什么？

### 方案一：AI Native 公司
- 直接用 OpenAI / Anthropic 原生 SDK
- SDK 越来越强，控制粒度更细
- 透明度高、可监控、性能好
- 可做精细化的状态管理和记忆管理

### 方案二：务实派
- Pydantic AI 这类轻量级框架
- 只提供数据校验和数据结构定义
- 保持简单，配合传统软件工程方法

## 未来趋势

1. **Long-running Agent（长城 Agent）**：后台运行几小时/几天，自己规划拆解任务，关键节点再让人审批
2. **Managed Agent 平台**：Claude 和 OpenAI 都推出了管理平台——只需告诉平台 Agent 的人设、目标、工具，运行和管理由平台负责
3. **回归经典软件工程**：90%+ 还是传统的高可用、并发、权限控制

## 思考

> AI Engineer 这个职业本身的护城河越来越浅。技术壁垒被 AI 大幅降低，未来竞争力更多在产品能力和测试能力上。
