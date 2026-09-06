---
title: DolphinScheduler 部署指南
date: '2026-05-27'
summary: 官方文档参考：DolphinScheduler 伪集群部署
tags:
  - 知识库
  - bigdata
  - dolphinscheduler
  - 部署
read_time: 12 min
slug: 2026-05-27-dolphinscheduler部署
category: knowledge
---

# DolphinScheduler 3.3.1 部署指南

> 官方文档参考：[DolphinScheduler 伪集群部署](https://dolphinscheduler.apache.org/zh-cn/docs/3.3.1/guide/installation/pseudo-cluster)

## 环境准备

| 依赖项 | 版本要求 | 说明 |
|--------|---------|------|
| JDK | 1.8 或 11 | 需配置 `JAVA_HOME` 及 `PATH` |
| 数据库 | PostgreSQL 8.2.15+ 或 MySQL 5.7+ | 二选一；MySQL 需 JDBC Driver 8.0.33 |
| 注册中心 | ZooKeeper 3.8.0 / MySQL 8.0.33 / ETCD | 三选一 |
| 二进制包 | 3.3.1 | [官网下载页面](https://dolphinscheduler.apache.org/zh-cn/download) |
| 进程树分析 | - | macOS 安装 `pstree`；Linux 安装 `psmisc` |

---

## 一、伪集群部署

### 1.1 安装插件依赖

先精简插件数据源配置，仅保留 MySQL，然后执行安装脚本：

```bash
bash ./bin/install-plugins.sh 3.3.1
```

### 1.2 配置部署用户及权限

**使用 root 用户执行以下操作：**

```bash
# 创建用户
useradd dolphinscheduler

# 设置密码
echo "dolphinscheduler" | passwd --stdin dolphinscheduler

# 配置 sudo 免密
sed -i '$adolphinscheduler  ALL=(ALL)  NOPASSWD: NOPASSWD: ALL' /etc/sudoers
sed -i 's/Defaults    requirett/#Defaults    requirett/g' /etc/sudoers

# 修改目录权限（对解压后的 apache-dolphinscheduler-*-bin 目录执行）
chown -R dolphinscheduler:dolphinscheduler apache-dolphinscheduler-*-bin
chmod -R 755 apache-dolphinscheduler-*-bin

# 或先解压再授权
chown -R dolphinscheduler:dolphinscheduler dolphinscheduler-3.3.1
chmod -R 755 dolphinscheduler-3.3.1
```

> **注意：**
> - 任务执行服务通过 `sudo -u {linux-user} -i` 切换用户实现多租户，因此部署用户必须具备 **免密 sudo 权限**。
> - 若 `/etc/sudoers` 中存在 `Defaults requiretty`，请务必注释掉。

### 1.3 启动依赖服务

1. 启动 ZooKeeper
2. 启动 MySQL

### 1.4 修改配置文件

需修改以下服务的 `application.yaml`：

```bash
vim /opt/module/dolphinscheduler-3.3.1/master-server/conf/application.yaml
vim /opt/module/dolphinscheduler-3.3.1/worker-server/conf/application.yaml
vim /opt/module/dolphinscheduler-3.3.1/api-server/conf/application.yaml
vim /opt/module/dolphinscheduler-3.3.1/alert-server/conf/application.yaml
vim /opt/module/dolphinscheduler-3.3.1/tools/conf/application.yaml
```

**核心配置项如下：**

```yaml
# 数据源配置
datasource:
  driver-class-name: com.mysql.cj.jdbc.Driver
  url: jdbc:mysql://tag1:3306/dolphinscheduler2204?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true
  username: root
  password: 000000

# 注册中心配置
registry:
  type: zookeeper
  zookeeper:
    namespace: dolphinscheduler2204
    connect-string: tag1:2181,tag2:2181,tag3:2181

# 可选性能调优
max-cpu-load-avg: 3
reserved-memory: 0.1
max-waiting-time: 150s
```

**环境变量配置（`dolphinscheduler_env.sh`）：**

```bash
export JAVA_HOME=${JAVA_HOME:-/opt/module/jdk1.8}

# 数据库配置
export DATABASE=${DATABASE:-mysql}
export SPRING_PROFILES_ACTIVE=${DATABASE}
export SPRING_DATASOURCE_URL="jdbc:mysql://tag1:3306/dolphinscheduler2204?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true"
export SPRING_DATASOURCE_USERNAME=root
export SPRING_DATASOURCE_PASSWORD=000000

# 注册中心配置
export REGISTRY_TYPE=${REGISTRY_TYPE:-zookeeper}
export REGISTRY_ZOOKEEPER_CONNECT_STRING=${REGISTRY_ZOOKEEPER_CONNECT_STRING:-tag1:2181,tag2:2181,tag3:2181}

# 任务组件环境变量（按需配置）
export HADOOP_HOME=${HADOOP_HOME:-/opt/module/hadoop-3.3.4}
export HADOOP_CONF_DIR=${HADOOP_CONF_DIR:-/opt/module/hadoop-3.3.4/etc/hadoop}
export SPARK_HOME=${SPARK_HOME:-/opt/soft/spark}
export PYTHON_LAUNCHER=${PYTHON_LAUNCHER:-/opt/soft/python}
export HIVE_HOME=${HIVE_HOME:-/opt/soft/hive}
export FLINK_HOME=${FLINK_HOME:-/opt/soft/flink}
export DATAX_LAUNCHER=${DATAX_LAUNCHER:-/opt/soft/datax/bin/python3}

export PATH=$HADOOP_HOME/bin:$SPARK_HOME/bin:$PYTHON_LAUNCHER:$JAVA_HOME/bin:$HIVE_HOME/bin:$FLINK_HOME/bin:$DATAX_LAUNCHER:$PATH
```

> **务必根据实际环境修改 `JAVA_HOME`、数据库连接及注册中心地址。**

### 1.5 数据源与元数据初始化

#### 1. 安装 MySQL 驱动

```bash
# 检查是否已安装
rpm -ql mysql-connector-j

# 若未安装
rpm -ivh mysql-connector-java.rpm
```

#### 2. 分发驱动到各服务模块

```bash
cp /usr/share/java/mysql-connector-j.jar /opt/module/dolphinscheduler-3.3.1/master-server/libs/
cp /usr/share/java/mysql-connector-j.jar /opt/module/dolphinscheduler-3.3.1/worker-server/libs/
cp /usr/share/java/mysql-connector-j.jar /opt/module/dolphinscheduler-3.3.1/api-server/libs/
cp /usr/share/java/mysql-connector-j.jar /opt/module/dolphinscheduler-3.3.1/alert-server/libs/
cp /usr/share/java/mysql-connector-j.jar /opt/module/dolphinscheduler-3.3.1/tools/libs/
```

#### 3. 创建元数据库

```sql
CREATE DATABASE dolphinscheduler2204
  DEFAULT CHARACTER SET utf8
  DEFAULT COLLATE utf8_general_ci;
```

#### 4. 初始化数据库表结构

```bash
sh /opt/module/dolphinscheduler-3.3.1/tools/bin/upgrade-schema.sh
```

### 1.6 解决 hbase-trace 缺失问题

将 `master-server/libs` 下的 hbase-trace 相关 jar 包复制到其余各服务的 `libs` 目录，避免 worker 启动失败。

### 1.7 启动服务

```bash
# 启动 api-server
bash ./bin/dolphinscheduler-daemon.sh start api-server

# 启动 master-server
bash ./bin/dolphinscheduler-daemon.sh start master-server

# 启动 worker-server
bash ./bin/dolphinscheduler-daemon.sh start worker-server

# 启动 alert-server
bash ./bin/dolphinscheduler-daemon.sh start alert-server
```

各服务日志位于 `xxx-server/logs` 目录下。

**访问 UI：**
- 地址：`http://localhost:12345/dolphinscheduler/ui`
- 默认账号：`admin`
- 默认密码：`dolphinscheduler123`

---

## 二、分布式部署

将伪集群节点的安装包分发至各主机，保持配置一致，然后在对应节点启动所需服务。

```bash
#!/bin/bash

# tag1：启动 master、worker、api
ssh tag1 "/opt/module/dolphinscheduler-3.3.1/bin/dolphinscheduler-daemon.sh start master-server"
ssh tag1 "/opt/module/dolphinscheduler-3.3.1/bin/dolphinscheduler-daemon.sh start worker-server"
ssh tag1 "/opt/module/dolphinscheduler-3.3.1/bin/dolphinscheduler-daemon.sh start api-server"

# tag2：启动 worker
ssh tag2 "/opt/module/dolphinscheduler-3.3.1/bin/dolphinscheduler-daemon.sh start worker-server"

# tag3：启动 alert
ssh tag3 "/opt/module/dolphinscheduler-3.3.1/bin/dolphinscheduler-daemon.sh start alert-server"
```

---

## 三、前端开发环境部署

需预先安装 Node.js 和 pnpm。

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# 国内镜像备选
curl -fsSL https://gitee.com/mirrors/nvm/raw/master/install.sh | bash

# 加载 nvm（或重新打开终端）
\ . "$HOME/.nvm/nvm.sh"

# 安装 Node.js 22
nvm install 22
node -v  # 预期输出：v22.19.0

# 启用 pnpm
corepack enable pnpm
pnpm -v
```