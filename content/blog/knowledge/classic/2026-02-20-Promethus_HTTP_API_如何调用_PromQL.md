---
title: Promethus HTTP API 如何调用 PromQL
date: '2026-02-20'
summary: Prometheus API 使用了 JSON 格式的响应内容。当 API 调用成功后将会返回查询结果。
tags:
  - 知识库
  - classic
  - Prometheus
  - API
read_time: 5 min
slug: 2026-02-20-promethus-http-api-如何调用-promql
category: knowledge
---

# Promethus HTTP API 如何调用 PromQL

## 一、API基础

### 响应格式

Prometheus API 使用了 **JSON 格式**的响应内容。当 API 调用成功后将会返回查询结果。

所有 API 请求均使用以下 JSON 格式：

```json
{
  "status": "success" | "error",
  "data": <data>,
  "errorType": "<string>",
  "error": "<string>"
}
```

- `status`: 成功返回 "success"，失败返回 "error"
- `data`: 查询结果数据
- `errorType` 和 `error`: 仅在 status 为 "error" 时设置

### 请求格式

通过 GET 请求向 Prometheus 发送查询请求：

```
http://promurl:port/api/v1/query?query=<PromQL>&time=<时间戳>
```

- API 路径：`/api/v1/query`
- `query`: PromQL 语句
- `time`: 时间戳，代表查询的时间基线

> Prometheus 默认保存 14 天的数据，超过 14 天会自动删除。时间戳可以让我们以过去某个时间点为基础进行查询。

---

## 二、查询类型

### Instant Query（瞬时查询）

**API路径**：`/api/v1/query`

用于查询单个时间点的数据。

**示例**：

```bash
curl 'http://localhost:9090/api/v1/query?query=up&time=2015-07-01T20:10:51.781Z'
```

**响应示例**：

```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": {
          "__name__": "up",
          "job": "prometheus",
          "instance": "localhost:9090"
        },
        "value": [1435781451.781, "1"]
      },
      {
        "metric": {
          "__name__": "up",
          "job": "node",
          "instance": "localhost:9100"
        },
        "value": [1435781451.781, "0"]
      }
    ]
  }
}
```

---

## 三、响应数据类型

### data 节点格式

```json
{
  "resultType": "matrix" | "vector" | "scalar" | "string",
  "result": <value>
}
```

PromQL 表达式可能返回多种数据类型：

### 1. 瞬时向量（vector）

返回数据类型为 `vector` 时：

```json
[
  {
    "metric": { "<label_name>": "<label_value>", ... },
    "value": [<unix_time>, "<sample_value>"]
  },
  ...
]
```

- `metric`: 当前时间序列的特征维度
- `value`: 只包含一个唯一的样本

### 2. 区间向量（matrix）

返回数据类型为 `matrix` 时：

```json
[
  {
    "metric": { "<label_name>": "<label_value>", ... },
    "values": [[<unix_time>, "<sample_value>"], ...]
  },
  ...
]
```

- `values`: 包含当前时间序列的一组样本

### 3. 标量（scalar）

返回数据类型为 `scalar` 时：

```json
[<unix_time>, "<scalar_value>"]
```

- 标量不存在时间序列一说
- `result` 表示为当前系统时间的一个标量的值

### 4. 字符串（string）

返回数据类型为 `string` 时：

```json
[<unix_time>, "<string_value>"]
```

- 字符串类型的响应内容格式和标量相同

---

## 四、区间数据查询

使用 **QUERY_RANGE API** 可以直接查询 PromQL 表达式在一段时间内的计算结果。

### API 路径

```
GET /api/v1/query_range
```

### URL 请求参数

| 参数 | 说明 |
|------|------|
| `query` | PromQL 表达式 |
| `start` | 起始时间 |
| `end` | 结束时间 |
| `step` | 查询步长 |
| `timeout` | 超时设置（可选，默认使用全局设置） |

### 响应结果

使用 QUERY_RANGE API 查询时，返回结果一定是**区间向量**：

```json
{
  "resultType": "matrix",
  "result": <value>
}
```

> 注意：在 QUERY_RANGE API 中，PromQL 只能使用**瞬时向量选择器**类型的表达式。

### 示例

查询表达式 `up` 在 30 秒范围内以 15 秒为间隔计算 PromQL 表达式的结果：

```bash
curl 'http://localhost:9090/api/v1/query_range?query=up&start=2015-07-01T20:10:30.781Z&end=2015-07-01T20:11:00.781Z&step=15s'
```

**响应示例**：

```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": {
          "__name__": "up",
          "job": "prometheus",
          "instance": "localhost:9090"
        },
        "values": [
          [1435781430.781, "1"],
          [1435781445.781, "1"],
          [1435781460.781, "1"]
        ]
      }
    ]
  }
}
```