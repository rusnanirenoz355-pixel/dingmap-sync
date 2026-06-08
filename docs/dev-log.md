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

## 任务卡 002-A：粘贴模板导入 Clean Table

### Issue 同步

* Task 001-D Issue：线上创建失败，GitHub app 返回 403，已更新 docs/github-issues/task-001-d-issue.md 的 Done 评论草稿。
* Task 002 Issue：线上创建失败，GitHub app 返回 403，已更新 docs/github-issues/task-002-issue.md。
* Task 002 Issue 标题：[Task 002] 粘贴模板导入 Clean Table
* Issue 编号：线上未创建
* Issue 链接：docs/github-issues/task-002-issue.md
* Issue 状态：本地草稿 / 待手动创建

### 已完成

* manual_paste 支持 TSV 表格文本解析。
* 支持第一行作为表头。
* 支持字段别名映射：站点、地址、电话、薪资、福利、联系人、面试时间、岗位、备注。
* ImportPreviewRow 已支持 valid、invalid、duplicate、update_candidate。
* 支持手机号基础校验和 11 位中国大陆手机号提取。
* 支持 merge_key 生成。
* 支持 current_hash 计算，hash 字段包含经纬度、负责人、薪资、福利、面试时间、岗位、备注等。
* 支持 duplicate / update_candidate 判断。
* 新增 packages/db/manual-paste.ts，提供 previewManualPaste、importManualPaste、listCleanMarkers。
* 新增 Next.js API route：预览、导入、读取 Clean Table。
* Dashboard 已支持粘贴、生成预览、清空、导入 Clean Table、导入结果统计和 Clean Table 展示。
* 导入写入 raw_records 和 clean_markers。
* duplicate 默认跳过，invalid 不写入，valid 新增，update_candidate 更新。
* 移动端页面级横向溢出已修复，表格保留内部横向滚动。

### 未完成

* 不做自然语言复杂解析。
* 不做没有表头的智能猜测。
* 不做优招 / 捷聘真实采集。
* 不做钉图真实登录。
* 不做钉图一键录入模板导出。
* 不做 Playwright 自动点击。
* 不改动数据库 schema。
* 不接入真实业务数据。
* 线上 GitHub Issue 因权限 403 未创建，需要手动复制 docs/github-issues 草稿。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm db:migrate | 成功 | schema 无变更，迁移可执行 |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | 5 个测试文件，15 个测试通过 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过 |
| corepack pnpm dev | 成功 | Dashboard 可启动，API smoke test 通过 |

### 浏览器验证

* Dashboard 可打开。
* 可以粘贴 TSV 并生成预览。
* valid 行可导入。
* 导入后 Clean Table 显示数据。
* 重复粘贴可识别 duplicate。
* 桌面和移动端无页面级横向溢出。
* 浏览器控制台无 error。

### 下一步

1. 手动创建 / 同步 GitHub Issue。
2. 提交并推送 Task 002-A。
3. 进入 Task 003：Clean Table 导出钉图一键录入模板。

### 提交记录

* 功能提交：dc5a7a675c8d5f97a18e2ca150494970639e178f

## 任务卡 002-B 审核记录

### 审核结论

不通过

### 通过项

* `docs/github-issues/task-001-d-issue.md` 已存在，Task 001-D 至少有本地 Issue 草稿。
* `docs/github-issues/task-002-issue.md` 已存在，Task 002 至少有本地 Issue 草稿。
* `manual_paste` 仍作为 DataSourcePlugin 存在，解析逻辑没有写死在页面组件里。
* Task 002 当前没有越界实现优招采集、捷聘采集、钉图真实登录、钉图导出、Playwright 自动点击、定时同步或真实业务数据接入。
* OKX 浅色基础 Dashboard 仍可启动，页面保持白色 / 浅灰背景和黑色主按钮方向。
* `.gitignore` 已排除 `.env`、`.auth`、`data/*.db`、`data/*.sqlite`、`data/screenshots`、`data/uploads`、`data/exports`、`node_modules` 等敏感或生成目录。
* `corepack pnpm check`、`corepack pnpm lint`、`corepack pnpm test`、`corepack pnpm verify` 均通过。

### 问题

* Task 001-D 本地 Issue 草稿未记录指定 commit：`cbbe346e608ef2236ca92966593722b4709ef23f`。
* 线上 GitHub Issues 当前显示 0 个 Issue；Task 001-D 和 Task 002 均未确认已在线创建。
* `docs/dev-log.md` 在本次审核前未记录 Task 002 的 Issue 信息或 Task 002 完成记录。
* `packages/sources/manual-paste/parser.ts` 仍是按行切分的占位实现，不支持 TSV 表头识别、字段别名映射、预览状态、校验、去重或 hash。
* `packages/sources/manual-paste/mapper.ts` 仍只把占位预览映射为 `review` / `need_confirm`，未实现写入前校验、`pending`、`create` / `update`、`current_hash`、`merge_key`、`locked_fields`、`manual_override` 等要求。
* `packages/normalizer/field-aliases.ts` 缺少 `interview_time` 和 `job_title` 字段别名。
* 预览结构仍是 Task 001 占位的 `parseStatus`，没有 `valid`、`invalid`、`duplicate`、`update_candidate`。
* 未发现 clean_markers 写入接口或导入逻辑；duplicate / invalid 跳过、update_candidate 防覆盖等规则均未实现。
* Dashboard 仍是占位页面，缺少识别 / 预览按钮、清空按钮、真实预览表格、状态标签、错误 / 警告展示、导入结果统计和导入后 Clean Table 数据显示。
* 测试仍只有 `tests/normalizer.test.ts` 的 3 个基础用例，未覆盖 Task 002 要求的 TSV、别名、空行、手机号、invalid、duplicate、update_candidate、valid 导入。
* `corepack pnpm dev -- --hostname ...` 会失败，因为当前 dev 脚本 `cd apps/dashboard && next dev` 会把额外参数传成目录；裸 `corepack pnpm dev` 可启动。

### 风险

* 当前 Task 002 仍处于占位状态，若进入 Task 003，会缺少 Clean Table 真实数据来源。
* git 不在 PATH，当前会话无法执行 `git status`，因此不能确认敏感文件是否已进入暂存区或历史。
* 本地存在 `data/app.db`、`data/screenshots`、`data/uploads`、`data/exports`、`node_modules`，虽然 `.gitignore` 已覆盖，但推送前仍需用 GitHub Desktop 或修复 Git 后确认未提交。
* GitHub 线上 Issue 未创建时，跨设备协作只能依赖本地草稿，状态同步风险较高。

### 验证命令

| 命令 | 状态 | 备注 |
| -- | -- | -- |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | Vitest 通过：1 个测试文件，3 个用例 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过 |
| corepack pnpm dev | 成功 | 裸命令可启动；3000 被占用时自动转 3002，HTTP 200。带参数启动会失败 |

### 是否可以进入任务卡 003

否

### 下一步建议

回到任务卡 002：补齐 TSV 表头识别、字段别名映射、预览状态、校验、去重、写入 clean_markers、Dashboard 真实交互和测试后，再重新执行 002-B 审核。通过后再进入任务卡 003：Clean Table 导出钉图一键录入模板。

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

## 任务卡 003-A：Clean Table 导出钉图一键录入模板

### 当前状态

已完成标准输出层第一版：Clean Table 可以导出为钉图真实一键导入模板字段的 `.xlsx` 文件。字段配置集中在 `packages/dingmap/export-template.ts`，后续杂乱 Excel、优招、捷聘等数据源进入 Clean Table 后复用同一输出层。

### 已完成

* 新增钉图真实模板字段配置：`标记名称`、`详细地址`、`经度`、`纬度`、`备注`、`字段一`、`字段二`。
* `标记名称` 映射 `siteName`，`详细地址` 映射 `address`。
* `经度` / `纬度` 以数字写入，空值留空。
* `备注` 使用 `buildDingmapDescription(marker)`，继续包含 `【系统同步信息】` 和 `【人工备注】`。
* `字段一` 使用 `stationManager + phone`。
* `字段二` 使用 `remark.trim()` 优先，否则 `interviewTime.trim()`，否则留空。
* `packages/dingmap/one-click-export.ts` 已输出 `Sheet1` 和真实 7 列表头。
* 新增 `packages/db/dingmap-export.ts`，默认导出 `sync_status = pending` 且 `sync_action = create / update` 的 Clean Marker。
* 空站点名且空地址的记录会跳过。
* 导出文件生成到 `data/exports/dingmap-import-YYYYMMDD-HHmmss.xlsx`。
* Dashboard 新增“钉图模板导出”区域、黑色导出按钮、Loading 状态、文件名、导出条数、跳过条数和下载链接。
* 新增 API：`POST /api/dingmap/export` 和 `GET /api/dingmap/download/[filename]`。
* 导出行为写入 `sync_plan` 和 `sync_logs`，不新增 schema。
* `sync_logs.after_json` 只记录 marker id、source、source id、filename 和字段名，不记录完整地址、手机号或导出行值。
* 未保存原始钉图模板文件，未保存真实样例数据。

### 不做范围确认

* 不做钉图真实上传。
* 不做钉图真实登录。
* 不做 Playwright 自动点击。
* 不接优招 / 捷聘采集。
* 不新增数据源。
* 不改数据库 schema。
* 不做定时同步任务。
* 不提交真实业务数据。

### 新增测试

* `packages/dingmap/export-template.test.ts`
* `packages/dingmap/one-click-export.test.ts`
* `packages/db/dingmap-export.test.ts`

覆盖内容：

* 真实模板表头顺序。
* 七个字段映射。
* `字段二` fallback 规则。
* 描述字段分区。
* Excel `Sheet1` 表头。
* 文件名时间戳格式。
* 可导出记录过滤。
* 默认导出路径为项目根 `data/exports`。
* `sync_plan` / `sync_logs` 写入。
* 导出日志不包含完整地址或手机号。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | 8 个测试文件、25 个测试通过 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过；受当前沙箱路径限制影响，最终 verify 使用提升权限执行 |

### GitHub Issue 同步

* Task 003 Issue 草稿：`docs/github-issues/task-003-issue.md`
* 本会话无法通过 GitHub App 直接更新线上 Issue；若线上 Issue 已手动创建，可复制草稿中的 Done 评论。

### 提交记录

* 设计提交：ec1aa150c0ee6090fe66a3810590aac635fc6047
* 功能提交：07d65518947ee02f1e53db9485eb6d9f685c454c

### 当前风险

* 仍未做钉图真实上传验证，本任务只生成可下载模板文件。
* 线上 GitHub Issue 是否已更新取决于手动同步或后续授权可用性。

### 下一步

1. 用 Dashboard 导出一份脱敏或本地测试数据生成的 `.xlsx`，手动上传到钉图验证模板兼容性。
2. 若钉图需要调整列名或字段含义，只改 `packages/dingmap/export-template.ts`。
3. 后续接入杂乱 Excel、优招、捷聘时，继续先入 Raw Table / Clean Table，再复用本导出层。
