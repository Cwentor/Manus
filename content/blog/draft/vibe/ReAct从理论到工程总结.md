---
title: ReAct：从论文到Claude Code工程实现
summary: ReAct = Reasoning + Action，推理 + 行动，是一套强迫大语言模型交替推理与行动的机制。
tags:
  - 随笔
  - vibe
read_time: 3 min
slug: react从理论到工程总结
category: draft
---
# ReAct：从论文到Claude Code工程实现

## ReAct是什么

ReAct = **Re**asoning + **Act**ion，推理 + 行动，是一套强迫大语言模型**交替推理与行动**的机制。

核心思想：不允许模型直接给出答案，强制走**三步循环**直到任务完成：

1. **Thought**：思考分析当前状态，拆解目标，规划下一步
2. **Action**：调用外部工具与真实环境交互
3. **Observation**：读取工具返回的真实结果，作为下一轮Thought的输入

## 为什么需要ReAct

在ReAct之前，两条路都走不通：

- **纯推理（Chain of Thought）**：只靠参数知识推导，遇到截止日期后的信息或动态查询问题，容易产生幻觉
- **纯行动**：直接一步步执行，没有内部规划，复杂任务方向一偏就一路错到底，没有纠偏能力

论文核心结论：**只有交错才能纠错**，静态知识 + 动态验证缺一不可。推理为行动提供方向，行动的结果随时修正推理，模型才能在动态环境里保持准确。

## Google官方解读

- 推理和行动天生互补，规划离不开外部验证，这是ReAct设计的出发点
- **可解释性（白化）**：ReAct把模型的决策过程完全透明化，每一步Thought都留在上下文，开发者可以一步步回溯模型怎么拆解问题、为什么调用工具、怎么根据反馈推翻之前的假设
- **可干预性**：因为推理过程可见，人类可以在任意Thought节点插入修正，不需要重跑整个任务

谷歌认为，这才是让AI系统真正可信赖的工程基础理论。

## Claude Code工程实现

在Claude Code源码中，`queryLoop` 函数就是ReAct模式的字面实现：

**核心结构**：一个while大循环，每轮固定走三步

1. **Thought**：调用流式输出模型推理内容，如果输出包含工具调用，继续下一步；如果没有工具调用，循环退出，任务完成

   > 关键细节：退出条件不是`It's my turn`，而是`complete`

2. **Action**：执行工具调用

   > 关键细节：并不是所有工具并发执行，**只读工具并发，有副作用的写操作串行执行**，这个设计细节文档中没有说明，只有读源码才能发现

3. **Observation**：工具执行完毕后，将assistant messages和tool result一起追加到messages数组，推动下一次循环开始

   > 关键细节：不只是tool result要进去，assistant messages也要一起带上，少了上下文就不完整

## 工具分层架构

Claude Code支撑ReAct循环的工具超过40个，分为5层：

- **执行层**：Bastion、Ripper 直接操作环境
- **文件层**：File Read、File Edit、Create 读写代码库
- **信息层**：Web Search 获取外部知识
- **编排层**：Agent 启动子Agent
- **扩展层**：通过MCP协议接入任意外部系统

每一个工具的输出都是ReAct循环下一轮的Observation。

## 总结：ReAct到底是什么

| 层面 | 本质 |
|------|------|
| 理论层 | 让大语言模型在动态环境**边推理边纠错**的机制 |
| 研究层 | 把黑盒决策过程**白化（可解释）**的工具 |
| 工程层 | Claude Code的`queryLoop`函数中那个while循环，Agent SDK的**调度引擎** |

从2022年一页论文到今天生产环境，核心结构从未改变：**Thought → Action → Observation，三步闭环，循环驱动**。这就是ReAct。

它让大模型从「只能回答问题」变成了「能在真实世界里完成任务」。
