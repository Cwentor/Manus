---
title: "Nebula Notes"
tagline: "离线优先的 PWA 极简笔记，IndexedDB 本地存储 + Markdown 渲染"
cover: "/assets/products/nebula.svg"
demo_url: "[https://notes.wanzhou.dev](https://notes.wanzhou.dev)"
repo_url: "[https://github.com/wanzhou-dev/nebula-notes](https://github.com/wanzhou-dev/nebula-notes)"
status: "Beta"
tech_stack: ["TypeScript", "PWA", "IndexedDB"]
order: 2
---

## 项目概述

**Nebula Notes** 是一个把「数据主权」还给用户的本地优先笔记应用。没有云同步、没有账号体系——你的笔记只属于你自己。

## 设计原则

1. **离线优先**：打开即用，断网不慌，所有数据落在 IndexedDB
2. **极致轻量**：首屏 JS 低于 60KB，打开速度碾压一切 Electron 笔记
3. **语义化搜索**：全文索引 + 标签 + 双向链接三重检索

## 为什么不用云？

我认为笔记工具的终极形态是「本地数据库 + 可选同步」，而不是「云端画板 + 强制联网」。数据在你手里，才是真正的所有权：

```ts
// 一个极简的笔记仓储抽象
interface NoteRepo {
  save(note: Note): Promise<void>;
  find(id: string): Promise<Note | undefined>;
  search(query: string): Promise<Note[]>;
}

const localRepo: NoteRepo = {
  save: (note) => idb.put('notes', note),
  // ...
};
```

## 路线图

- [x] v0.1 本地编辑与渲染
- [x] v0.2 全文索引
- [ ] v0.3 可选 WebDAV 同步
- [ ] v0.4 移动端 PWA 安装体验打磨