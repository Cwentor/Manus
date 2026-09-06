---
title: 三分钟了解 Loop Engineering
date: '2026-06-17'
summary: 这周 AI 圈炸锅了——就因为六个字：「别再写 prompt 了」。这条推来自「小龙虾之父 Peter St. Petersburg」，七百万人围观，评论直接…
tags:
  - 知识库
  - agent
  - Agent
  - Loop Engineering
read_time: 5 min
slug: 2026-06-17-3分钟了解loop-engineer
category: knowledge
---

# 三分钟了解 Loop Engineering

这周 AI 圈炸锅了——就因为六个字：「别再写 prompt 了」。这条推来自「小龙虾之父 Peter St. Petersburg」，七百万人围观，评论直接吵翻。两派阵营泾渭分明：一派说这是未来，一派说这不就是 cron job 换个马甲吗。我翻了一圈评论，发现两边都没说到点子上。

到底什么意思？不是说你完全不用写 prompt 了，而是说你不应该直接去 prompt 你的 agent。你应该设计一套 loop，让 loop 去帮你 prompt。评论区有人问「这具体长什么样？」，最高赞回答居然是「没人知道」。也是，除了那条七百多万浏览的推文，没人真的讲清楚。

但真的没人懂吗？Claude Code 的创造者在演讲里说过一段话：我现在不 prompt Claude 了，我设计 loop，让 loop 去 prompt Claude。我的工作就是写 loop。过去 30 天，他的 259 个 PR 全部都是 Claude Code 自动完成的。他从去年 11 月就删掉了 IDE，到现在再也没打开过。

怀疑派也不是没道理。有人直接怼：不就是 job 换了个时髦包装吗？说实话，这话只对了一半——调度层确实就是 cron 那回事。但区别在：cron 跑的是写死的脚本，loop 跑的是一个会做决策的模型。它观察状态，决定下一步，执行，检查结果，再决定要不要继续。决策权在 agent 手里，不在你硬编码的代码里。

两边吵够了，该我来讲清楚 loop 到底是怎么一步步走到今天的。2022 年，ReAct 论文出来：模型推理，调用工具，看结果，循环。2023 年，AutoGPT 爆火：自己 prompt 自己，结果无限空转。2025 年 7 月，有人用一个 batch 脚本反复为同一个 prompt 工作，花 297 美元交付了一个报价 5 万美元的外包项目。2026 年，Codex 和 Claude Code 把 loop 产品化。到了今天，loop 开始监督 loop，用 Git 做状态持久化，真的扛得住崩溃和重启了。五年五级台阶，从一个简单的 while 循环，变成一个能自我编排、自我修复的系统。

那问题来了：一个真正能跑的 loop 到底需要什么？Google Cloud AI 总监拆得最明白——五个零件加一个记忆层：automations、work trees、skills、plugins、sub-agents，最后再加 memory。现在的 Codex 和 Claude Code 已经把这些都配齐了。

Automations 按计划自动跑，自己发现问题，自己分类。Work trees 给每个 agent 一个独立工作树，并行干活，互不干扰。Skills 把项目知识写成文档，你不写的话 agent 就只能靠猜。Plugins 把 agent 接入 GitHub、Slack、Linear，让它能触碰到你真实的工作环境。Sub-agents 更重要，一个负责想方案，一个负责验证，提案和审核的不能是同一个 agent。

还有第六个东西，看起来不起眼但最重要：记忆。一个 Markdown 文件也行，一个 Linear board 也行，只要能记着什么做完了、什么还没做。听起来太简单了，但所有能长期跑的 agent 全靠它——模型每次跑完就忘。所以记忆必须存在磁盘上，不能只放在上下文里。Agent 会忘，但 report 不会丢。

时间再往前推，2023 年所有人都在讲 prompt engineering：怎么写 prompt、怎么调温度、怎么做 few-shot。核心假设很简单：你说的越清楚，模型就干得越好。到 2025 年风向变了，有人说了一句话：context engineering 才是正事。不是你怎么说，而是你把什么文档、代码、历史对话、工具输出打包成一个上下文喂进去。从怎么问变成了怎么喂。

再往后是 harness engineering：不止喂，还要编排。哪个 agent 负责规划，哪个负责实现，哪个负责验收。三个角色可以是三个不同的模型，规则、工具、权限、验收标准全都要配齐。从怎么喂变成了怎么管。

然后就是今天讲的 loop engineering。Harness 搞定了一次任务的编排，loop 解决的是让它反复跑：自动触发、自动恢复、状态持久化，跑完一轮自己决定下一轮做什么。从怎么管变成了怎么让它自己转。

四个阶段连成一条线：prompt、context、harness、loop。你操心的具体事情越来越少，但你要设计的系统越来越重。

但这一切是有代价的。据彭博社报道，Uber 直接给工程师设了上限：每人每个工具每月最多 1500 美元。因为有人四个月就把全年的 AI 预算烧完了。所以 2026 年所有严肃的 loop 方案最后都收敛到同一个地方：三个刹车——最大循环次数、没进展就停，再加预算上限。你要是哪天想试，先把这三个装上再松手。

从 prompt 到 context 到 harness 再到 loop，我们一路走到今天。一个真正 24 小时不休息的助手时代真的来了。你睡觉的时候他在跑，你开会的时候他在跑，你周末出去玩的时候他还在跑。而且他不是瞎跑，他知道该做什么、做完了怎么复盘、复盘过了怎么优化。
