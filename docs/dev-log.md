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

## 任务卡 007-A：优招网页 API 探测与小批量导入 Clean Table

### 当前状态

已完成 Task 007-A1 / A2 自动化实现。A1 提交为 `58e2f21`，提供优招 API probe / preview、字段映射和公共 import pipeline 接入。A2 改为 Playwright persistent context 人工登录方案，解决 `hr.qingz.xyz` Cookie 不会自动发送给 localhost Dashboard API 的问题。

### 已完成

* 新增 `packages/sources/youzhao/`，负责优招 API 参数、响应结构、字段映射和业务线目标图层统计。
* 公共 import pipeline 支持 `source = youzhao`、`originType = web`。
* 新增 `packages/browser-controller/youzhao-session.ts`，使用 `data/browser-profile/youzhao/` 打开 persistent context 登录窗口。
* 新增 `packages/db/youzhao-import.ts`，`preview` / `import` 均服务端重新采集，`import` 只接收采集参数并调用 `importCleanMarkers()`。
* 新增 API：
  * `POST /api/youzhao/session/open`
  * `GET /api/youzhao/session/check`
  * `POST /api/youzhao/probe`
  * `POST /api/youzhao/preview`
  * `POST /api/youzhao/import`
* Dashboard 新增“优招采集”面板：登录、检查、单城市参数、探测、预览、导入、结果摘要和目标图层统计。
* Preview 表新增目标图层显示。
* 对 `source = youzhao` 的 Task 003 导出内容做专属映射，七列表头不变。

### 隐私和边界

* 不要求用户复制 cookie / token。
* 不保存账号、密码、cookie、token、localStorage、sessionStorage。
* `data/browser-profile/`、`data/youzhao/`、`data/temp/`、`*.har` 已由 `.gitignore` 覆盖。
* 未执行全量抓取，未提交真实优招响应、截图、HAR、DB 或导出文件。

### 不做范围确认

* 不跑完整 9858 条。
* 不遍历多个城市。
* 不做小程序采集。
* 不做高并发或定时任务。
* 不绕过验证码或风控。
* 不自动上传钉图。
* 不做按城市 / 图层拆分 Excel，该项留到 A3。

### 新增 / 更新测试

* `packages/browser-controller/youzhao-session.test.ts`
* `packages/db/youzhao-import.test.ts`
* `apps/dashboard/app/api/youzhao/youzhao-routes.test.ts`
* `packages/sources/youzhao/client.test.ts`
* `packages/sources/youzhao/mapper.test.ts`
* `packages/dingmap/export-template.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/sources/import-pipeline/preview.test.ts`

### 当前风险

* 真实 smoke 需要用户在优招窗口手动登录后执行；当前自动化测试使用合成响应。
* 优招接口真实 schema 若变化，会返回 `schema_changed`，需要按实际响应更新 mapper。
* A2 不做 A3 的城市 / 图层拆分 Excel。

## 任务卡 007-B：单城市采集任务与 smoke 保护

### 当前状态

已实现优招单城市采集任务编排能力。Task 007-B 只允许真实执行杭州 smoke，固定最多 2 页 / 40 条；杭州 full run 必须等待本阶段完成、提交、推送并输出报告后，由用户再次明确批准。

### 已完成

* 新增 `packages/db/youzhao-collection-task.ts`。
* 新增 `mode = smoke | full`。
* `smoke` 固定 `pageSize = 20`、`maxPages = 2`、`maxItems = 40`，完成状态为 `smoke_completed`。
* `full` 必须二次确认并提供 API total，未确认时拒绝启动。
* 新增任务状态：`idle`、`running`、`paused`、`completed`、`smoke_completed`、`failed`、`requires_login`、`forbidden`、`blocked`、`schema_changed`、`timeout`、`cancelled`、`count_mismatch`。
* 每页复用公共 pipeline 和 `importCleanMarkers()`，并使用 `updateCandidates: "skip"`，不自动覆盖 update_candidate。
* pause / cancel 在当前页请求、mapper、DB import、checkpoint 写入完成后生效。
* resume 前重新执行 session check，非 authenticated 不推进页码。
* checkpoint 写入 `data/youzhao/checkpoints/<safe-city>.json`，仅保存 `processedSourceIdHashes`，不保存原始 sourceId 或业务字段。
* current task state 写入同一 ignored 目录，仅保存脱敏状态和计数，供 Dashboard 刷新后读取。
* `failedPages` 仅保存 page / attempts / status。
* 重试间隔为 1s / 3s / 8s，测试通过 injectable sleep 避免真实等待。
* 新增 tasks API：start / pause / resume / cancel / restart / current。
* tasks API 响应不返回 rows、rawRows、cleanMarkers、业务字段、cookie 或 token。
* Dashboard 增加单城市任务控制区。
* A3 导出复用增加 `partial` 标记，smoke 导出文件名包含 `部分数据`。

### 不做范围确认

* 不执行杭州 full run。
* 不自动遍历城市。
* 不保存真实响应 JSON / HAR / HTML / 截图。
* 不提交 DB、导出文件、browser profile、cookie 或 token。
* 不自动上传钉图。

### 当前验证

* 相关单元测试和 API route 测试已通过。
* `corepack pnpm check` 已通过。
* 完整 `check / lint / test / verify` 待最终收口执行。

### 当前风险

* 真实 smoke 会写入本地 Clean Table，最多 40 条，数据不得提交到 Git。
* full 能力已受确认保护，但实际杭州 full 尚未执行。
* 是否已执行杭州全量：否。
