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

## 任务卡 004-A：字段文本 / TSV / 带表头 Excel 导入 Clean Table

### 当前状态

已完成 Task 004 第一版导入层：字段名文本、TSV 粘贴、带表头 `.xlsx` 都可以先生成预览，再经服务端二次校验写入 Clean Table。导入后的 Clean Marker 保持 `sync_status = pending` 和 `sync_action = create / update`，继续复用 Task 003 钉图模板导出。

### 已完成

* 新增共享 import pipeline，集中处理字段别名、手机号规范化、校验、merge key、hash、preview summary。
* 手工粘贴入口保留原函数名，内部改为 key-value / TSV parser + 公共 pipeline。
* 支持 key-value 字段文本，中文冒号和英文冒号均可解析，空行分隔多条记录。
* 支持 TSV 粘贴，第一行作为表头。
* 支持 `.xlsx` 带表头 Excel 导入，默认读取第一个 Sheet，可按 Sheet 名选择。
* Excel 上传限制为 5 MB，最多 1000 条数据行。
* Excel 内存解析，不保存上传文件。
* 新增共享 DB import 服务，导入时从 raw rows 服务端二次 preview，不信任前端 status / mergeKey / currentHash。
* `valid` 新增，`duplicate` 跳过，`invalid` 跳过，`update_candidate` 默认更新。
* Excel 写入 `source = excel`、`originType = excel`。
* 字段文本 / TSV 写入 `source = manual_paste`、`originType = manual_paste`。
* 新增 Excel preview / import API。
* Dashboard 新增“字段文本 / TSV 导入”和“Excel 导入”入口，保留 Task 003 “导出钉图模板”按钮。
* 测试文件不写完整业务手机号字面量，运行时用拼接方式生成合成手机号。

### 隐私和数据口径

* 手机号是业务字段，运行时允许导入 Clean Table、raw_records，并允许导出到钉图模板。
* 真实手机号、真实地址不写入测试文件、任务卡示例、Issue 草稿、文档样例或 Git 提交样例。
* 未提交真实 Excel、Cookie、账号信息、`.env`、`.auth`。
* 未提交 `data/*.db`、`data/uploads/`、`data/exports/`。

### 不做范围确认

* 不做 OCR / 图片识别。
* 不做无表头猜测。
* 不做多 Sheet 合并。
* 不支持 `.xls` / `.csv`。
* 不做钉图真实上传。
* 不做钉图登录。
* 不做 Playwright 自动操作。
* 不接优招 / 捷聘采集。
* 不修改 Task 003 钉图 7 列模板。
* 不改数据库 schema。

### 新增 / 更新测试

* `packages/sources/import-pipeline/preview.test.ts`
* `packages/sources/manual-paste/parser.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/sources/excel-import/parser.test.ts`
* `apps/dashboard/app/api/excel/excel-routes.test.ts`
* `packages/normalizer/build-marker-hash.test.ts`
* `packages/normalizer/normalize-phone.test.ts`

覆盖内容：

* key-value 字段文本解析。
* TSV 兼容。
* Excel `.xlsx` 内存解析。
* Sheet 选择。
* 文件大小和行数限制。
* 字段别名映射。
* 空行跳过。
* 未识别字段保留在 raw。
* 手机号规范化。
* duplicate / invalid / update_candidate。
* DB insert / update / skip / revalidate。
* Excel API preview / import。
* Excel 导入后仍可被 Task 003 export 过滤器选中。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm run check | 成功 | TypeScript 检查通过 |
| corepack pnpm run lint | 成功 | ESLint 通过 |
| corepack pnpm run test | 成功 | 12 个测试文件、46 个测试通过 |
| corepack pnpm run verify | 成功 | check + lint + test 全部通过 |
| Browser smoke | 成功 | Dashboard 可见字段文本 / TSV、Excel 导入、钉图导出、Clean Table，控制台无 error |

### GitHub Issue 同步

* Task 004 Issue 草稿：`docs/github-issues/task-004-issue.md`
* 当前未直接创建或更新线上 Issue；如线上 Issue 已手动创建，可复制草稿中的 Done 评论。

### 提交记录

* 设计提交：eb7eecd31011258b607872b6fcb6d7f7b7391a77
* 扩展设计提交：e9471cc8f655c7372f86e5bbf074d0b7e0590727
* 实现计划提交：fa2ac8f50a82a8cfd63cf654f8fdbed9a42bba6f
* 功能提交：60a9abad1ab607b3bf07e1c5931cfa004f88e202

### 当前风险

* 第一版仅支持 `.xlsx` 第一行表头。
* Sheet 可选择但不合并。
* 仍未做钉图真实上传验证，本任务只负责导入 Clean Table 并复用 Task 003 文件导出层。

### 下一步

1. 使用脱敏或本地测试数据走一次字段文本 / TSV / Excel 导入，再导出钉图模板文件做人工验收。
2. 若要接优招 / 捷聘，继续保持 Raw Table / Clean Table / DingMap export 的三层路径。
3. 若后续要支持 `.csv`、`.xls` 或无表头推断，应作为新任务卡处理。

## 任务卡 005-A：Clean Table 已导入数据管理与软删除

### 当前状态

已完成 Task 005 第一版已导入数据管理层。当前实现基于 Task 004 分支能力继续开发，复用字段文本 / TSV / Excel 导入后的 Clean Table 数据，并新增独立 `/data-management` 页面用于查询、筛选、编辑、异常识别和软删除。软删除数据会从 Dashboard 默认统计、Clean Table 默认列表和 Task 003 钉图模板导出中排除。

### 已完成

* 基于 `codex/task-004-excel-import` 当前成果创建并推进 `codex/task-005-imported-data-management` 分支。
* 新增 `deleted_at TEXT`，fresh schema 直接包含该列，老数据库迁移通过幂等 `ALTER TABLE` 补列。
* 未新增 `import_batch_id`。
* 新增 `packages/db/clean-marker-management.ts`，集中管理 list / edit / softDelete / statistics / anomaly derivation。
* 默认 Clean Table 列表排除 `deleted_at IS NOT NULL` 的软删除记录。
* Task 004 duplicate / update_candidate 指纹加载只读取未删除记录。
* Task 003 DingMap 导出查询和 `filterExportableMarkers` 均排除软删除记录。
* 新增 `GET /api/clean-markers/manage`，支持分页、搜索、来源、异常、包含已删除、只看已删除筛选。
* 新增 `PATCH /api/clean-markers/[id]`，只允许更新业务字段，服务端重算 `mergeKey` / `currentHash`，设置 `manualOverride = true`、`syncAction = update`、`syncStatus = pending`。
* 新增 `DELETE /api/clean-markers/[id]`，执行软删除并设置 `syncAction = archive`、`syncStatus = skipped`。
* 新增 `/data-management` 独立管理页，采用固定行高表格、sticky 操作列和右侧 Drawer。
* Dashboard 新增“管理已导入数据”入口和有效 / 异常 / 已删除摘要。
* 长文本地址、薪资、福利、备注、异常信息默认摘要展示，可通过 Drawer 查看完整内容。
* 异常识别由 Clean Table 当前状态派生：缺坐标、坐标非法、error_msg 非空、疑似重复。

### 隐私和数据口径

* 手机号和地址作为运行时业务字段，允许在管理页、Clean Table、raw_records 和钉图模板导出链路中使用。
* 测试、任务卡、Issue 草稿、文档样例不写真实手机号或真实地址。
* 未提交真实 Excel、Cookie、账号信息、`.env`、`.auth`。
* 未提交 `data/*.db`、`data/uploads/`、`data/exports/`。

### 不做范围确认

* 不做 `import_batch_id`。
* 不做硬删除。
* 不删除 `raw_records`。
* 不做恢复按钮。
* 不做地图渲染。
* 不做钉图真实上传 / 登录。
* 不做 Playwright。
* 不做 OCR / 图片识别。
* 不接优招 / 捷聘。
* 不改 Task 003 钉图 7 列模板字段。

### 新增 / 更新测试

* `packages/db/migrate.test.ts`
* `packages/db/clean-marker-management.test.ts`
* `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`
* `apps/dashboard/app/components/TruncatedText.test.ts`
* 更新 `packages/db/import-clean-markers.test.ts`
* 更新 `packages/db/dingmap-export.test.ts`

覆盖内容：

* `deleted_at` fresh schema 与幂等迁移。
* 默认列表排除软删除。
* includeDeleted / deletedOnly。
* 搜索与来源筛选。
* 缺坐标、非法坐标、error_msg、疑似重复异常识别。
* 编辑只更新可编辑字段，忽略只读 / 客户端可信字段。
* 编辑后重算 `mergeKey` / `currentHash`。
* 编辑后设置 `manualOverride = true`、`syncAction = update`、`syncStatus = pending`。
* 软删除写入 `deleted_at` 并从统计 / 默认列表 / Task 003 导出中排除。
* API list / edit / delete、非法 id、not found、非法坐标、重复删除。
* 长文本摘要 helper。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm run check | 成功 | TypeScript 检查通过 |
| corepack pnpm run lint | 成功 | ESLint 通过 |
| corepack pnpm run test | 成功 | 16 个测试文件、63 个测试通过 |
| corepack pnpm run verify | 成功 | check + lint + test 全部通过 |
| HTTP smoke | 成功 | `http://localhost:3000/` 和 `/data-management` 返回 200，管理 API 返回 200 |

### GitHub Issue 同步

* Task 005 Issue 草稿：`docs/github-issues/task-005-issue.md`
* 当前未直接创建或更新线上 Issue；如线上 Issue 已手动创建，可复制草稿中的 Done 评论。

### 提交记录

* 设计提交：`7df2573b965e191214324e3187e387ce54900eb2`
* 实现计划提交：`4fafbc521fa0aa8e342fcb35331e81af5b0a89f7`
* 功能提交：`d867d36d99e5b740e76d42d7184989f0b84cee85`

### 当前风险

* `/data-management` 第一版不做批量编辑、批量删除、恢复和权限审计。
* 管理页展示运行时业务字段；文档和测试仍保持脱敏样例。
* 本轮 Browser 控制工具未暴露，已用 HTTP smoke 代替页面可达性验证。

### 下一步

1. 用脱敏数据人工走一遍导入、管理编辑、软删除、导出链路。
2. 若需要恢复已删除数据，单独开 Task 006 或后续任务卡。
3. Task 004 + Task 005 稳定后，统一处理 PR / merge 顺序。

## 任务卡 006-A：钉图模板自动上传 MVP

### 当前状态

已开始并实现 Task 006 第一版本地自动上传 MVP。当前分支为 `codex/task-006-dingmap-auto-upload`，基于已合并 Task 004 / Task 005 的最新 `main` 创建。本任务不改 Task 003 钉图模板字段，只在导出文件之上增加本地 Playwright 上传和 Dashboard 控制入口。

### 已完成

* 新增本地 headful Playwright 钉图上传控制器。
* 新增 `POST /api/dingmap/upload`、`GET /api/dingmap/upload/status`、`POST /api/dingmap/upload/continue`。
* 上传 API 改为 job 状态模型，避免无限等待长请求。
* 支持 `pending`、`opening_dingmap`、`requires_login`、`uploading`、`confirming`、`success`、`failed`、`blocked`、`timeout`、`unknown`。
* 首次未登录时返回 `requires_login`，保留本地 Playwright 浏览器等待用户手动登录。
* 验证码、人机验证、页面结构变化等不可自动化情况返回 `blocked`。
* 文件已提交但无可靠成功提示时返回 `unknown`，Dashboard 文案为“已提交，结果待人工确认”。
* Dashboard 支持选择最近导出的 `dingmap-import-*.xlsx` 并启动自动上传。
* 自动化入口修正为钉图地图列表页，先定位“我协作的地图 - 速宸立信 团队”，再进入“面试点”地图。
* 一键导入入口修正为地图内“图层列表 → 更多 → 数据导入 → 新增数据”。
* 找不到目标团队或“面试点”地图时返回 `failed`，提示确认钉图权限。
* 默认上传文件为 `data/exports/` 下最新 `dingmap-import-*.xlsx`。
* API 只接受文件名，后端执行 basename、格式、resolve、realpath 和 exportsDir 校验。
* 登录态目录为 `data/browser-profile/dingmap/`。
* 失败截图目录为 `data/screenshots/dingmap-upload/`，文件名包含 timestamp 和 stage。
* `.gitignore` 已覆盖 `.env`、`.env.*`、`.auth/`、`data/*.db`、`data/**/*.db`、`data/uploads/`、`data/exports/`、`data/screenshots/`、`data/browser-profile/`。
* 新增 Task 006 设计说明、任务卡和 GitHub Issue 草稿。
* 补充真实钉图路径：团队“速宸立信 团队”、地图“面试点”、地图内“图层列表 → 更多 → 数据导入 → 新增数据”。
* Dashboard “打开钉图”链接改为 `https://dm.dingmap.com/home`，避免暗示直接上传到任意地图页。
* 上传顺序收紧为先选择并确认当前 Excel 文件，再点击右下角“导入”；未确认文件选择时返回 `blocked / upload-input`，未找到导入按钮时返回 `blocked / import-confirm`。

### 新增 / 更新测试

* 更新 `packages/db/dingmap-export.test.ts`，覆盖导出文件路径穿越拒绝和最近导出选择。
* 新增 `apps/dashboard/app/api/dingmap/upload/dingmap-upload-routes.test.ts`，覆盖上传 API filename 防护、状态响应和 continue 错误路径。
* 新增 `packages/browser-controller/dingmap-selectors.test.ts`，锁定目标团队、地图和地图内数据导入入口 selector。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm install | 成功 | workspace 依赖同步 |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | 21 个测试文件、83 个测试通过 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过 |
| Dashboard smoke | 成功 | `http://localhost:3000/` 上传控件可见，“打开钉图”指向 `https://dm.dingmap.com/home` |
| Upload live smoke | unknown | 使用脱敏 synthetic 导出文件，已进入“速宸立信 团队 / 面试点 / 数据导入”流程并点击“导入”；钉图页面无可靠成功 / 失败提示 |
| 敏感文件检查 | 成功 | `.env`、数据库、exports、screenshots、browser profile 均未跟踪；`git ls-files` 仅返回既有 `.env.example` 模板 |

### 当前风险

* 钉图外部页面 selector 可能变化。
* 首次真实上传可能需要手动登录。
* 如出现验证码、人机验证或权限不足，本任务只能返回 `blocked` / `requires_login` 并保存截图。
* 如找不到“速宸立信 团队”或“面试点”地图，本任务返回 `failed`，需要确认钉图协作权限。
* 如钉图上传校验失败，只记录原因和截图，不在本任务修改 Task 003 模板字段。

### 下一步

1. 如需完成真实上传闭环，在已打开的 Playwright 浏览器中手动登录钉图，然后回 Dashboard 点击“继续上传”。
2. 登录后若钉图返回成功提示，记录 `success`；若无可靠提示，保持 `unknown` 并人工确认钉图侧结果。
3. PR 前再次运行敏感文件检查，确认 `.env`、数据库、导出文件、截图和 browser profile 未被跟踪。

## 任务卡 006-C：平台选择与导入限制修复

### 当前状态

已在 `codex/task-006-dingmap-auto-upload` 分支继续完善 Task 006 自动上传参数层。本轮不重复向钉图真实提交，不接优招 / 捷聘，不修改 Task 003 钉图模板字段或 Excel 模板字段。

### 已完成

* 新增集中平台配置 `packages/browser-controller/dingmap-platforms.ts`。
* Dashboard 自动上传区域新增“选择平台”下拉，默认“面试点”，显示中文平台名。
* 上传 API 接收 `platform`，缺省平台为 `mianshi / 面试点`，非法 key 会先于文件读取返回清晰错误。
* `GET /api/dingmap/upload/status` 返回 `platformOptions`，供 Dashboard 下拉复用。
* 平台到图层映射已集中维护：其他点、商超点、淘宝点、美团点、买菜点、面试点。
* 平台到标记颜色映射已集中维护：其他点=橙色，商超点=紫色，淘宝点=蓝色，美团点=黄色，买菜点=绿色，面试点=红色。
* 标记大小固定为“小”，坐标类型固定为“火星坐标（高德/腾讯/谷歌）”。
* 浏览器自动化从左侧图层列表按所选平台图层找“更多”，不再固定第一个图层。
* 颜色 nth fallback 集中在 selector / platform config 中，流程代码不散落 nth 选择器。
* 上传前读取导出 Excel 的数据行数；2000 行数据允许，2001 行数据返回 `blocked / row-limit`，且不打开钉图、不上传、不点击导入。
* 上传 job / Dashboard 状态新增平台、图层、标记样式、标记大小、坐标类型、数据行数和 stage 展示。
* `sync_logs` 继续记录上传结果，新增平台、图层、颜色、大小、stage 等摘要，不记录 cookie、token、账号、真实导出行内容。
* 提交导入后不主动关闭 Playwright 浏览器窗口；`unknown` 仍保持人工确认语义，不伪造成 `success`。
* 减少无意义轮询等待：文件选择确认轮询缩短为 200ms，结果等待轮询缩短为 500ms，仍以 locator / selector 状态为准。

### 新增 / 更新测试

* `packages/browser-controller/dingmap-platforms.test.ts`
* `packages/browser-controller/dingmap-selectors.test.ts`
* `packages/dingmap/read-export-row-count.test.ts`
* `apps/dashboard/app/api/dingmap/upload/dingmap-upload-routes.test.ts`

覆盖内容：

* 平台选项顺序和 key 校验。
* 平台到图层、颜色、大小、坐标类型映射。
* 图层“更多” selector 和颜色 nth fallback 集中维护。
* API status 返回 `platformOptions`。
* API 无效 `platform` 优先拒绝。
* Excel 表头 + 2000 数据行允许。
* Excel 表头 + 2001 数据行阻止上传并返回 `blocked / row-limit`。
* 路径穿越、缺少 continue job 等既有防护保持有效。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| `corepack pnpm run verify` | 成功 | check + lint + test 全部通过；21 个测试文件、83 个测试通过 |

### 当前风险

* 钉图外部页面 selector 仍可能变化，变化时应返回 `blocked` 并保存本地截图。
* 真实钉图上传仍可能遇到登录、验证码、人机验证、权限不足或页面结构变化，本任务不绕过这些限制。
* 2000 行以上当前只阻止并提示分批导入，不做自动分批。

## 任务卡 006-D：钉图模板字段映射与导出命名修复

### 当前状态

已按用户提供的真实钉图导入模板首行字段修正导出映射。本轮只改 Clean Table -> 钉图模板导出和文件命名，不改钉图真实上传主流程，不改平台到图层/颜色映射，不改 2000 行限制。

### 字段映射

| 钉图模板字段 | 系统来源 |
| --- | --- |
| 标记名称 | `siteName` |
| 详细地址 | `address` |
| 经度 | `longitude` |
| 纬度 | `latitude` |
| 备注 | `salary` |
| 字段一 | `stationManager` + `phone`，格式为“联系人：...；电话：...” |
| 字段二 | `remark` |

注意：

* 模板表头固定为：标记名称、详细地址、经度、纬度、备注、字段一、字段二。
* 钉图模板“备注”列写薪资，不再写系统同步描述。
* 钉图模板“字段二”写系统业务备注，不再 fallback 到 `interviewTime`。
* 字段一为空时保持空字符串，不写入 `undefined`、`null` 或 `-`。

### 导出命名

* Dashboard “钉图模板导出”区域新增“导出名称”输入框。
* 导出 API 接收当前平台和导出名称。
* 新文件名格式为 `dingmap-import-{平台中文名}-{用户导出名称}-{timestamp}.xlsx`。
* 用户未填写导出名称时，文件名仍带平台中文名，例如 `dingmap-import-面试点-YYYYMMDD-HHmmss.xlsx`。
* Windows 文件名非法字符 `\ / : * ? " < > |` 会被替换/清理，最终仍只写入 `data/exports/`。
* 最近导出文件列表兼容旧时间戳文件名和新可读文件名。

### 新增 / 更新测试

* 更新 `packages/dingmap/export-template.test.ts`，覆盖真实模板字段顺序和新映射。
* 更新 `packages/dingmap/one-click-export.test.ts`，覆盖平台/导出名称文件名、非法字符清理、空导出名称。
* 更新 `packages/db/dingmap-export.test.ts`，覆盖新旧导出文件名安全校验和最近导出列表兼容。

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| `corepack pnpm run verify` | 成功 | check + lint + test 全部通过；21 个测试文件、86 个测试通过 |

### 当前风险

* 真实钉图模板文件只作为字段参考，未保存到项目或 Git。
* 旧导出文件仍可被下拉识别；如用户要按平台快速识别，需要重新导出生成新命名文件。

## 任务卡 006-E：钉图验收问题集中修复

### 当前状态

已完成钉图自动上传验收修复。本轮只修验收问题：目标图层“更多”锚点、中文文件名下载、识别预览字段、无坐标异常规则、钉图模板字段一格式统一。不做真实重复提交，不改平台颜色映射、2000 行限制或 `unknown` 状态逻辑。

### 修复内容

* 图层定位：自动化只使用目标图层名称生成 scoped locator，先定位目标图层卡片，再点击卡片内部“更多”；移除全局 `button:has-text('更多')` 兜底。
* 滚动查找：点击候选 locator 前执行 `scrollIntoViewIfNeeded`，目标图层不可见时可先滚动到位。
* 图层缺失：找不到目标图层时返回 `blocked / layer-not-found`，提示确认当前地图“面试点”的左侧图层列表中存在该图层。
* 中文下载：下载路由解码 URL filename，继续通过 basename / realpath / `data/exports/` 校验；响应头使用 `filename="dingmap-import.xlsx"` + `filename*=UTF-8''...`，并补充 `Content-Length`。
* 识别预览：字段调整为“行号、来源、站点名称、站点地址、联系人、薪资待遇、福利待遇、交付条件、原始文本、状态、错误 / 警告”。
* 联系人列：联系人与电话合并为 `联系人 电话`，无独立电话列，不输出 `undefined` / `null` / `-`。
* 异常规则：无经纬度但有站点地址的 Clean Marker 视为正常；无地址且无完整坐标才标记 `missing_coordinates`。
* 模板映射：表头仍固定为“标记名称、详细地址、经度、纬度、备注、字段一、字段二”；“备注”写薪资待遇，“字段一”写联系人 + 电话简洁格式，“字段二”写交付条件。

### 新增 / 更新测试

* `packages/browser-controller/dingmap-selectors.test.ts`
* `apps/dashboard/app/api/dingmap/download/dingmap-download-route.test.ts`
* `apps/dashboard/app/dashboard-preview-fields.test.ts`
* `packages/db/clean-marker-management.test.ts`
* `packages/dingmap/export-template.test.ts`
* `packages/dingmap/one-click-export.test.ts`

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| `corepack pnpm run check` | 成功 | TypeScript 检查通过 |
| `corepack pnpm run lint` | 成功 | ESLint 通过 |
| `corepack pnpm run test` | 成功 | 23 个测试文件、95 个测试通过 |
| `corepack pnpm run verify` | 成功 | check + lint + test 全部通过；23 个测试文件、95 个测试通过 |

### 当前风险

* 钉图真实页面 DOM 仍可能变化；当前策略是 scoped 文本锚点 + 滚动，失败时返回 `blocked` 并保留 stage。
* 本轮未新增 debug / inspector 脚本；如后续真实页面仍变动，可补本地定位脚本。
* 未做真实钉图重复提交，避免误写线上数据。

## 任务卡 006-F：自动化 Chrome 统一与人工辅助定位

### 当前状态

已按验收反馈新增人工辅助定位模式。Dashboard 上传入口默认进入人工辅助流程，每个关键步骤暂停并提示用户在自动化 Chrome 中手动点击；点击完成后再点 Dashboard “继续上传”，系统读取当前页面结构、DOM 摘要、候选元素和截图，再推进下一步。

### 修复内容

* 文件命名改为短中文格式：`平台-导出名称-M.D-HH.mm.xlsx`，空导出名使用“未命名”。
* 旧 `dingmap-import-...` 文件名继续兼容下载、最近导出列表和上传选择。
* “打开钉图”不再使用普通外链，改为调用 `/api/dingmap/open`，统一打开自动化 Chrome。
* Playwright 持久化浏览器优先使用 `channel: "chrome"`，profile 仍为 `data/browser-profile/dingmap/`。
* 自动化浏览器不再在 success / failed / blocked / timeout / unknown 路径自动关闭。
* 新增 `manual_assist` 暂停态，继续接口支持 `requires_login` 和 `manual_assist`。
* 人工辅助步骤：确认登录和地图、查找图层、点击图层“更多”、点击“数据导入”、确认“新增数据”、确认坐标和样式、选择文件、点击导入、读取结果。
* 每次继续后保存截图到 `data/screenshots/dingmap-upload/`，DOM/候选元素摘要到 `data/debug/dingmap-upload/`，两个目录均不进 Git。
* Dashboard 状态阶段改为中文映射，不再直接展示英文 stage；长文件名截断并保留 title。

### 新增 / 更新测试

* `packages/browser-controller/dingmap-assisted-locator.test.ts`
* `packages/browser-controller/dingmap-upload-safety.test.ts`
* `apps/dashboard/app/dashboard-dingmap-upload-ui.test.ts`
* `packages/dingmap/one-click-export.test.ts`
* `packages/db/dingmap-export.test.ts`

### 命令验证

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| `corepack pnpm run check` | 成功 | TypeScript 检查通过 |
| `corepack pnpm run lint` | 成功 | ESLint 通过 |
| `corepack pnpm run test` | 成功 | 26 个测试文件、102 个测试通过 |

### 当前风险

* 人工辅助模式会读取真实页面 DOM 摘要用于定位，但只写入 ignored 的本地 `data/debug/dingmap-upload/`。
* 本轮未做真实钉图导入提交；最后“导入”点击仍由用户在自动化 Chrome 中手动完成。
* 若系统未安装 Chrome channel，打开自动化 Chrome 时会报错，需要本机安装 Chrome 或后续增加 fallback。
