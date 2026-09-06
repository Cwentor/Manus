---
title: "零依赖重构：把构建脚本从 120ms 压到 18ms"
date: "2026-05-28"
summary: "一次对构建管线的降本增效实验：去掉重复 IO、引入缓存、并发渲染。"
tags: ["Tooling", "Node.js"]
read_time: "8 min"
---

## 背景

我们的展厅构建脚本最初能跑，但 120ms 的耗时总让人心里发痒。量不大，可每次改动都要等，时间就悄悄流走了。

于是做了一次「性能洁癖」式重构，目标只有一个：**构建速度压进 20ms 以内**。

## 第一步：消灭重复读取

原实现里，模板文件被反复 `readFileSync`，Markdown 元数据被解析两遍。缓存是性价比最高的优化：

```js
const cache = new Map();

function readCached(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8'));
  return cache.get(file);
}
```

## 第二步：并发渲染正文

Markdown 渲染是纯 CPU 密集任务，`Promise.all` 并行渲染三个内容集合，等待时间从「串行之和」变成「最慢之一个」：

```js
const [products, posts, moments] = await Promise.all([
  renderAll('products'),
  renderAll('blog'),
  renderAll('diary'),
]);
```

## 第三步：只写一次文件

最后发现输出阶段在反复 `writeFileSync` 之后又做了二次字符串拼接。改为一次性模板装配，单次写入：

```bash
$ node build.js
✔ 静态资源已复制
✔ 初始化 shiki 语法高亮 …
✔ 装配 templates/index.html …
✔ 构建完成：dist/index.html（18.2ms）
```

## 复盘

| 优化项 | 收益 |
| --- | --- |
| 读取缓存 | -38ms |
| 并发渲染 | -46ms |
| 单次写入 | -18ms |
| **合计** | **102ms → 18ms** |

其实这 18ms 里有一半是 Shiki 主题加载的固定成本。当工具快到你察觉不到，你才会真正愿意频繁重建——这就是「构建期掌控感」带来的正反馈循环。