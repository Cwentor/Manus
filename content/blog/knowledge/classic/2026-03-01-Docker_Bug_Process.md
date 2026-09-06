---
title: Docker Bug Process Error - Failed to download metadata for repo 'appstream'
date: '2026-03-01'
summary: 在 Docker 中使用 CentOS 镜像打包安装 vim 时出现以下错误：
tags:
  - 知识库
  - classic
  - Docker
read_time: 3 min
slug: 2026-03-01-docker-bug-process
category: knowledge
---

# Docker Bug Process

## 问题描述

在 Docker 中使用 CentOS 镜像打包安装 vim 时出现以下错误：

```
Error: Failed to download metadata for repo 'appstream': Cannot prepare internal mirrorlist: No URLs in mirrorlist
```

## 错误原因分析

出现这种错误有两种情况：

### 1. 网络连接问题
首先检查网络连接：
```bash
ping www.baidu.com
```
如果没有外网，先检查网络连接；如果有外网，继续看下面的情况。

### 2. CentOS 8 停止维护
CentOS 在 2020 年 12 月 8 日宣布停止维护 CentOS Linux 计划，并推出了 CentOS Stream 项目。CentOS Linux 8 作为 RHEL 8 的复刻版本，于 2021 年 12 月 31 日停止更新并停止维护（EOL）。

## 解决方案

### 方案一：更换 CentOS 版本（推荐）
将 CentOS 版本更换为 7 版本，在 Dockerfile 中修改：

```dockerfile
FROM centos:centos7
RUN yum -y install vim
```

### 方案二：修改镜像源

如果必须使用 CentOS 8，可以将镜像源从 `mirror.centos.org` 更改为 `vault.centos.org`。

#### Dockerfile 方式

```dockerfile
FROM centos:latest
RUN cd /etc/yum.repos.d/
RUN sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*
RUN sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*
RUN yum update -y
RUN yum -y install vim
```

重新打包镜像：
```bash
docker build -t mycentos:1 .
```

#### 直接更换阿里云源（针对服务器）

如果是服务器上的 yum.repos.d 源出现问题：

1. 先备份原文件：
```bash
mv /etc/yum.repos.d /etc/yum.repos.d.backup
```

2. 创建新目录并下载阿里云源：
```bash
mkdir /etc/yum.repos.d
cd /etc/yum.repos.d
wget http://mirrors.aliyun.com/repo/Centos-7.repo
```

3. 清除并重新生成缓存：
```bash
yum clean all
yum makecache
```

之后就可以正常使用 `yum upgrade` 或 `yum update` 了。