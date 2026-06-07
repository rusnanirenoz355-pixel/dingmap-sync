# DingMap Sync

钉图自动化同步工作台用于把优招、捷聘、后续网页来源、手动粘贴、Excel 等多来源数据统一进入 Raw Table，再清洗成 Clean Table，并优先导出为钉图一键录入模板 / 数据包。

## 技术栈

Node.js、TypeScript、pnpm、Next.js、Tailwind CSS、SQLite、Playwright、ExcelJS、Zod、Vitest、ESLint、Prettier。

## 项目结构

```text
dingmap-sync/
  apps/dashboard/              # Next.js 工作台
  packages/db/                 # SQLite schema、迁移、种子数据
  packages/sources/            # DataSourcePlugin 插件与 registry
  packages/browser-controller/ # Playwright 浏览器控制占位
  packages/normalizer/         # 清洗、校验、hash
  packages/dingmap/            # 钉图一键导出与备用录入占位
  packages/shared/             # 核心共享类型
  docs/                        # 项目文档和任务卡
  .agent/                      # Codex 规则包
  data/                        # 本地运行数据，不提交真实数据库
```

## 本地启动

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm run setup
corepack pnpm dev
```

Dashboard 默认由 Next.js 启动，通常为 `http://localhost:3000`。

注意：pnpm 9 自带 `setup` 内置命令，项目初始化必须使用 `pnpm run setup`，不要把 pnpm 内置 setup 当作项目初始化脚本。

如果 Windows PowerShell 执行策略拦截裸 `pnpm`，可以使用：

```powershell
pnpm.cmd install
pnpm.cmd run setup
pnpm.cmd dev
```

或者：

```powershell
corepack pnpm install
corepack pnpm run setup
corepack pnpm dev
```

如果 `corepack enable` 因 shim 写入权限失败，可以先跳过 enable，临时使用 `corepack pnpm ...` 执行项目命令。

## 新电脑继续开发流程

```bash
git clone 仓库地址
cd dingmap-sync
corepack pnpm install
cp .env.example .env
corepack pnpm run setup
corepack pnpm dev
```

如果 `git` 命令不可用，需要先安装 Git for Windows 或修复 PATH；否则无法 commit、push，也无法在另一台电脑拉取最新代码。

## 环境变量说明

| 变量 | 说明 |
| --- | --- |
| DATABASE_URL | SQLite 数据库路径，默认 `file:./data/app.db` |
| DINGMAP_URL | 钉图地图地址 |
| QINGZ_URL | 优招入口地址 |
| CONOBUG_URL | 捷聘 / Conobug 入口地址 |
| PLAYWRIGHT_HEADLESS | Playwright 是否无头运行 |

## 为什么 .auth 和 data/*.db 不提交

`.auth`、`playwright/.auth` 可能包含登录态、Cookie 或账号相关信息；`data/*.db`、`data/*.sqlite`、`data/*.sqlite3`、`screenshots`、`uploads`、`exports`、上传、导出和截图目录可能包含真实手机号、地址、站点信息等敏感业务数据。因此这些文件必须只保留在本机，不进入 Git。

## 第一版功能范围

1. 创建 monorepo、依赖、脚本和 CI。
2. 创建 SQLite 表结构和迁移脚本。
3. 创建 DataSourcePlugin 接口和 manual_paste 占位插件。
4. 创建 Raw、Clean、Sync 相关共享类型。
5. 创建 normalizer、dingmap、browser-controller 基础模块。
6. 创建 OKX 浅色 dashboard 页面地基。

第一版不做真实采集、真实钉图登录、真实钉图录入、复杂自然语言解析、定时同步和真实业务数据接入。

## 常用命令

```bash
corepack pnpm run setup
corepack pnpm dev
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm playwright:install
corepack pnpm check
corepack pnpm lint
corepack pnpm test
corepack pnpm verify
```

## 开发总规范

### 必须做

* 每次开始任务前，先阅读 README.md、docs/dev-log.md、.agent/*。
* 每张任务卡必须对应一个 GitHub Issue。
* 每次任务开始时，在 GitHub Issue 评论 Started。
* 每次任务阻塞时，在 GitHub Issue 评论 Blocked + 原因。
* 每次任务完成时，在 GitHub Issue 评论 Done + commit hash / PR link。
* 每次任务完成后，必须更新 docs/dev-log.md。
* 每次任务完成后，必须更新对应 docs/task-cards/XXX.md。
* 如果任务改变了启动方式、目录结构、命令、长期规范或开发流程，必须同步更新 README.md。
* 如果任务新增长期开发规则，必须同步更新 .agent 对应规则文件。
* 提交前必须运行 pnpm verify 或 corepack pnpm verify。
* 项目初始化命令统一使用 pnpm run setup 或 corepack pnpm run setup。
* 跨设备开发必须先 git pull，再查看 GitHub Issue 和 docs/dev-log.md。
* 真实业务数据只允许存放在本地，不进入 Git。

### 不允许做

* 不允许提交 .env。
* 不允许提交 .auth。
* 不允许提交 data/*.db、data/*.sqlite、data/*.sqlite3。
* 不允许提交 screenshots、uploads、exports、logs。
* 不允许提交真实手机号、地址、联系人、Cookie、账号信息。
* 不允许把优招、捷聘写死到主流程。
* 不允许把 Playwright 逐条录入钉图作为第一方案。
* 不允许未经确认扩大任务范围。
* 不允许一个任务卡同时做多个阶段的大功能。
* 不允许绕过 Raw Table → Clean Table → Sync Plan → 钉图的数据流。
* 不允许跳过 dev-log 更新。
* 不允许跳过 GitHub Issue 状态更新。
* 不允许把 pnpm setup 当作项目初始化命令。

### 推荐做

* 先做本地闭环，再接入外部网站。
* 先做手动粘贴和 Excel 导入，再做优招 / 捷聘抓取。
* 先做 Clean Table → 钉图一键录入模板，再考虑 Playwright 自动点击。
* 先做预览，再写入数据库。
* 先做校验，再允许导入。
* 先小任务卡验证，再扩大范围。
* 复杂任务采用 A 窗口主开发、B 窗口日志 / 审核。
* 任务完成后立即更新 dev-log，避免跨设备丢上下文。
* 每晚结束前必须 commit + push。
* 如果 git 命令不可用，可以使用 GitHub Desktop 提交和推送。

## 任务完成后的自动更新规则

每次任务卡完成后，Codex / 智能体必须自动检查并更新：

1. docs/dev-log.md。
2. 对应 docs/task-cards/XXX.md。
3. GitHub Issue 状态 / 评论。
4. README.md，如果任务改变了启动方式、目录结构、命令或长期规范。
5. .agent 规则文件，如果新增了长期规范。
6. docs/github-issues 里的 Issue 草稿，如果无法直接操作 GitHub Issue。
7. README 中的下一步任务建议，如果任务推进了阶段。

如果以上任一项需要更新但未更新，任务不得视为完成。

## 文档优先级

当 README、docs/dev-log.md、GitHub Issue、.agent 规则不一致时：

1. GitHub Issue 最新状态用于判断当前任务状态。
2. docs/dev-log.md 用于判断本地实际进度。
3. README.md 用于判断项目长期规范。
4. .agent/* 用于约束 Codex / 智能体行为。
5. 如果发现冲突，必须在当前任务中修正，并记录到 dev-log。

## 下一步任务建议

1. 任务 002：实现粘贴模板导入 Clean Table。
2. 任务 003：实现 Clean Table 导出钉图一键录入模板。
3. 后续将优招、捷聘作为 DataSourcePlugin 插件接入。
