# GitHub Issues 规则

1. 每张任务卡优先对应一个 GitHub Issue。
2. Issue 标题使用 `[Task NNN] 简短目标`。
3. Issue 正文必须包含背景、目标、范围、不做范围、验收标准和命令验证清单。
4. 任务完成后在 Issue 评论 Done 清单，记录已验证命令和剩余风险。
5. 如果本机 git 不可用，先输出可复制的 Issue Markdown，不强行 commit / push。
6. 跨设备继续开发时，以 GitHub Issue、docs/dev-log.md、README 为接续入口。

## 标题和 Labels 规则

* Issue 标题格式：`[Task NNN] 任务标题`。
* 常用 Labels：`task`、模块标签、任务类型标签、`codex`、`cross-device`、优先级标签。
* 任务开始前必须确认 Issue 标题、编号、链接和 Labels。

## Started / Blocked / Done 评论规则

* Started 评论：说明开始时间、任务范围、不做范围和预计验证命令。
* Blocked 评论：说明阻塞原因、已尝试方案、需要用户或外部环境提供什么。
* Done 评论：说明完成内容、验证命令、未完成项、风险、下一步、commit hash 或 PR link。

## 任务完成自动同步规则

* 每次任务完成后，必须在对应 Issue 评论 Done。
* Done 评论必须包含：
  * 完成内容
  * 验证命令
  * 未完成项
  * 风险
  * 下一步
  * commit hash 或 PR link，如果已提交
* 如果无法操作 GitHub Issue，必须把 Issue 评论草稿保存到 docs/github-issues/。
* GitHub Issue 状态必须和 docs/dev-log.md 保持一致。
* 如果发现不一致，必须在下一次任务开始前修正。
