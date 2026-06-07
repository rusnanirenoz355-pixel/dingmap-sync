# 任务卡 002：粘贴模板导入 Clean Table

## GitHub Issue

* Issue 标题：[Task 002] 粘贴模板导入 Clean Table
* Issue 编号：线上未创建，GitHub app 当前返回 403
* Issue 链接：docs/github-issues/task-002-issue.md
* Labels：task, feature, manual-paste, clean-table, priority-high

## 背景

任务 001 已完成项目地基，任务 001-D 已补齐 README / Agent 规范自动更新机制。Task 002 优先实现不依赖外部网站的本地闭环：表格粘贴导入 Clean Table。

## 目标

实现“粘贴模板信息 -> 字段识别预览 -> 校验 / 去重 -> 导入 Clean Table”的第一版闭环。

## 范围

1. 扩展 manual_paste parser，支持 TSV 表格文本和第一行表头。
2. 支持字段别名识别：站点、地址、联系人、电话、薪资、福利、面试时间、岗位、备注。
3. 生成 ImportPreviewRow，包含 valid、invalid、duplicate、update_candidate 状态。
4. 校验手机号、关键字段和 merge_key。
5. 使用 current_hash 判断 duplicate / update_candidate。
6. 导入时写入 raw_records 和 clean_markers。
7. duplicate 默认跳过，invalid 不写入，valid 新增，update_candidate 更新。
8. Dashboard 增加粘贴、预览、清空、导入、导入结果和 Clean Table 显示。
9. 增加解析、别名、手机号、hash、状态判断测试。

## 不做范围

1. 不做自然语言复杂解析。
2. 不做没有表头的智能猜测。
3. 不做优招真实采集。
4. 不做捷聘真实采集。
5. 不做钉图真实登录。
6. 不做钉图一键录入模板导出。
7. 不做 Playwright 自动点击。
8. 不做定时同步。
9. 不修改数据库 schema。
10. 不接入或提交真实业务数据。

## 涉及模块

* packages/sources/manual-paste/
* packages/normalizer/
* packages/shared/
* packages/db/manual-paste.ts
* apps/dashboard/app/page.tsx
* apps/dashboard/app/api/
* tests/

## 验收标准

1. 可以在 Dashboard 粘贴带表头的 TSV 表格文本。
2. 可以点击生成预览。
3. 可以识别站点名称、地址、联系人、电话、薪资、福利、备注。
4. 可以显示 valid、invalid、duplicate、update_candidate。
5. invalid 行有明确错误原因。
6. duplicate 行默认不导入。
7. valid 行可以导入 clean_markers。
8. 导入后 Clean Table 能显示数据。
9. 不接入真实业务网站。
10. 不提交敏感文件。

## 命令验证清单

* [x] corepack pnpm db:migrate
* [x] corepack pnpm check
* [x] corepack pnpm lint
* [x] corepack pnpm test
* [x] corepack pnpm verify
* [x] corepack pnpm dev

## 关联文档

* docs/dev-log.md
* docs/github-issues/task-002-issue.md
* .agent/coding-rules.md
* .agent/github-issues-rules.md

## 跨设备继续开发说明

另一台电脑继续开发前：

1. git pull
2. corepack pnpm install
3. cp .env.example .env
4. corepack pnpm run setup
5. corepack pnpm dev
6. 查看本 Issue 和 docs/dev-log.md

## 任务卡自查

1. 是否只做表格粘贴导入 Clean Table：是。
2. 是否明确不做自然语言复杂解析：是。
3. 是否明确不做优招 / 捷聘 / 钉图：是。
4. 是否明确不做 Playwright 自动点击：是。
5. 是否保持 DataSourcePlugin 插件化：是。
6. 是否先预览，再入库：是。
7. 是否先校验，再导入：是。
8. 是否处理 duplicate / invalid / update_candidate：是。
9. 是否更新 docs/dev-log.md：是。
10. 是否更新 GitHub Issue 或生成草稿：已生成草稿，线上创建因 403 未完成。
11. 是否运行 check / lint / test / verify：是。
12. 是否避免提交敏感文件：提交前继续检查。
