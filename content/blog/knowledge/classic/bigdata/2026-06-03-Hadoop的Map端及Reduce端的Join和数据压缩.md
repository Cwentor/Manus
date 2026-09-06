---
title: Hadoop Map端及Reduce端的Join实现与数据压缩
date: '2026-06-03'
summary: 适用于关联表中有小表的情形：
tags:
  - 知识库
  - bigdata
  - Hadoop
  - Join
read_time: 19 min
slug: 2026-06-03-hadoop的map端及reduce端的join和数据压缩
category: knowledge
---

# Hadoop Map端及Reduce端的Join实现与数据压缩

## 一、Map端Join

### 1.1 原理阐述

适用于**关联表中有小表**的情形：

- 可以将小表分发到所有的Map节点
- Map节点可以在本地对自己所读到的大表数据进行Join
- 可以大大提高Join操作的并发度，加快处理速度

### 1.2 适用场景

- 一个大表 Join 一个小表

### 1.3 实现方式

1. 将小表先准备在一个HDFS的目录中
2. 在代码的main方法中用 `job.addCacheFile()` 将其分发到MapTask的工作目录下
3. 还需要将ReduceTask的数量设置为0
4. 在代码的Mapper的setup方法中用本地文件API读取小表文件到内存中
5. 在Map方法中根据输入数据匹配内存小表进行拼接即可

### 1.4 代码实现

#### 缓存小表 - Mapper类

```java
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.NullWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Mapper;

public class CacheMap extends Mapper<LongWritable, Text, Text, NullWritable> {

    // 用HashMap保存缓存数据
    Map<String, String> pMap = new HashMap<>();
    Text k = new Text();

    @Override
    protected void setup(Mapper<LongWritable, Text, Text, NullWritable>.Context context)
            throws IOException, InterruptedException {
        // 1. 获取缓存的文件
        BufferedReader reader = new BufferedReader(
                new InputStreamReader(new FileInputStream("product.txt"), "UTF-8"));

        String line = null;

        while (StringUtils.isNotEmpty(line = reader.readLine())) {
            // 切割
            String[] fields = line.split(",");

            // 缓存到集合中
            pMap.put(fields[0], fields[1]);
        }

        // 关闭流
        reader.close();
    }

    @Override
    protected void map(LongWritable key, Text value, Context context) throws IOException, InterruptedException {
        // 获取数据
        String line = value.toString();

        // 截取字段
        String[] fields = line.split(",");

        // 获得订单ID
        String id = fields[0];

        // 获得产品的id
        String pid = fields[2];

        // 获得商品名称
        String pName = pMap.get(pid);

        // Join
        k.set(line + "\t" + pName);

        // 输出
        context.write(k, NullWritable.get());
    }
}
```

#### Driver主函数

```java
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.NullWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.io.compress.BZip2Codec;
import org.apache.hadoop.io.compress.CompressionCodec;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

public class Driver {
    public static void main(String[] args)
            throws IOException, ClassNotFoundException, InterruptedException, URISyntaxException {
        Configuration conf = new Configuration();

        Job job = Job.getInstance(conf);

        job.setJarByClass(Driver.class);
        job.setMapperClass(CacheMap.class);
        // 不需要ReduceTask
        job.setNumReduceTasks(0);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(NullWritable.class);

        // 分发小表到所有Map节点
        job.addCacheFile(new URI("hdfs://path/to/product.txt"));

        FileInputFormat.setInputPaths(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        boolean res = job.waitForCompletion(true);
        System.exit(res ? 0 : 1);
    }
}
```

---

## 二、Reduce端Join

### 2.1 实现思路

Reduce端Join也称为**半连接**，主要步骤：

1. 在Map端对数据进行标记（区分订单表和商品表）
2. 按照关联键发送数据到Reduce端
3. 在Reduce端进行数据的拼接

### 2.2 自定义数据类型

```java
import java.io.DataInput;
import java.io.DataOutput;
import java.io.IOException;

import org.apache.hadoop.io.Writable;

public class InfoBeanWritable implements Writable {

    private int order_id;      // 订单id
    private String date;        // 日期
    private String pid;         // 商品id
    private int amount;         // 订单数量
    private String name;        // 商品名称
    private String category_id; // 商品类别
    private double price;       // 商品价格
    private String flag;        // 标记位：0-订单表，1-商品表

    // 无参构造方法
    public InfoBeanWritable() {
    }

    // 有参构造方法
    public InfoBeanWritable(int order_id, String date, String pid, int amount, 
            String name, String category_id, double price, String flag) {
        this.set(order_id, date, pid, amount, name, category_id, price, flag);
    }

    public void set(int order_id, String date, String pid, int amount,
            String name, String category_id, double price, String flag) {
        this.order_id = order_id;
        this.date = date;
        this.pid = pid;
        this.amount = amount;
        this.name = name;
        this.category_id = category_id;
        this.price = price;
        this.flag = flag;
    }

    // Getters and Setters...

    @Override
    public void readFields(DataInput in) throws IOException {
        this.order_id = in.readInt();
        this.date = in.readUTF();
        this.pid = in.readUTF();
        this.amount = in.readInt();
        this.name = in.readUTF();
        this.category_id = in.readUTF();
        this.price = in.readDouble();
        this.flag = in.readUTF();
    }

    @Override
    public void write(DataOutput out) throws IOException {
        out.writeInt(this.order_id);
        out.writeUTF(this.date);
        out.writeUTF(this.pid);
        out.writeInt(this.amount);
        out.writeUTF(this.name);
        out.writeUTF(this.category_id);
        out.writeDouble(this.price);
        out.writeUTF(this.flag);
    }

    @Override
    public String toString() {
        return order_id + "\t" + date + "\t" + pid + "\t" + amount +
               "\t" + name + "\t" + category_id + "\t" + price;
    }
}
```

### 2.3 Map端代码

```java
import java.io.IOException;

import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.lib.input.FileSplit;

public class MapJoin extends Mapper<LongWritable, Text, Text, InfoBeanWritable> {

    Text outputKey = new Text();
    InfoBeanWritable infoBean = new InfoBeanWritable();

    @Override
    protected void map(LongWritable key, Text value, Context context) 
            throws IOException, InterruptedException {
        // 1. 获取一行的内容
        String line = value.toString();

        // 2. 获得文件名称
        FileSplit fileSplit = (FileSplit) context.getInputSplit();
        String fileName = fileSplit.getPath().getName();

        // 切割
        String[] fields = line.split(",");
        String pid;

        // 3. 根据文件名称判断数据来源
        if (fileName.startsWith("order")) {
            // 订单表数据
            int order_id = Integer.valueOf(fields[0]);
            String date = fields[1];
            pid = fields[2];
            int amount = Integer.valueOf(fields[3]);
            infoBean.set(order_id, date, pid, amount, "", "", 0, "0");
        } else {
            // 商品表数据
            pid = fields[0];
            String name = fields[1];
            String category_id = fields[2];
            double price = Double.valueOf(fields[3]);
            infoBean.set(0, "", pid, 0, name, category_id, price, "1");
        }

        outputKey.set(pid);
        context.write(outputKey, infoBean);
    }
}
```

### 2.4 Reduce端代码

```java
import java.io.IOException;
import java.util.ArrayList;

import org.apache.commons.beanutils.BeanUtils;
import org.apache.hadoop.io.NullWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Reducer;

public class JoinReduce extends Reducer<Text, InfoBeanWritable, InfoBeanWritable, NullWritable> {

    @Override
    protected void reduce(Text key, Iterable<InfoBeanWritable> values, Context context)
            throws IOException, InterruptedException {

        ArrayList<InfoBeanWritable> orderList = new ArrayList<>();
        InfoBeanWritable productBean = new InfoBeanWritable();

        for (InfoBeanWritable value : values) {
            if ("1".equals(value.getFlag())) {
                // 商品表数据
                try {
                    BeanUtils.copyProperties(productBean, value);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else {
                // 订单表数据
                InfoBeanWritable orderBean = new InfoBeanWritable();
                try {
                    BeanUtils.copyProperties(orderBean, value);
                } catch (Exception e) {
                    e.printStackTrace();
                }
                orderList.add(orderBean);
            }
        }

        // 4. 拼接数据并输出
        for (InfoBeanWritable bean : orderList) {
            bean.setName(productBean.getName());
            bean.setCategory_id(productBean.getCategory_id());
            bean.setPrice(productBean.getPrice());

            context.write(bean, NullWritable.get());
        }
    }
}
```

### 2.5 Driver代码

```java
import java.io.IOException;

import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.NullWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;

public class Driver {
    public static void main(String[] args) throws IOException, ClassNotFoundException, InterruptedException {
        Configuration conf = new Configuration();

        Job job = Job.getInstance(conf);

        job.setJarByClass(Driver.class);
        job.setMapperClass(MapJoin.class);
        job.setReducerClass(JoinReduce.class);

        job.setMapOutputKeyClass(Text.class);
        job.setMapOutputValueClass(InfoBeanWritable.class);

        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(NullWritable.class);

        FileInputFormat.setInputPaths(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        boolean res = job.waitForCompletion(true);
        System.exit(res ? 0 : 1);
    }
}
```

---

## 三、数据压缩

### 3.1 作用

有效减少**磁盘空间**或**IO的带宽**

### 3.2 常用压缩方式

| 压缩格式 | 是否可切片 | 是否需要处理 |
|---------|-----------|-------------|
| gzip    | 否        | 不需要       |
| Bzip2   | 是        | 不需要       |
| Snappy  | 否        | 不需要       |

### 3.3 Snappy特点

- 需要单独安装
- **速度是最快的**

### 3.4 使用阶段

#### 1. 输入阶段

不需要额外配置，MapReduce会自动处理

#### 2. Map输出阶段

```java
// 在Driver类中开启Map端的压缩
conf.setBoolean("mapreduce.map.output.compress", true);

// 设置压缩方式
conf.setClass("mapreduce.map.output.compress.codec", BZip2Codec.class, CompressionCodec.class);
```

#### 3. Reduce输出阶段

```java
// 开启Reduce端压缩
FileOutputFormat.setCompressOutput(job, true);

// 设置压缩格式
FileOutputFormat.setOutputCompressorClass(job, BZip2Codec.class);
```

---

## 总结

| Join方式 | 优点 | 缺点 | 适用场景 |
|---------|------|------|---------|
| Map端 Join | 无shuffle，效率高 | 需要内存缓存小表 | 大表 Join 小表 |
| Reduce端 Join | 不需要缓存小表 | 有shuffle，效率较低 | 大表 Join 大表 |

**压缩使用建议**：在不频繁进行计算的时候，有大量文件传输的情景下可以使用压缩。
