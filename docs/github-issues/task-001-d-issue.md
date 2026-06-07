# [Task 001-D] README / Agent 规范自动更新机制

Labels: `task`, `docs`, `workflow`, `codex`, `cross-device`, `priority-high`

## 背景

任务卡 001 已完成项目地基。在进入任务卡 002 前，需要补齐 README 和 Agent 规则，确保后续每次任务完成后自动更新 dev-log、Issue、任务卡、README 和 .agent。

## 目标

建立任务完成后的自动更新机制，避免跨设备开发时丢上下文。

## 范围

* 更新 README 开发总规范
* 更新 README 必须做 / 不允许做 / 推荐做
* 更新 README 任务完成后自动更新规则
* 更新 .agent/task-template.md
* 更新 .agent/coding-rules.md
* 更新 .agent/github-issues-rules.md
* 更新 docs/dev-log.md
* 创建 docs/task-cards/001-d-readme-agent-auto-update.md

## 不做范围

* 不做粘贴导入
* 不做 Clean Table 入库
* 不做优招采集
* 不做捷聘采集
* 不做钉图导出
* 不改数据库 schema
* 不接入真实业务数据

## 验收标准

* README 已包含必须做 / 不允许做 / 推荐做
* README 已包含任务完成后自动更新规则
* .agent/task-template.md 已包含任务卡自查
* .agent/coding-rules.md 已包含长期规范沉淀规则
* .agent/github-issues-rules.md 已包含任务完成自动同步规则
* docs/dev-log.md 已记录任务卡 001-D
* corepack pnpm verify 通过

## 命令验证清单

* [ ] corepack pnpm check
* [ ] corepack pnpm lint
* [ ] corepack pnpm test
* [ ] corepack pnpm verify

## 关联文档

* README.md
* docs/dev-log.md
* docs/task-cards/001-d-readme-agent-auto-update.md
* .agent/task-template.md
* .agent/coding-rules.md
* .agent/github-issues-rules.md

## 跨设备继续开发说明

完成后 commit + push。另一台电脑 pull 后先阅读 README、docs/dev-log.md 和本 Issue，再开始 Task 002。
