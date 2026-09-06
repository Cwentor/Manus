---
title: Skill：markitdown-converter
summary: 基于微软 markitdown 将多种文件格式（PDF/Word/Excel/PPT/HTML/EPUB/音频/图片等）自动转换为结构清晰的 Markdown 文档。当用户需要将文档转换为 Markdown、批量转换文件、或整理文档为文本格式时触发。
tags:
  - 技能
read_time: 15 min
slug: skills-skill
category: skills
---

# MarkItDown Converter Skill

基于 [microsoft/markitdown](https://github.com/microsoft/markitdown) 开发的文件转换技能，能够自动扫描、识别并处理满足条件的文件，将其内容准确转换为标准 Markdown 格式。

---

## 一、文件筛选标准

### 1.1 支持的文件类型（按优先级）

| 优先级 | 类别 | 文件扩展名 | markitdown extras |
|--------|------|-----------|-------------------|
| P0 | Office 文档 | `.docx`, `.xlsx`, `.pptx` | `[docx, xlsx, pptx]` |
| P1 | PDF | `.pdf` | `[pdf]` |
| P2 | 结构化文本 | `.html`, `.htm`, `.csv`, `.json`, `.xml` | 内建支持 |
| P3 | 电子书 | `.epub` | 内建支持 |
| P4 | 图片 | `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.tiff`, `.webp` | `[all]` (OCR) |
| P4 | 音频 | `.wav`, `.mp3` | `[audio-transcription]` |
| P5 | 旧版 Office | `.xls`, `.msg` | `[xls, outlook]` |
| P6 | 归档文件 | `.zip` | 内建支持 |

### 1.2 内容特征过滤

- **非空文件**：文件大小 > 0 字节
- **非隐藏文件**：文件名不以 `.` 开头（排除 `.gitignore` 等）
- **非临时文件**：文件名不以 `~$` 开头（排除 Office 临时文件）
- **可读性检查**：文件能正常打开解析而不抛出异常

### 1.3 命名规则

- 优先匹配带有明确描述性名称的文件（如 `季度报告.docx` > `file001.docx`）
- 跳过备份文件（含 `.bak`、`~` 结尾的文件）

---

## 二、Markdown 转换规则

### 2.1 标题层级映射

| 原始格式 | Markdown 输出 | 说明 |
|---------|--------------|------|
| Word Heading 1 / HTML `<h1>` | `# 标题` | 一级标题 |
| Word Heading 2 / HTML `<h2>` | `## 标题` | 二级标题 |
| Word Heading 3 / HTML `<h3>` | `### 标题` | 三级标题 |
| Word Heading 4-6 / HTML `<h4>`-`<h6>` | `####`-`###### 标题` | 按原始层级映射 |
| PDF 大字号/粗体段首 | `## 标题`（推断） | 基于字体大小启发式识别 |

### 2.2 列表样式

| 原始格式 | Markdown 输出 |
|---------|--------------|
| 无序列表 (Word bullets / HTML `<ul>`) | `- 项目` |
| 有序列表 (Word numbered / HTML `<ol>`) | `1. 项目` |
| 嵌套列表 | 缩进 4 空格或 Tab |
| 任务列表 (checkbox) | `- [ ] 待办` / `- [x] 已完成` |

### 2.3 代码块处理

| 原始格式 | Markdown 输出 | 说明 |
|---------|--------------|------|
| 内联代码 | `` `code` `` | HTML `<code>`、Word 等宽字体文本 |
| 多行代码块 | ` ```lang\n...\n``` ` | 尽可能推断语言标记 |
| JSON 数据 | ` ```json\n...\n``` ` | 自动格式化缩进 |
| XML 数据 | ` ```xml\n...\n``` ` | 自动格式化缩进 |

### 2.4 表格转换

| 原始格式 | Markdown 输出 | 说明 |
|---------|--------------|------|
| Word 表格 | 标准 GFW 表格 | 对齐列宽，保留表头加粗分隔线 |
| Excel 表格 | 标准 GFW 表格 | 合并单元格做注释处理 |
| HTML `<table>` | 标准 GFW 表格 | 保留 `<thead>` / `<tbody>` 结构 |
| CSV | 标准 GFW 表格 | 首行自动作为表头 |
| PDF 表格 | 尽力提取 | 复杂的跨页表格可能不完美 |

### 2.5 图片引用

| 原始格式 | Markdown 输出 |
|---------|--------------|
| 文档内嵌图片 | `![alt](path/to/image.png)` |
| 图片无可用 alt 文本 | `![图片](path/to/image.png)` |
| 使用 LLM 描述图片 (可选) | `![LLM生成的描述](path/to/image.png)` |

### 2.6 其他元素映射

| 原始格式 | Markdown 输出 |
|---------|--------------|
| **粗体** | `**粗体**` |
| *斜体* | `*斜体*` |
| ~~删除线~~ | `~~删除线~~` |
| 超链接 | `[文本](url)` |
| 分隔线 | `---` |
| 脚注 | `[^1]: 脚注内容` |
| 引用块 | `> 引用内容` |

---

## 三、自动化处理流程

### 3.1 环境准备

```bash
# 安装 markitdown（无需 git clone）
pip install 'markitdown[all]'
```

检查安装：
```bash
markitdown --version
```

### 3.2 文件扫描与筛选

```python
import os
from pathlib import Path

# 支持的文件扩展名
SUPPORTED_EXTENSIONS = {
    # Office 文档
    '.docx', '.xlsx', '.pptx', '.xls', '.msg',
    # PDF
    '.pdf',
    # 结构化文本
    '.html', '.htm', '.csv', '.json', '.xml',
    # 电子书
    '.epub',
    # 图片
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
    # 音频
    '.wav', '.mp3',
    # 纯文本
    '.txt', '.md', '.rst',
    # 压缩包
    '.zip',
}

def scan_files(directory: str, recursive: bool = True) -> list[Path]:
    """扫描目录中符合条件的文件"""
    files = []
    root = Path(directory)
    pattern = "**/*" if recursive else "*"
    
    for f in root.glob(pattern):
        if not f.is_file():
            continue
        # 过滤隐藏文件
        if f.name.startswith('.'):
            continue
        # 过滤临时文件
        if f.name.startswith('~$'):
            continue
        # 过滤空文件
        if f.stat().st_size == 0:
            continue
        # 过滤备份文件
        if f.suffix == '.bak' or f.name.endswith('~'):
            continue
        # 检查扩展名
        if f.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(f)
    
    return sorted(files)
```

### 3.3 内容提取与转换

```python
from markitdown import MarkItDown
from pathlib import Path

def convert_file(file_path: Path, output_dir: Path | None = None,
                 llm_client=None, llm_model=None) -> dict:
    """
    将单个文件转换为 Markdown。
    
    返回:
        dict: {
            "success": bool,
            "source": str,      # 源文件路径
            "output": str,      # 输出文件路径（如果指定了 output_dir）
            "content": str,     # Markdown 内容
            "error": str | None # 错误信息
        }
    """
    result = {
        "success": False,
        "source": str(file_path),
        "output": None,
        "content": "",
        "error": None
    }
    
    try:
        md = MarkItDown(
            enable_plugins=False,
            llm_client=llm_client,
            llm_model=llm_model,
        )
        conversion = md.convert(str(file_path))
        content = conversion.text_content
        
        # 添加元数据头
        metadata_header = f"---\nsource: {file_path.name}\ntype: {file_path.suffix[1:].upper()}\nconverted_at: {_timestamp()}\n---\n\n"
        full_content = metadata_header + content
        
        result["content"] = full_content
        result["success"] = True
        
        # 写入输出文件
        if output_dir:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"{file_path.stem}.md"
            output_path.write_text(full_content, encoding="utf-8")
            result["output"] = str(output_path)
            
    except Exception as e:
        result["error"] = str(e)
    
    return result


def batch_convert(directory: str, output_dir: str = "./output",
                  recursive: bool = True) -> list[dict]:
    """批量转换目录中所有符合条件的文件"""
    files = scan_files(directory, recursive)
    results = []
    
    for f in files:
        print(f"转换: {f.name} ...")
        r = convert_file(f, Path(output_dir))
        results.append(r)
        if r["success"]:
            print(f"  -> 成功: {r['output']}")
        else:
            print(f"  -> 失败: {r['error']}")
    
    # 生成汇总索引
    _generate_index(results, Path(output_dir))
    
    return results


def _generate_index(results: list[dict], output_dir: Path):
    """生成转换结果汇总索引"""
    success = [r for r in results if r["success"]]
    failed = [r for r in results if not r["success"]]
    
    index = f"""# 文档转换汇总

## 统计

- 总计: {len(results)} 个文件
- 成功: {len(success)} 个
- 失败: {len(failed)} 个

## 成功转换

| # | 源文件 | 输出文件 | 类型 |
|---|--------|---------|------|
"""
    for i, r in enumerate(success, 1):
        src = Path(r["source"]).name
        out = Path(r["output"]).name if r["output"] else "-"
        ext = Path(r["source"]).suffix.upper()
        index += f"| {i} | {src} | [{out}]({out}) | {ext} |\n"
    
    if failed:
        index += "\n## 转换失败\n\n"
        index += "| # | 源文件 | 错误信息 |\n|---|--------|----------|\n"
        for i, r in enumerate(failed, 1):
            src = Path(r["source"]).name
            index += f"| {i} | {src} | {r['error']} |\n"
    
    (output_dir / "README.md").write_text(index, encoding="utf-8")
```

### 3.4 命令行一键转换

```bash
# 单文件转换
markitdown document.pdf -o document.md

# 批量转换（使用管道）
for f in *.pdf; do
    markitdown "$f" -o "${f%.pdf}.md"
done

# 通过管道读取
cat document.pdf | markitdown > output.md
```

---

## 四、高级功能

### 4.1 AI 增强图片描述

```python
from markitdown import MarkItDown
from openai import OpenAI

client = OpenAI()
md = MarkItDown(
    llm_client=client,
    llm_model="gpt-4o",
    llm_prompt="请详细描述这张图片的内容"
)
result = md.convert("photo.jpg")
print(result.text_content)
```

### 4.2 自定义提示词

```python
md = MarkItDown(
    llm_client=client,
    llm_model="gpt-4o",
    llm_prompt="以中文详细描述这幅图像中的所有视觉元素、文字内容和布局"
)
```

### 4.3 输出格式后处理

```python
def post_process(content: str) -> str:
    """对 markitdown 输出做后处理优化"""
    import re
    
    # 修复多余空行（超过2个连续空行合并为2个）
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    # 确保标题前后有空行
    content = re.sub(r'([^\n])\n(#{1,6}\s)', r'\1\n\n\2', content)
    content = re.sub(r'(#{1,6}\s[^\n]+)\n([^\n#])', r'\1\n\n\2', content)
    
    # 代码块前后添加空行
    content = re.sub(r'([^\n])\n(```)', r'\1\n\n\2', content)
    content = re.sub(r'(```)\n([^\n`])', r'\1\n\n\2', content)
    
    # 删除文件尾部的多余空行
    content = content.rstrip() + '\n'
    
    return content
```

---

## 五、使用指南

### 5.1 在 Trae IDE 中触发

当用户表达以下意图时自动调用本 Skill：

- "把这个 PDF 转成 Markdown"
- "批量转换这些文档"
- "把 Word/Excel/PPT 转成 .md"
- "整理这些文档变成文本格式"
- "提取文档内容为 Markdown"

### 5.2 最佳实践

1. **依赖管理**：优先使用 `pip install 'markitdown[all]'`，覆盖所有格式
2. **大文件处理**：对于超大文件（>100MB），考虑先拆分再转换
3. **编码处理**：所有输出统一使用 UTF-8 编码
4. **保留源文件**：始终保留原始文件，不进行原地修改
5. **错误处理**：单文件失败不影响批量转换的其余文件
6. **输出目录**：建立结构清晰的输出目录 `./markdown-output/<类别>/`

### 5.3 故障排查

| 问题 | 解决方案 |
|------|---------|
| `ModuleNotFoundError` | 执行 `pip install 'markitdown[all]'` |
| PDF 提取乱码 | PDF 为扫描件时，添加 `llm_client` 启用 OCR |
| Excel 格式丢失 | 使用 `[xlsx]` extra 而非 `[xls]` |
| 音频转录失败 | 检查 `[audio-transcription]` 是否安装 |
| Python 版本过低 | 要求 Python >= 3.10 |

---

## 六、依赖

- **Python** >= 3.10
- **markitdown** >= 0.1.3（PyPI 安装，无需 git clone）
- **可选**：openai（用于 LLM 增强图片描述）