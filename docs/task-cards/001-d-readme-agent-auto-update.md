# 任务卡 001-D：README / Agent 规范自动更新机制

## GitHub Issue

* Issue 标题：[Task 001-D] README / Agent 规范自动更新机制
* Issue 编号：待创建
* Issue 链接：待创建
* Labels：task, docs, workflow, codex, cross-device, priority-high

## 背景

任务卡 001 已完成项目地基。在进入任务卡 002 前，需要补齐 README 和 Agent 规则，确保后续每次任务完成后自动更新 dev-log、Issue、任务卡、README 和 .agent。

## 目标

建立任务完成后的自动更新机制，避免跨设备开发时丢上下文。

## 范围

* 更新 README 开发总规范。
* 更新 README 必须做 / 不允许做 / 推荐做。
* 更新 README 任务完成后自动更新规则。
* 更新 README 文档优先级。
* 更新 .agent/task-template.md。
* 更新 .agent/coding-rules.md。
* 更新 .agent/github-issues-rules.md。
* 更新 docs/dev-log.md。
* 创建 docs/task-cards/001-d-readme-agent-auto-update.md。
* 创建 docs/github-issues/task-001-d-issue.md。

## 不做范围

* 不做任务卡 002。
* 不做粘贴导入功能。
* 不做 Clean Table 入库。
* 不做优招真实采集。
* 不做捷聘真实采集。
* 不做钉图一键录入模板导出。
* 不做 Playwright 登录。
* 不修改数据库 schema。
* 不接入真实业务数据。
* 不提交 .env、.auth、data/*.db、screenshots、uploads、exports、node_modules。

## 涉及模块

* README.md
* .agent/task-template.md
* .agent/coding-rules.md
* .agent/github-issues-rules.md
* docs/dev-log.md
* docs/task-cards/
* docs/github-issues/

## 验收标准

* README 已包含必须做 / 不允许做 / 推荐做。
* README 已包含任务完成后自动更新规则。
* README 已包含文档优先级。
* .agent/task-template.md 已包含任务卡自查。
* .agent/coding-rules.md 已包含长期规范沉淀规则。
* .agent/github-issues-rules.md 已包含任务完成自动同步规则。
* docs/dev-log.md 已记录任务卡 001-D。
* docs/github-issues/task-001-d-issue.md 已创建。
* corepack pnpm verify 通过。

## 命令验证清单

* [ ] corepack pnpm check
* [ ] corepack pnpm lint
* [ ] corepack pnpm test
* [ ] corepack pnpm verify

## 关联文档

* README.md
* docs/dev-log.md
* .agent/task-template.md
* .agent/coding-rules.md
* .agent/github-issues-rules.md

## 跨设备继续开发说明

完成后 commit + push。另一台电脑 pull 后先阅读 README、docs/dev-log.md 和本 Issue，再开始 Task 002。

## 任务卡自查

1. 是否只做 README / Agent / 文档规则，不做业务功能。
2. 是否明确写了不做范围。
3. 是否包含 GitHub Issue 同步要求。
4. 是否包含跨设备继续开发要求。
5. 是否包含 docs/dev-log.md 更新要求。
6. 是否包含命令验证清单。
7. 是否避免提交敏感文件。
8. 是否统一写 pnpm run setup，而不是 pnpm setup。
9. 是否明确钉图一键录入优先，Playwright 逐条录入备用。
10. 是否更新任务卡模板的自查清单。
11. 是否让后续任务能自动判断是否需要更新 README 和 .agent。
12. 是否输出完成报告。
