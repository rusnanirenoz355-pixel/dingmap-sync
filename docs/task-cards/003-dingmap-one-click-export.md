# 任务卡 003：钉图一键录入模板导出

## GitHub Issue

* Issue 标题：`[Task 003] Clean Table 导出钉图一键录入模板`
* Issue 编号：线上 Issue 如已手动创建，请以线上为准
* Issue 链接：`docs/github-issues/task-003-issue.md`
* Labels：`task`, `feature`, `dingmap-export`, `clean-table`, `priority-high`

## 任务目标

实现 Clean Table 到钉图真实一键导入模板的标准输出层。后续杂乱 Excel、优招、捷聘等数据源只要进入 Clean Table，就复用本导出层生成钉图导入文件。

## 真实模板字段

钉图模板 `Sheet1` 第 1 行字段固定为：

1. 标记名称
2. 详细地址
3. 经度
4. 纬度
5. 备注
6. 字段一
7. 字段二

项目内只保存字段配置和映射函数，不保存原始模板文件，不保存真实样例数据。

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

## 已完成

1. 新增 `packages/dingmap/export-template.ts`，集中配置真实模板字段和映射函数。
2. 完善 `packages/dingmap/one-click-export.ts`，生成 `Sheet1` 和真实 7 列表头。
3. 新增 `packages/db/dingmap-export.ts`，从 Clean Table 读取可导出记录并写入 Excel。
4. 默认导出 `sync_status = pending` 且 `sync_action = create / update` 的记录。
5. 空站点名且空地址的记录跳过。
6. 导出文件写入 `data/exports/dingmap-import-YYYYMMDD-HHmmss.xlsx`。
7. 导出行为写入 `sync_plan` 和 `sync_logs`，不新增 schema。
8. `sync_logs.after_json` 只保存非敏感导出摘要，不保存完整地址、手机号或导出行值。
9. 新增 Dashboard “钉图模板导出”区域，显示导出按钮、Loading、文件名、导出条数、跳过条数和下载链接。
10. 新增导出 API 和下载 API。
11. 新增模板映射、Excel 生成、DB 导出编排测试。

## 不做范围

1. 不做钉图真实上传。
2. 不做钉图真实登录。
3. 不做 Playwright 自动点击。
4. 不接优招 / 捷聘采集。
5. 不新增数据源。
6. 不改数据库 schema。
7. 不做定时同步任务。
8. 不提交真实业务数据。
9. 不提交原始钉图模板。
10. 不提交真实样例数据。

## 涉及模块

* `packages/dingmap/export-template.ts`
* `packages/dingmap/one-click-export.ts`
* `packages/db/dingmap-export.ts`
* `apps/dashboard/app/api/dingmap/export/route.ts`
* `apps/dashboard/app/api/dingmap/download/[filename]/route.ts`
* `apps/dashboard/app/page.tsx`
* `docs/dev-log.md`
* `docs/github-issues/task-003-issue.md`

## 验收标准

1. Dashboard 有“导出钉图模板”按钮。
2. 点击后可以生成 `.xlsx` 文件。
3. 导出文件使用真实模板 7 列表头。
4. 字段映射和 `字段二` fallback 规则正确。
5. 描述字段包含 `【系统同步信息】` 和 `【人工备注】`。
6. 导出文件名包含时间戳。
7. 导出后页面显示文件名、导出条数、跳过条数和下载链接。
8. 导出记录写入 `sync_plan` / `sync_logs`。
9. 不新增 schema。
10. 不提交原始模板、真实样例数据或 `data/exports`。

## 命令验证清单

* [x] corepack pnpm check
* [x] corepack pnpm lint
* [x] corepack pnpm test
* [x] corepack pnpm verify

## 验证结果

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm check | 成功 | TypeScript 检查通过 |
| corepack pnpm lint | 成功 | ESLint 通过 |
| corepack pnpm test | 成功 | 8 个测试文件、25 个测试通过 |
| corepack pnpm verify | 成功 | check + lint + test 全部通过；受当前沙箱路径限制影响，最终 verify 使用提升权限执行 |

## 关联文档

* `docs/dev-log.md`
* `docs/github-issues/task-003-issue.md`
* `docs/superpowers/specs/2026-06-08-task-003-dingmap-export-design.md`
* `docs/superpowers/plans/2026-06-08-task-003-dingmap-export.md`

## 跨设备继续开发说明

另一台电脑继续开发前：

1. git pull
2. corepack pnpm install
3. cp .env.example .env
4. corepack pnpm run setup
5. corepack pnpm dev
6. 查看本 Issue 和 `docs/dev-log.md`

## 当前状态

* Task 003-A 已实现并完成验证。
* GitHub App 当前无法直接更新线上 Issue；本地草稿已生成。
* 功能提交：`07d65518947ee02f1e53db9485eb6d9f685c454c`

## 任务卡自查

1. 是否只做 Clean Table → 钉图模板导出：是。
2. 是否字段映射和 fallback 正确：是。
3. 是否生成 Excel 文件并按时间戳命名：是。
4. 是否过滤空站点名 + 空地址行：是。
5. 是否不提交 `data/exports`：是。
6. 是否更新 dev-log：是。
7. 是否更新 GitHub Issue 或草稿：是，已生成草稿。
8. 是否运行 check / lint / test / verify：是。
9. 是否未提交敏感文件：提交前继续检查。
10. 是否输出完成报告：最终回复输出。
