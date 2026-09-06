---
title: Skill：pretext-frontend-design
summary: 使用 @chenglou/pretext 进行高性能文本测量与布局的前端设计 skill。适用于需要精确文本排版、避免 DOM reflow、实现虚拟化/缩紧包裹/手动逐行布局等场景。当你需要做 Canvas/SVG 文本渲染、文本高度预计算、富文本内联流排版时触发此 skill。
tags:
  - 技能
  - pretext-frontend-design
read_time: 11 min
slug: skills-pretext-frontend-design-skill
category: skills
---

# Pretext 前端文本布局设计

这个 skill 指导你使用 `@chenglou/pretext` 库在前端项目中实现高性能、精确的文本测量和排版。

## 为什么用 Pretext

传统的 `getBoundingClientRect`、`offsetHeight` 等方法会触发浏览器 layout reflow，是前端最昂贵的操作之一。Pretext 完全绕开 DOM 测量，使用 Canvas 测量字体实际宽度，然后纯算术计算行高、换行位置，避免一切 DOM 重排。

## 安装

```sh
npm install @chenglou/pretext
```

## 两大使用场景

### 场景一：纯测量段落高度（不碰 DOM）

当你只需要知道一段文本在某个宽度下的高度时：

```ts
import { prepare, layout } from '@chenglou/pretext'

const prepared = prepare('AGI 春天到了. بدأت الرحلة 🚀‎', '16px Inter')
const { height, lineCount } = layout(prepared, 320, 20) // 纯算术，无 DOM reflow
```

- `prepare()` 做一次性预处理：规范化空白字符、分词、测量每段文本宽度，返回一个不透明的 handle
- `layout()` 是 resize 热路径：纯算术对缓存宽度做换行计算，**不要在同一文本上重复调用 `prepare()`**
- 在 resize 时只需重新调用 `layout()`

**适用于：**
- 虚拟滚动/列表的正确高度预估（告别不准确的估算和缓存）
- 用户自定义布局：瀑布流、JS 驱动类 flexbox 实现
- 开发时验证：确认按钮标签不会溢出换行（无需打开浏览器）
- 新文本加载时防止布局偏移（稳定滚动位置）

**特殊模式：**

```ts
// textarea 风格：保留空格、\t、\n
const prepared = prepare(textareaValue, '16px Inter', { whiteSpace: 'pre-wrap' })
const { height } = layout(prepared, textareaWidth, 20)

// 中日韩/韩文不拆词
const prepared = prepare(text, '16px Inter', { wordBreak: 'keep-all' })

// 匹配 CSS letter-spacing
const prepared = prepare(text, '16px Inter', { letterSpacing: 1.5 })
```

### 场景二：手动逐行布局（Canvas、SVG、WebGL 渲染）

当你需要自己控制每一行文本的渲染位置时：

```ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const prepared = prepareWithSegments('AGI 春天到了. بدأت الرحلة 🚀', '18px "Helvetica Neue"')
const { lines } = layoutWithLines(prepared, 320, 26)

for (let i = 0; i < lines.length; i++) {
  ctx.fillText(lines[i].text, 0, i * 26)
}
```

**适用于：**
- Canvas 文本编辑器
- SVG 数据可视化中的文本标签
- WebGL 文本渲染
- 服务器端文本预布局

### 高级功能：Shrinkwrap（缩紧包裹）

找到正好包裹多行文本的最小宽度——这是 Web 端一直缺失的能力：

```ts
import { measureLineStats, walkLineRanges } from '@chenglou/pretext'

const { lineCount, maxLineWidth } = measureLineStats(prepared, 320)

let maxW = 0
walkLineRanges(prepared, 320, line => { if (line.width > maxW) maxW = line.width })
// maxW 现在是最宽行的宽度——刚好容纳文本的容器最小宽度
```

### 高级功能：可变宽度逐行布局（浮动图像环绕等）

当每行宽度不同时（例如环绕浮动图像）：

```ts
import { layoutNextLineRange, materializeLineRange, prepareWithSegments } from '@chenglou/pretext'
import type { LayoutCursor } from '@chenglou/pretext'

const prepared = prepareWithSegments(article, BODY_FONT)
let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
let y = 0

while (true) {
  const width = y < image.bottom ? columnWidth - image.width : columnWidth
  const range = layoutNextLineRange(prepared, cursor, width)
  if (range === null) break

  const line = materializeLineRange(prepared, range)
  ctx.fillText(line.text, 0, y)
  cursor = range.end
  y += 26
}
```

### 高级功能：软连字符

插入 soft hyphen（`\u00AD`）来实现可选断词：

```ts
const text = 'hyphen\u00ADation'
const prepared = prepareWithSegments(text, font)
// 如果断在 soft hyphen 处，行尾会自动带 '-'
```

### 富文本内联流（辅助模块）

用于代码标记、@提及、标签(chips)等内联富文本：

```ts
import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges
} from '@chenglou/pretext/rich-inline'

const prepared = prepareRichInline([
  { text: 'Ship ', font: '500 17px Inter' },
  { text: '@maya', font: '700 12px Inter', break: 'never', extraWidth: 22 },
  { text: "'s rich-note", font: '500 17px Inter' },
])

walkRichInlineLineRanges(prepared, 320, range => {
  const line = materializeRichInlineLineRange(prepared, range)
  // 每个 fragment 包含 itemIndex、text、gapBefore、occupiedWidth、start/end 光标
})
```

- `break: 'never'` 保持原子项（chip、mention）不被拆分
- `extraWidth` 用于 chip 的额外边距（padding + border）
- 仅支持 `white-space: normal`

### 其他辅助 API

```ts
import { clearCache, setLocale } from '@chenglou/pretext'

clearCache()  // 清理共享缓存（多字体/多文本场景）
setLocale('ar') // 设置分词 locale（影响 prepare()）
```

## 设计时注意事项

1. **`prepare()` vs `prepareWithSegments()`**：如果只需要高度，用前者（更快）；如果需要获取每行具体文本内容，用后者。

2. **`font` 格式**：和 `canvasContext.font` 一样，例如 `'16px Inter'`、`'bold 18px "Helvetica Neue"'`。

3. **不要用 `system-ui`**：在 macOS 上 canvas 和 DOM 可能解析出不同字体，导致测量不准。始终使用具体字体名。

4. **空文本处理**：`layout()` 空字符串返回 `{ lineCount: 0, height: 0 }`。浏览器会给空块一个 line-height，所以如果需要和 DOM 一致，用 `Math.max(1, lineCount) * lineHeight`。

5. **不依赖 DOM**：Pretext 不需要 DOM，完全基于 Canvas 2D API，所以可以在 Web Worker 甚至服务器端（Node.js + node-canvas）运行。

6. **CSS 限制**：当前仅支持 `white-space: normal | pre-wrap`、`word-break: normal | keep-all`、`overflow-wrap: break-word`、`line-break: auto`。不支持完整的 CSS 文本模型。

7. **`letter-spacing` 必须和 CSS 同步**：`prepare()` 的 `letterSpacing` 值是 CSS px 值，必须和实际 CSS `letter-spacing` 一致。

8. **`lineHeight` 必须在 layout 时传入**：`prepare()` 只做水平方向测量，垂直方向在 `layout()` 时处理。

9. **运行时要求**：需要 `Intl.Segmenter` 和 Canvas 2D text measurement。

## 典型使用模式

### 虚拟滚动高度计算

```ts
const prepared = prepare(longText, '14px system-ui')
function getHeight(width: number) {
  return layout(prepared, width, 20).height
}
```

### Canvas 文本编辑器

```ts
const prepared = prepareWithSegments(content, editorFont, { whiteSpace: 'pre-wrap' })
const { lines } = layoutWithLines(prepared, editorWidth, lineHeight)
for (const line of lines) {
  ctx.fillText(line.text, paddingLeft, y)
  y += lineHeight
}
```

### 文本自适应容器

```ts
const { maxLineWidth } = measureLineStats(prepared, Infinity)
// maxLineWidth 就是内容恰好不溢出的最小容器宽度
```

## 核心类型速查

```ts
type LayoutCursor = {
  segmentIndex: number  // prepared 文本流中的段索引
  graphemeIndex: number // 段内的字素索引；段边界处为 0
}

type LayoutLine = {
  text: string
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

type LayoutLineRange = {
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

type RichInlineItem = {
  text: string
  font: string
  letterSpacing?: number
  break?: 'normal' | 'never'
  extraWidth?: number
}
```

## 更多资源

- 官方仓库: [https://github.com/chenglou/pretext](https://github.com/chenglou/pretext)
- 在线演示: [https://chenglou.me/pretext/](https://chenglou.me/pretext/)
- 社区演示: [https://somnai-dreams.github.io/pretext-demos/](https://somnai-dreams.github.io/pretext-demos/)