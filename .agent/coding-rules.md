# 编码规则

1. 不允许硬编码优招、捷聘到主流程。
2. 所有来源必须通过 DataSourcePlugin 接入。
3. 数据先进入 Raw Table，再进入 Clean Table。
4. 所有数据库变更必须通过 packages/db/schema.sql 和 migrate.ts 管理。
5. 真实数据不进 Git。
6. 登录态不进 Git。
7. 每次任务结束必须更新 docs/dev-log.md。

## 长期规范沉淀规则

* 如果用户提出新的长期开发规则，必须沉淀到 README.md 和 .agent 对应文件。
* 如果规则影响任务卡格式，必须更新 .agent/task-template.md。
* 如果规则影响跨设备开发，必须更新 docs/dev-log.md 和 README.md。
* 如果规则影响 GitHub Issue 流程，必须更新 .agent/github-issues-rules.md。
* 如果规则影响 UI 风格，必须更新 .agent/ui-rules.md。
* 如果规则影响安全边界，必须更新 .agent/security-rules.md。
* 规则更新后，必须在 docs/dev-log.md 记录。
* 不允许只在对话里记住规则而不写入项目文件。
