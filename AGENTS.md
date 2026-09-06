# Tool Call Constraints

- When calling `Pwsh`, you MUST always supply both `command` and `description` parameters.
- When calling `Glob` or file reading tools, always include `pattern` or `file_path`.
- Never call tools with missing required properties.
