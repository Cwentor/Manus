---
title: "password-safer"
tagline: "轻量离线加密密码管理器：本地存储 · AES 加密 · 完全开源"
cover: "/assets/products/password-safer.svg"
repo_url: "[https://github.com/Cwentor/password-safer](https://github.com/Cwentor/password-safer)"
status: "Active"
tech_stack: ["Rust", "AES", "离线优先"]
order: 4
---

## 项目概述

**password-safer** 是一个轻量的离线加密密码管理器：密码库**只存在本地**，用 AES 加密落盘，不上传任何服务器。

## 核心特性

- **离线优先**：数据完全本地存储，没有云端就没有泄露面
- **AES 加密**：密码库整体加密，主密码之外不落任何明文
- **自动生成**：内置密码生成器，按规则产出高强度随机密码
- **完全开源**：Rust 实现，代码全部公开，可自行审计与构建

## 为什么用 Rust

密码工具对内存安全的要求近乎苛刻。Rust 在编译期杜绝一整类内存漏洞，同时保持原生性能——这类工具值得用它写。

## 仓库

源码见 GitHub：[Cwentor/password-safer](https://github.com/Cwentor/password-safer)
