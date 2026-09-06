---
title: iframe没有id和name时如何定位
date: '2026-02-15'
summary: iframe 标签也叫浮动框架标签（Inline Frame），是一种特殊的框架标签：
tags:
  - 知识库
  - classic
  - iframe
  - 爬虫
read_time: 2 min
slug: 2026-02-15-iframe没有id和name时如何定位
category: knowledge
---

# iframe没有id和name时如何定位

## 一、iframe简单介绍

### 什么是iframe？

iframe 标签也叫**浮动框架标签**（Inline Frame），是一种特殊的框架标签：

- 可以放在浏览器中的小窗口
- 可以出现在页面的任何一个位置
- 整个页面不一定在框架页面上
- 高度和宽度完全由开发者定义
- 在网页中嵌套另一个网页

### 常见场景

网站登录页面处常见 iframe 的使用。

### 重要提示

> 在定位 iframe 内的元素时，需要**切换到对应的 iframe** 中，否则会报错。

---

## 二、定位iframe的四大方式

### 方式一：有id和name时

当 iframe 中有唯一的 id 或 name 时，可以直接传入属性值：

```python
driver.switch_to.frame('属性值')
```

**注意**：当 id 带有时间戳时不可以用在脚本中，因为那段 id 是实时变化的，无法定位。

---

### 方式二：用索引切入

当没有 id 和 name 时，可以使用索引定位。

**基础语法**：
```python
driver.switch_to.frame(1)  # 下标从0开始
```

**定位步骤**：
1. 如果页面内 iframe 较少，可以直接用下标定位
2. 使用 Ctrl + F 搜索 `//iframe`
3. 右侧会显示共有几个 iframe
4. 点击下键找到自己需要切入的 iframe
5. 确定下标写入脚本中

---

### 方式三：用tagname

使用 iframe 的 tagname 配合下标定位：

```python
driver.switch_to.frame(driver.find_element('tag_name', 'iframe')[0])
```

**说明**：逻辑和索引方式一样，利用下标定位。

---

### 方式四：用父级或子级定位

通过父子层级关系定位到 iframe。

**方法**：先定位父级或子级中能定位到的元素，然后利用层级关系定位到 iframe。

**示例**：
```python
# 从父级中的特殊元素定位到iframe
iframe = driver.find_element('css selector', 'div[id="loginDiv"]>iframe')
driver.switch_to.frame(iframe)
```

---

## 三、注意事项

1. **必须切换上下文**：定位 iframe 内部元素前，必须先切换到对应的 iframe

2. **下标从0开始**：iframe 的下标从 0 开始计数

3. **id变化问题**：避免使用带有时间戳的动态 id

4. **层级定位**：可以使用父级元素的 CSS 选择器来定位 iframe

---