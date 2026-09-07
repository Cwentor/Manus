# Tool Call Constraints

- When calling `Pwsh`, you MUST always supply both `command` and `description` parameters.
- When calling `Glob` or file reading tools, always include `pattern` or `file_path`.
- Never call tools with missing required properties.


# 语言与交互铁律 (Strict Language & Output Rules)

- **全局输出语言**：除了代码块、变量名、SQL 关键字、终端命令、Git Commit 信息及原始错误堆栈外，所有思考过程（Thinking/Chain of Thought）、问题拆解、技术方案设计、改动说明与交互对话，**必须且仅能使用简体中文**。
- **英文输入时的语言锁定**：即使用户的提问包含英文、粘贴了全英文的报错日志（Traceback）或引用了英文技术文档，**回复与分析依然必须使用简体中文**，严禁不自觉切换为英文输出。
- **术语规范**：
  - 核心计算机与数据架构术语优先采用业界通行中文译名；
  - 首次出现或易歧义的概念建议双语对照，例如：“行级数据权限 (Row-Level Security, RLS)”、“抽象语法树 (AST)”、“模式校验 (Schema Validation)”；
  - 严禁对代码实体进行拼音化或意译（如代码中的变量名 `moving_avg`、`catalog`、`fill_gaps` 必须保持原样英文）。
- **代码注释规范**：新增或修改 Python 代码中的 docstring 和行内注释，统一使用简洁清晰的**简体中文**进行说明（专有名词保留英文）。
- **Git 提交信息**: 除了类似feat,fix,debug等之类的Git开发术语，其他和项目相关的描述和表达，如果不是必要的专业术语需要使用英文，其他通用表达统一使用**简体中文**进行说明
