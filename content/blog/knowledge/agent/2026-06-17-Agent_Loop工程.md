---
title: Agent Loop工程
date: '2026-06-17'
summary: 最近外网讨论最猛的不再是怎么写提示词，而是一个新词：Loop。Loop 直译就是循环，那它到底解决了什么问题？其实你想想过去我们用 AI 的方式就明白了，你写…
tags:
  - 知识库
  - agent
  - Agent
  - Loop Engineering
read_time: 12 min
slug: 2026-06-17-agent-loop工程
category: knowledge
---

# Agent Loop工程

<div class="highlight-box highlight-warning">
  <span class="key-point">🔥 2026 年下半年 AI 圈最火的概念 --- </span>
</div>
<span class="highlight-text">别再写 Prompt 了，赶紧来设计 Loop！</span>

最近外网讨论最猛的不再是怎么写提示词，而是一个新词：**Loop**。Loop 直译就是循环，那它到底解决了什么问题？其实你想想过去我们用 AI 的方式就明白了，你写 prompt，AI 给结果，结果不满意你再改 prompt，指出问题，重新来一遍。看起来是 AI 在干活，其实每一轮都要你盯着，你不是老板，你更像 AI 的专职保姆。Loop 想解决的就是这件事。

举个例子，你让 AI 做一个活动页面，只给它一个目标——今晚八点前交付一个能上线的报名页。第一轮它生成了页面，但按钮点了没反应，第二轮它自己跑测试，发现是跳转链接没配置，于是修复，第三轮独立评审检查页面，发现首屏文案不清楚，加载速度太慢，要求重新优化，第四轮它把按钮漏配、首屏表达弱、图片过大这些问题记下来，带着上一轮的记录继续优化，直到页面通过测试评审确认合格，才把最终版本交给你。这就是 Loop。

对比一下过去的 Prompt 模式和现在的 Loop 模式，你就能看出核心区别。Prompt 模式要求人参与每一次修正，你是保姆，全程盯着；而 Loop 模式是你设定目标和验收标准，让 AI 自己试错，自己复盘，自己迭代，你是老板，只做最终验收。所以现在很多 Agent 工具里都会出现 goal（目标）、rule（规则）、memory（记忆）、review（评审）这类模块。

Loop 真正的关键不是让 AI 一直跑——一直跑只会烧 token。关键是每一轮都要留下清晰记忆，错了什么？错在哪里？下一轮怎么改？如果一个 Agent 只记得最后一轮对话，那它能循环，但很难稳定变强。更好的方式是让它在循环过程中持续写笔记，把失败判断经验沉淀下来，这样优化才不是重复劳动，而是在积累组织资产。

Loop 带来的最明显变化就是角色转变，我们不再是全程监督 AI 的人，而是最后验收结果的人，而且独立裁判机制能减少 AI 幻觉——AI 自己说完成不算，必须通过验收标准才算完成。但要注意，Loop 不是魔法，如果你自己没有规则，没有专业判断，盲目开启自动循环，AI 可能只会批量生成一堆看起来很精致，实际没用的内容。所以真正重要的不是让 AI 循环起来，而是先定义清楚目标是什么，标准是什么，失败怎么记录，谁来验收。

> **Prompt 时代比的是谁会提问，Loop 时代比的是谁会设计系统。**

从写提示词到设计系统，这是 AI 开发范式的重要转变。

---

这事儿是怎么火起来的？

<div class="highlight-box">
  <span class="key-point">📰 最近的大事</span>
</div>

- **6月7号**：Open Cloud 的创始人 Pat Stenberg 说：「大伙别再写 Prompt 了，应该转而设计 Loop！」（这条推特 <span class="highlight-text">220 万浏览量</span>）
- **6月2号**：Cloud Code 的创始人 Boris 也说：「我现在根本不写 Prompt，我的工作就是写 Loops」

### 为什么是现在？
- **一年前**：要自己写一堆脚本来实现自动化
- **现在**：主流产品（比如 Cursor、Cloud Code）都已经内置了这些功能
- <span class="highlight-text">关键点：工具不再是问题了，设计 Loop 才是现在的瓶颈</span>

<div class="highlight-box highlight-danger">
  <span class="key-point">🎯 这事儿的本质</span>
</div>

- **瓶颈变了**：以前的瓶颈是 AI 模型不够聪明，现在的瓶颈是——<span class="key-point">人在循环里太累了</span>
- <span class="highlight-text">Agent Loop 就是来解决这个的：把人从重复的循环里解放出来</span>

---

## 什么是 Agent Loop？

<div class="highlight-box highlight-success">
  <span class="key-point">🤖 自动化团队</span>
</div>

你可以把它想象成一个<span class="highlight-text">自动化团队</span>：
- 以前是你自己干，或者盯着 AI 一步步干
- 现在是给 AI 搭好一个工作流程，让它们自己循环着干

### 搭建 Agent Loop 的六个零件

<div class="highlight-box">
  <span class="key-point">🧩 六个核心零件</span>
</div>

| 零件 | 用大白话解释 |
|------|-------------|
| **Automation** | 自动化：让事情自己跑 |
| **Work Trees** | 工作树：相当于给不同任务分文件夹 |
| <span class="highlight-text">**Skills**</span> | 技能：像公司里的 SOP 手册，一套成熟的操作流程 + 说明文档，必要时还带脚本 |
| **Plugins/Tools** | 插件/工具：给 AI 用的工具箱 |
| <span class="highlight-text">**Subagents**</span> | 子代理：就像团队里的不同角色，分工合作 |
| **Memory** | 记忆层：用 Markdown 文件记录，每次对话都会加载进去，不会忘事儿 |

<div class="highlight-box highlight-success">
  <span class="key-point">⭐ 为什么「技能（Skill）」这么重要？</span>
</div>

- **没有技能的情况**：每次都从零开始问，<span class="highlight-text">浪费钱（token）也浪费时间</span>
- **有技能的情况**：就像一个不断成长的团队，难事儿解决了就变成经验，下次直接用
- 结果是：<span class="key-point">运行更快、次数更少、成本更低</span>

<div class="highlight-box highlight-warning">
  <span class="key-point">🔄 为什么还要「子代理（Subagent）」？</span>
</div>

- 你有没有发现：AI 对自己写的代码总是挺宽容的？总觉得自己写得挺好
- 这时候就需要另一个 AI（子代理）来打分和检查
- <span class="key-point">核心原则：写代码的（Maker）和检查代码的（Checker）要分开，用子代理实现</span>

---

## 设计 Loop 的五步法（手把手教）

<div class="highlight-box highlight-danger">
  <span class="key-point">🔴 第一步：定义「什么叫做完」（最重要！）</span>
</div>

- 停止条件必须<span class="highlight-text">非常清楚，能写成代码那样明确</span>，不能是模糊的想法
- 举几个常见的「做完」标准：
  - 所有测试都通过了
  - 输出的格式和我们预先定好的一样
  - 文档质量评分超过了阈值（比如 8 分）

<div class="highlight-box">
  <span class="key-point">第二步：搭建/组装上下文</span>
</div>

- 每一轮对话的上下文都不一样
- 根据当前的状态自动组装，这样 AI 知道现在是什么情况

<div class="highlight-box">
  <span class="key-point">第三步：执行并记录结果</span>
</div>

- 让 AI 去干活，把结果记录下来

<div class="highlight-box highlight-warning">
  <span class="key-point">🔄 第四步：用反馈把循环闭合</span>
</div>

- 把上一轮失败的信息整合到下一轮的提示里
- <span class="key-point">划重点：失败信息是下一轮成功的关键，丢了就断了反馈链</span>

<div class="highlight-box highlight-danger">
  <span class="key-point">🛡️ 第五步：安装护栏（安全措施）</span>
</div>

- <span class="highlight-text">最大迭代次数</span>：一般设 15-50 次，防止无限循环
- <span class="highlight-text">无进展检测</span>：如果卡住不动了，就自动结束
- <span class="highlight-text">Token 上限</span>：防止跑一晚上烧掉几千美金（这事儿真的发生过）

---

## 六个多 Agent 团队阵型

<div class="highlight-box highlight-warning">
  <span class="key-point">⚠️ 单个 Agent 的局限</span>
</div>

单个 Agent 有局限：上下文装不下太多、创新容易遇到瓶颈、出问题难恢复

<div class="highlight-box">
  <span class="key-point">🏛️ 多 Agent 阵型</span>
</div>

| 阵型 | 什么时候用 |
|------|-----------|
| **简单流水线** | 线性任务，一步一步来 |
| <span class="highlight-text">**协调者-工作者模式**</span> | 一个管事儿的（协调者）在上面指挥，下面多个干活的（工作者） |
| **并行合并** | 比如要审计 200 个文件、或者查多个数据源，各干各的，干完汇总就行 |
| <span class="highlight-text">**并行通信**</span> | 比如五个 Agent 一起搜数据，谁发现了新线索就同步给其他四个，大家一起优化搜索方向 |

### 常见的五个失败模式
- <span class="highlight-text">上下文污染</span>：信息乱了
- <span class="highlight-text">级联失败</span>：一个错了，后面全错
- <span class="highlight-text">范围蔓延</span>：任务越干越多，收不住
- ...（还有其他的）

---

## 怎么省钱？Token 成本优化

<div class="highlight-box highlight-danger">
  <span class="key-point">💰 导致 Token 烧钱的六大坑</span>
</div>

1. 没有检查和停止条件（<span class="highlight-text">根本停不下来</span>）
2. 没有把上一轮的失败信息整合到下一轮
3. ...（还有其他）

<div class="highlight-box highlight-success">
  <span class="key-point">💡 省钱小技巧</span>
</div>

- **协调者只负责路由，不负责思考**：输出就是简单的数字（12345）或者方向（东南西北中），非常短，省 token
- <span class="highlight-text">输出比输入更贵</span>：省输出是四两拨千斤，效果比省输入好多了

---

## 从「写 Prompt 的」到「设计 Loop 的」

<div class="highlight-box highlight-warning">
  <span class="key-point">📈 能力要求升级了</span>
</div>

- **以前**：能写一条好的提示词就行
- **<span class="key-point">现在：要设计整个系统</span>**
  - 熟悉系统的每个零件
  - 测试系统稳不稳、管用不管用
  - 稳定好用的同时还要省钱
  - 能在真实生产环境中运行

---

## 从零开始的五步检查清单

<div class="highlight-box highlight-success">
  <span class="key-point">✅ 五步检查清单</span>
</div>

1. <span class="highlight-text">任务分解</span>：把大任务拆成小任务
2. <span class="highlight-text">专家识别</span>：想想每个环节需要什么样的「专家」
3. <span class="highlight-text">通信设计</span>：这些「专家」之间怎么沟通
4. <span class="highlight-text">契约治理</span>：写个类似 Cloud.md 的文件，定好规则
5. <span class="highlight-text">运行前检查表</span>：跑之前再检查一遍
