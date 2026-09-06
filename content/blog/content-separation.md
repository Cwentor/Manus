---
title: "浅析现代前端与内容分离架构"
date: "2026-05-12"
summary: "探讨为什么我们要把 Markdown 当成纯数据库，而不是排版画板。"
tags: ["Architecture", "Engineering"]
read_time: "6 min"
---

## 一个反直觉的结论

前端发展了十几年，工具链越来越重，但内容生产的本质没有变：**写作的人想专注写字，发布的人想秒级上线**。当两者被同一套 UI 框架绑死，任何一方的改动都会牵动另一方。

内容与 UI 彻底分离，就是把这两件事的契约写死在构建期。

## 什么是「内容即数据」

核心思想只有一条：**Markdown 是数据库，不是画板**。

> 写作的人负责内容资产，构建脚本负责呈现形式——两者只在 Front-matter 的字段契约上见面。

- Front-matter 是表结构，字段即契约
- 正文是数据行，语法即约束
- 构建脚本是查询引擎，模板是视图层

```js
// 一个"查询引擎"的最小实现
const { readFileSync, readdirSync } = require('node:fs');
const matter = require('gray-matter');

function query(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => matter(readFileSync(`${dir}/${f}`, 'utf8')))
    .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
}
```

## 禁止内联 HTML 的真正理由

很多人觉得「Markdown 里插一点 HTML 无伤大雅」，但这是滑坡的开端：

1. 内容层开始依赖 UI 细节，重构成本转移到写作侧
2. 同一份内容无法换肤、无法导出、无法被其他消费端复用
3. 评审与协作时，差异对比被无意义的标签噪音淹没

所以我们的规则很硬：**`html: false`，渲染器直接拒绝原始 HTML**。

## 构建期的价值

把高亮、渲染、排序全部放进构建期，页面就变成纯静态的「零计算产物」：

- 客户端不再加载任何 Markdown 解析器
- Shiki 在 CI 里完成语法高亮，用户拿到的是渲染好的 HTML
- 打开即秒开，无首屏 JS 阻塞

## 结语

内容分离不是技术洁癖，而是一种**长期主义**：它让内容资产脱离任何单一技术栈而独立存在。十年后框架会过时，你的 Markdown 不会。

---

> 十年后框架会过时，你的 Markdown 不会。