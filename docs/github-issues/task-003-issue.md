# [Task 003] Clean Table 导出钉图一键录入模板

Labels: `task`, `feature`, `dingmap-export`, `clean-table`, `priority-high`

## 背景

Task 001 / 001-D / 002 已完成，Dashboard 和 Clean Table 已可用。Task 003 作为后续所有数据源的标准输出层，将 Clean Table 数据导出为钉图真实一键导入模板。

## 目标

实现 Clean Table → 钉图一键导入模板 `.xlsx` 导出能力，字段映射集中配置，Dashboard 可触发导出并显示导出状态。

## 范围

* 从 `clean_markers` 读取已清洗数据。
* 按真实钉图模板字段导出 Excel。
* 新增 `packages/dingmap/export-template.ts` 保存字段配置和映射函数。
* 完善 `packages/dingmap/one-click-export.ts`。
* 新增 Dashboard 导出按钮和导出结果展示。
* 新增 API：`POST /api/dingmap/export`。
* 新增下载 API：`GET /api/dingmap/download/[filename]`。
* 复用 `sync_plan` / `sync_logs` 记录导出行为。
* 新增模板映射、Excel 生成、DB 导出编排测试。

## 真实模板字段

`Sheet1` 第 1 行字段：

1. 标记名称
2. 详细地址
3. 经度
4. 纬度
5. 备注
6. 字段一
7. 字段二

## 字段映射

| 钉图模板字段 | Clean Table 来源 / 逻辑 |
| --- | --- |
| 标记名称 | `siteName` |
| 详细地址 | `address` |
| 经度 | `longitude` |
| 纬度 | `latitude` |
| 备注 | `buildDingmapDescription(marker)` |
| 字段一 | `${stationManager ?? ""}${phone ?? ""}` |
| 字段二 | `remark.trim()` 优先，否则 `interviewTime.trim()`，否则空 |

## 不做范围

* 不做钉图真实上传。
* 不做钉图真实登录。
* 不做 Playwright 自动点击。
* 不接优招 / 捷聘采集。
* 不新增数据源。
* 不改数据库 schema。
* 不做定时同步任务。
* 不提交真实业务数据。
* 不提交原始钉图模板。
* 不提交真实样例数据。

## 验收标准

* Dashboard 有“导出钉图模板”按钮。
* 点击后可以生成 `.xlsx` 文件。
* 导出文件使用真实模板 7 列表头。
* 字段映射和 `字段二` fallback 规则正确。
* 描述字段包含 `【系统同步信息】` 和 `【人工备注】`。
* 导出文件名包含时间戳。
* 导出后页面显示文件名、导出条数、跳过条数和下载链接。
* 导出记录写入 `sync_plan` / `sync_logs`。
* 不新增 schema。
* 不提交原始模板、真实样例数据或 `data/exports`。

## 命令验证清单

* [x] corepack pnpm check
* [x] corepack pnpm lint
* [x] corepack pnpm test
* [x] corepack pnpm verify

## 跨设备继续开发说明

另一台电脑继续开发前：

1. git pull
2. corepack pnpm install
3. cp .env.example .env
4. corepack pnpm run setup
5. corepack pnpm dev
6. 查看本 Issue 和 `docs/dev-log.md`

## Started 评论草稿

Started:

* 开始 Task 003：Clean Table 导出钉图一键录入模板。
* 范围：真实模板 7 列字段配置、Excel 生成、Dashboard 导出按钮、API、`sync_plan` / `sync_logs` 记录。
* 不做：钉图真实上传、真实登录、Playwright 自动点击、优招 / 捷聘采集、新增数据源、schema 修改、真实业务数据提交。
* 预计验证命令：`corepack pnpm check`、`corepack pnpm lint`、`corepack pnpm test`、`corepack pnpm verify`。

## Done 评论草稿

Done:

* 已实现 Clean Table → 钉图真实一键导入模板 `.xlsx` 导出。
* 已新增 `packages/dingmap/export-template.ts`，集中保存 7 列表头和字段映射。
* 已按真实模板输出 `Sheet1`：标记名称、详细地址、经度、纬度、备注、字段一、字段二。
* `备注` 使用 `buildDingmapDescription(marker)`，包含 `【系统同步信息】` 和 `【人工备注】`。
* `字段一` 使用 `stationManager + phone`。
* `字段二` 使用 `remark.trim()` 优先，否则 `interviewTime.trim()`，否则空。
* 已新增 `packages/db/dingmap-export.ts`，默认导出 `sync_status = pending` 且 `sync_action = create / update` 的记录。
* 空站点名且空地址的记录会跳过。
* 导出文件写入 `data/exports/dingmap-import-YYYYMMDD-HHmmss.xlsx`。
* Dashboard 已新增“钉图模板导出”按钮、Loading、文件名、导出条数、跳过条数和下载链接。
* 已新增 `POST /api/dingmap/export` 和 `GET /api/dingmap/download/[filename]`。
* 导出行为已复用 `sync_plan` / `sync_logs` 记录，未新增 schema。
* `sync_logs.after_json` 仅记录非敏感摘要，不记录完整地址、手机号或导出行值。
* 已新增模板映射、Excel 生成、DB 导出编排测试。

验证命令：

* `corepack pnpm check`：通过。
* `corepack pnpm lint`：通过。
* `corepack pnpm test`：通过，8 个测试文件、25 个测试。
* `corepack pnpm verify`：通过，check + lint + test 全部通过；受当前沙箱路径限制影响，最终 verify 使用提升权限执行。

未完成项：

* 本任务不做钉图真实上传、登录或 Playwright 自动点击。
* 本任务不接优招 / 捷聘采集。
* 本任务不新增 schema。

风险：

* 仍需使用脱敏或本地测试数据生成文件后，手动上传到钉图确认线上模板兼容性。
* GitHub App 当前无法直接更新线上 Issue，如线上 Issue 已手动创建，请复制本 Done 草稿。

Commit:

* 设计提交：`ec1aa150c0ee6090fe66a3810590aac635fc6047`
* 功能提交：`07d65518947ee02f1e53db9485eb6d9f685c454c`

下一步：

* 用本地脱敏数据导出 `.xlsx` 并手动上传钉图验证。
* 如钉图字段含义需要微调，只改 `packages/dingmap/export-template.ts`。
