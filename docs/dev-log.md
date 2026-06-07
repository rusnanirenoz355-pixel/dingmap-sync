# Dev Log

## 当前任务

任务卡 001：项目第一版地基

## 当前状态

已完成项目地基，Dashboard 可运行，基础命令验证通过。

## 已完成

* 创建 monorepo 项目结构。
* 创建 apps/dashboard。
* 创建 packages/db。
* 创建 packages/sources。
* 创建 packages/shared。
* 创建 packages/normalizer。
* 创建 packages/dingmap。
* 创建 packages/browser-controller。
* 创建 .agent 规则包。
* 创建 docs 文档。
* 创建 SQLite schema、migrate、seed。
* 创建 GitHub Actions。
* 创建 OKX 浅色风格 dashboard 首页。
* 创建 Raw Table / Clean Table / Sync Plan / Sync Logs 占位。
* 创建粘贴导入入口。
* 创建 manual_paste 数据源占位。
* 创建基础测试。

## 已验证命令

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm install | 成功 | 依赖已安装 |
| corepack pnpm db:migrate | 成功 | 数据库表已创建 |
| corepack pnpm db:seed | 成功 | seed 已执行 |
| corepack pnpm run setup | 成功 | 注意需要 run setup |
| corepack pnpm playwright:install | 成功 | Playwright 已安装 |
| corepack pnpm check | 成功 | 类型检查通过 |
| corepack pnpm lint | 成功 | lint 通过 |
| corepack pnpm test | 成功 | 1 个测试文件、3 个测试通过 |
| corepack pnpm verify | 成功 | verify 通过 |
| corepack pnpm dev | 成功 | dashboard 已启动 |

## 当前问题

* 当前环境没有可用 git 命令，git status 失败。
* corepack enable 因 E:\ shim 写入权限问题失败。
* pnpm setup 是 pnpm 9 内置命令，项目初始化需要使用 pnpm run setup。

## 当前处理方式

* 暂时使用 corepack pnpm ... 执行 pnpm 命令。
* README 已说明使用 pnpm run setup。
* Git 同步需要先安装或修复 Git 命令。

## 明天跨设备继续开发步骤

1. 确认本机已安装 Git。
2. 确认 GitHub 仓库已连接。
3. 在当前电脑执行 git status。
4. 如果 git 可用，执行：

   ```bash
   git add .
   git commit -m "chore: initialize dingmap sync workspace"
   git push
   ```

5. 到另一台电脑执行：

   ```bash
   git clone 仓库地址
   cd dingmap-sync
   corepack pnpm install
   cp .env.example .env
   corepack pnpm run setup
   corepack pnpm dev
   ```

6. 打开 GitHub Issue。
7. 读取 docs/dev-log.md。
8. 继续任务卡 002。

## 下一张任务卡

任务卡 002：粘贴模板导入 Clean Table

目标：

* 支持从 Excel / 飞书 / 微信表格复制 TSV 数据。
* 自动识别表头。
* 字段别名映射。
* 生成预览。
* 校验手机号、地址、必填字段。
* 去重。
* 导入 clean_markers。
* 在 Clean Table 显示。
* 支持导出 Excel。
* 同步对应 GitHub Issue。

## 任务卡 001-Z2 最终修正

### 已修正

* README 中项目初始化命令统一为 pnpm run setup。
* 跨设备继续开发步骤统一为 corepack pnpm run setup。
* 补充 PowerShell 下 pnpm 被执行策略拦截时可使用 pnpm.cmd 或 corepack pnpm。
* 记录 git 不在 PATH 的风险。

### 当前验证状态

| 命令              | 状态 | 备注                |
| --------------- | -- | ----------------- |
| pnpm install    | 成功 | 已审核               |
| pnpm dev        | 成功 | dashboard 3000 可用 |
| pnpm db:migrate | 成功 | 已审核               |
| pnpm run setup  | 成功 | 注意不是 pnpm setup   |
| pnpm check      | 成功 | 已审核               |
| pnpm lint       | 成功 | 已审核               |
| pnpm test       | 成功 | 已审核               |
| pnpm verify     | 成功 | 已审核               |

### 当前阻塞

* git 不在 PATH，当前会话无法完成 git commit / push。

### 推送建议

如果本机安装了 Git 或使用 GitHub Desktop，请提交：

commit message:
chore: initialize dingmap sync workspace

如果已有 GitHub Issue 编号，请使用：
chore: initialize dingmap sync workspace refs #ISSUE_NUMBER

### 明天继续开发前

必须确认：

* GitHub 仓库中已经有最新代码。
* docs/dev-log.md 已推送。
* README 中不再错误使用 pnpm setup。
* 另一台电脑使用 pnpm run setup。

## 任务卡 001-D-B 审核记录

### 审核结论

通过

### 通过项

* README 已包含开发总规范、必须做、不允许做、推荐做、任务完成后的自动更新规则、文档优先级、跨设备继续开发、`pnpm run setup` 注意事项和敏感文件不提交说明。
* README 已包含 GitHub Issue 同步要求，包括 Started / Blocked / Done、任务卡对应 Issue、完成后更新 Issue、跨设备先查看 Issue 和 dev-log。
* `.agent/task-template.md` 已包含任务编号、任务标题、GitHub Issue、背景、目标、范围、不做范围、涉及模块、验收标准、命令验证清单、关联文档、跨设备继续开发说明、完成后必须更新和任务卡自查。
* `.agent/task-template.md` 的任务卡自查已覆盖任务范围、不做范围、Issue 同步、跨设备、dev-log、命令验证、敏感文件、`pnpm run setup`、钉图一键录入优先、README / .agent 更新判断和完成报告。
* `.agent/coding-rules.md` 已包含长期规范沉淀规则。
* `.agent/github-issues-rules.md` 已包含任务完成自动同步规则，以及 Started / Blocked / Done 评论规则。
* `docs/dev-log.md` 已包含“任务卡 001-D：README / Agent 规范自动更新机制”记录。
* `docs/task-cards/001-d-readme-agent-auto-update.md` 已存在。
* `docs/github-issues/task-001-d-issue.md` 已存在，标题为 `[Task 001-D] README / Agent 规范自动更新机制`，Labels 包含 task、docs、workflow、codex、cross-device、priority-high。
* `corepack pnpm check`、`corepack pnpm lint`、`corepack pnpm test`、`corepack pnpm verify` 全部通过。
* 本审核会话只检查文档和规则，未开发粘贴导入、Clean Table 入库、采集、钉图导出、Playwright 登录或数据库 schema。

### 问题

* 无阻塞问题。

### 风险

* GitHub 当前未直接创建线上 Issue，仅保存了 Issue 草稿；后续推送后需要在 GitHub 上补齐或同步。
* 仍需在每次任务完成时真正执行这套自查，否则规则只停留在文档层。

### 验证命令

| 命令 | 状态 | 备注 |
| -- | -- | -- |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | Vitest 通过：1 个测试文件，3 个用例 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过 |

### 是否可以进入任务卡 002

是

### 下一步

任务卡 002：粘贴模板导入 Clean Table。

## 任务卡 001-D：README / Agent 规范自动更新机制

### 已完成

* README 增加开发总规范。
* README 增加必须做 / 不允许做 / 推荐做。
* README 增加任务完成后自动更新规则。
* README 增加文档优先级。
* .agent/task-template.md 增加任务卡自查。
* .agent/coding-rules.md 增加长期规范沉淀规则。
* .agent/github-issues-rules.md 增加任务完成自动同步规则。
* 创建 docs/task-cards/001-d-readme-agent-auto-update.md。
* 创建 docs/github-issues/task-001-d-issue.md。
* 记录本规则：后续所有任务卡都必须自查。

### 未完成

* 不涉及业务功能。
* 不开始任务卡 002。
* GitHub 连接当前没有返回可操作仓库，未直接创建线上 Issue，已保存 Issue 草稿。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | 1 个测试文件、3 个测试通过 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过 |

### 下一步

任务卡 002：粘贴模板导入 Clean Table。
