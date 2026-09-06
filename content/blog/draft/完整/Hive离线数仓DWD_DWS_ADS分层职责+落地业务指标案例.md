---
title: Hive离线数仓DWD/DWS/ADS分层职责\+落地业务指标案例
summary: 1\. DWD 层：明细事实层（数据清洗、标准化、粒度对齐）
tags:
  - 随笔
  - 完整
read_time: 7 min
slug: hive离线数仓dwd-dws-ads分层职责落地业务指标案例
category: draft
---
# Hive离线数仓DWD/DWS/ADS分层职责\+落地业务指标案例

## 一、三层核心职责（基于尚硅谷电商 gmall 数仓文档）

### 1\. DWD 层：明细事实层（数据清洗、标准化、粒度对齐）

**全称**：Data Warehouse Detail 明细数据层
**核心定位**：ODS 原始数据清洗加工后，存储**最细粒度的业务事实**，遵循维度建模（星型模型），分**事务事实表、周期快照、累积快照**三类事实表。

#### 核心职责

1. **数据清洗**：过滤无效数据、脏数据、测试数据；脱敏手机号 / 姓名 / 邮箱；补全缺失维度字段。

2. **结构化拆解**：拆分 ODS 层 JSON 嵌套结构（如订单明细、购物车嵌套 JSON），平铺为标准字段。

3. **业务过滤**：只保留有效业务行为（如过滤订单取消、支付失败的无效记录）。

4. **粒度统一**：固定事实最小粒度（下单以**单个商品项**为一行、加购以单 SKU 加购行为为一行）。

5. **维度退化**：关联字典表，把编码替换为业务文字（支付编码→支付宝 / 微信名称），减少上层 JOIN。

6. **分层命名规范**：`dwd_数据域_业务过程_inc/full`（inc 增量事务、full 全量快照）

#### 存储格式：ORC 列式 \+ Snappy 压缩，按 dt 日期分区

示例表：`dwd_trade_order_detail_inc`（交易域下单明细事务事实表，一行 = 一单一件商品）

### 2\. DWS 层：汇总宽表层（轻度聚合、按维度预汇总）

**全称**：Data Warehouse Summary 汇总数据层
**核心定位**：面向分析做**轻度预聚合**，减少 ADS 层重复 JOIN / 聚合，构建**宽表**（事实 \+ 常用维度合并），也叫 “服务层”，直接支撑多指标复用。

#### 核心职责

1. **多维度预聚合**：按常用分析维度（日期、地区、品类、用户、优惠券等）提前 sum/count 聚合指标。

2. **宽表整合**：事实表 \+ 高频维度表 JOIN 合并（下单明细 \+ 商品维度 \+ 地区维度 \+ 优惠券维度合成一张宽表），上层无需重复关联维度。

3. **指标复用**：同一粒度的派生指标统一计算，避免 ADS 重复计算（如日订单数、日成交金额共用一套明细聚合逻辑）。

4. **分层命名规范**：`dws_数据域_粒度_agg`（agg 代表聚合）

#### 存储格式：ORC\+Snappy，按 dt 分区

示例表：`dws_trade_province_category_day_agg`（每日 \- 省份 \- 品类粒度交易汇总宽表）

### 3\. ADS 层：应用报表层（业务指标、可视化专用）

**全称**：Application Data Store 应用数据层
**核心定位**：面向业务报表、可视化平台（Superset），**完全贴合业务需求**，产出可直接展示的指标结果，不做复杂计算。

#### 核心职责

1. **业务口径对齐**：按产品 / 运营需求筛选指标、统一统计口径（如 “有效订单” 定义：支付成功且未退款）。

2. **多粒度指标汇总**：日 / 周 / 月累计、环比、同比、占比、转化率等衍生计算。

3. **适配可视化**：输出宽表直接对接 MySQL（Superset 数据源），字段简单、无嵌套，图表直接读取。

4. **分层命名规范**：`ads_业务场景_指标统计表`

#### 存储：Hive 临时表 → 同步到 MySQL 供 Superset 展示

示例表：`ads_order_by_province`（各省日订单统计，Superset 中国地图图表数据源）

## 二、落地业务指标完整案例（电商优惠券使用指标）

### 业务需求

统计**每日各优惠券类型使用指标**，最终在 Superset 制作饼图、趋势数字卡片，指标清单：

1. 优惠券领取总次数

2. 优惠券实际使用次数（下单抵扣）

3. 优惠券抵扣总金额

4. 使用率 = 使用次数 / 领取次数

5. 各类型优惠券金额占比

涉及数据表链路：ODS → DWD → DWS → ADS → MySQL → Superset 可视化

### 步骤 1：DWD 层（明细层：优惠券领用事务事实）

表：`dwd_tool_coupon_use_inc`（工具域优惠券使用增量事实表）

#### 加工逻辑

数据源：`ods_coupon_use_inc`（ODS 增量 JSON 表，存储优惠券领取、使用、过期全变更记录）

1. 拆解 JSON `data`结构体，提取 coupon\_id、user\_id、get\_time（领取）、used\_time（使用）、coupon\_status；

2. 过滤脏数据：过滤 status 为空、时间异常记录；

3. 关联 dim\_coupon\_full 优惠券维度表，退化字段`coupon_type_name`（现金券 / 满减券 / 折扣券）；

4. 粒度：一条 = 一条优惠券生命周期记录（领取 / 使用 / 过期）；

5. 分区 dt = 操作日期。
核心过滤：只保留**领取、成功使用**两条有效行为记录。

### 步骤 2：DWS 层（日 \- 优惠券类型汇总宽表）

表：`dws_tool_coupon_type_day_agg`

#### 加工逻辑

数据源：`dwd_tool_coupon_inc` 优惠券明细事实表
按维度分组：`dt（日期）、coupon_type_code、coupon_type_name`
预聚合指标（复用给多个报表）：

- 领取总数：count \(distinct 领取记录 coupon\_id\)

- 使用总数：count \(distinct 使用记录 coupon\_id\)

- 抵扣总金额：sum \(抵扣金额 benefit\_amount\)
宽表自带维度：优惠券类型名称、规则描述，上层无需关联维度表。

### 步骤 3：ADS 层（可视化报表专用表）

表：`ads_coupon_stats`（优惠券每日统计，同步至 MySQL 供 Superset）

#### 加工 SQL 逻辑

```sql
insert overwrite table ads_coupon_stats
select
    dt,
    coupon_type_name,
    receive_cnt,
    use_cnt,
    discount_amount,
    -- 使用率
    round(use_cnt / receive_cnt * 100, 2) use_ratio,
    -- 该类型抵扣金额占当日总抵扣比例
    round(discount_amount / sum(discount_amount) over(partition by dt) * 100, 2) amount_ratio
from dws_tool_coupon_type_day_agg;
```

#### 输出字段（极简，适配可视化）

dt 统计日期、coupon\_type\_name 优惠券类型、receive\_cnt 领取数、use\_cnt 使用数、discount\_amount 总优惠、use\_ratio 使用率、amount 金额占比。

### 步骤 4：数据输出 \& Superset 可视化

1. 将`ads_coupon_stats`通过 Sqoop 同步到 MySQL `gmall_report`库；

2. Superset 对接 MySQL 数据源，创建 Dataset `ads_coupon_stats`；

3. 制作两张图表：

    - Big Number 趋势卡片：展示当日总优惠券使用次数、环比昨日增减；

    - 饼图：展示各优惠券类型优惠金额占比；

4. 放入 “离线指标展示” 仪表盘，配置 10 秒自动刷新。

## 三、三层分工总结

|分层|数据粒度|核心作用|产出对象|
|---|---|---|---|
|DWD|最细原子明细|清洗、标准化、统一业务事实|明细事实，支撑所有指标底层数据源|
|DWS|多维度预聚合|提前聚合、合并维度宽表，消除重复计算|复用汇总中间表，降低 ADS 计算压力|
|ADS|业务报表粒度|计算比率 / 同比 / 占比，适配可视化|直接给报表、BI（Superset）使用|

当前文件内容过长，豆包只阅读了前 46%。

> （注：部分内容可能由 AI 生成）
