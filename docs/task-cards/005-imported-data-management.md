# 任务卡 005：Clean Table 已导入数据管理与软删除

## GitHub Issue

* Issue 标题：`[Task 005] Clean Table 已导入数据管理与软删除`
* Issue 编号：线上 Issue 如已手动创建，请以线上为准
* Issue 链接：`docs/github-issues/task-005-issue.md`
* Labels：`task`, `feature`, `clean-table`, `data-management`, `priority-high`

## 任务目标

建立已导入数据管理闭环：

```text
字段文本 / TSV / Excel 导入
-> Clean Table
-> 查询 / 筛选 / 编辑 / 异常识别 / 软删除
-> Dashboard 统计同步
-> Task 003 钉图模板导出排除软删除
```

## 已完成

1. 在 Task 004 分支成果基础上继续开发，未从 `main` 重新开分支。
2. 新增 `deleted_at TEXT`，作为第一版唯一 schema 变更。
3. fresh schema 直接包含 `deleted_at`，老数据库通过幂等 migration 补列。
4. 未新增 `import_batch_id`。
5. 新增 `packages/db/clean-marker-management.ts`，集中管理查询、统计、编辑、软删除和异常识别。
6. 默认管理列表、Clean Table 默认列表和 Dashboard 统计排除软删除数据。
7. Task 003 DingMap 导出 SQL 和过滤函数排除软删除数据。
8. 编辑只允许业务字段：`siteName`、`address`、`longitude`、`latitude`、`stationManager`、`phone`、`salary`、`welfare`、`interviewTime`、`jobTitle`、`remark`。
9. 编辑保存后服务端重算 `mergeKey` / `currentHash`，并设置 `manualOverride = true`、`syncAction = update`、`syncStatus = pending`。
10. 软删除写入 `deleted_at`，并设置 `syncAction = archive`、`syncStatus = skipped`。
11. 新增 `GET /api/clean-markers/manage`。
12. 新增 `PATCH /api/clean-markers/[id]`。
13. 新增 `DELETE /api/clean-markers/[id]`。
14. 新增 `/data-management` 独立管理页。
15. Dashboard 新增“管理已导入数据”入口和有效 / 异常 / 已删除摘要。
16. 长文本摘要展示，Drawer 查看全文和编辑。
17. 异常状态从 Clean Table 当前数据派生，不沿用 import preview 状态。

## 隐私和数据口径

* 手机号是运行时业务字段，允许进入 Clean Table、raw_records，并允许导出到钉图模板。
* 测试、文档、任务卡、Issue 草稿和 Git 样例不保存真实手机号或真实地址。
* 不提交真实 Excel、账号信息、Cookie、`.env`、`.auth`。
* 不提交 `data/*.db`、`data/uploads/`、`data/exports/`。

## 不做范围

1. 不做 `import_batch_id`。
2. 不做恢复按钮。
3. 不做硬删除。
4. 不删除 `raw_records`。
5. 不做地图渲染。
6. 不做钉图真实上传 / 登录。
7. 不做 Playwright。
8. 不做 OCR / 图片识别。
9. 不接优招 / 捷聘采集。
10. 不改 Task 003 钉图 7 列模板字段。
11. 不做批量编辑 / 批量删除。
12. 不做权限系统或审计后台。

## 涉及模块

* `packages/db/schema.sql`
* `packages/db/migrate.ts`
* `packages/db/clean-marker-management.ts`
* `packages/db/import-clean-markers.ts`
* `packages/db/dingmap-export.ts`
* `packages/shared/marker.ts`
* `apps/dashboard/app/api/clean-markers/manage/route.ts`
* `apps/dashboard/app/api/clean-markers/[id]/route.ts`
* `apps/dashboard/app/data-management/page.tsx`
* `apps/dashboard/app/components/TruncatedText.tsx`
* `apps/dashboard/app/components/ManagementDrawer.tsx`
* `apps/dashboard/app/page.tsx`

## 新增 / 更新测试

* `packages/db/migrate.test.ts`
* `packages/db/clean-marker-management.test.ts`
* `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`
* `apps/dashboard/app/components/TruncatedText.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/db/dingmap-export.test.ts`

覆盖内容：

* `deleted_at` fresh schema 和幂等迁移。
* 默认列表排除软删除。
* includeDeleted / deletedOnly。
* search / source 筛选。
* 异常识别。
* 编辑字段白名单。
* 只读字段忽略。
* `mergeKey` / `currentHash` 重算。
* `manualOverride`、`syncAction`、`syncStatus` 更新。
* 软删除排除统计和 Task 003 导出。
* API list / edit / delete。
* 长文本摘要。

## 命令验证清单

* [x] corepack pnpm run check
* [x] corepack pnpm run lint
* [x] corepack pnpm run test
* [x] corepack pnpm run verify

## 验证结果

| 命令 | 状态 | 备注 |
| --- | --- | --- |
| corepack pnpm run check | 成功 | TypeScript 检查通过 |
| corepack pnpm run lint | 成功 | ESLint 通过 |
| corepack pnpm run test | 成功 | 16 个测试文件、63 个测试通过 |
| corepack pnpm run verify | 成功 | check + lint + test 全部通过 |
| HTTP smoke | 成功 | Dashboard 和 `/data-management` 返回 200 |

## 提交记录

* 设计提交：`7df2573b965e191214324e3187e387ce54900eb2`
* 实现计划提交：`4fafbc521fa0aa8e342fcb35331e81af5b0a89f7`
* 功能提交：`d867d36d99e5b740e76d42d7184989f0b84cee85`

## 当前状态

* Task 005-A 已实现并完成验证。
* GitHub App 当前未直接创建或更新线上 Issue；本地草稿已生成。
* 数据库 schema 只新增 `deleted_at`。
* Task 003 钉图模板 7 列字段未改动。

## 任务卡自查

1. 是否基于 Task 004 分支：是。
2. 是否只新增 `deleted_at`，不新增 `import_batch_id`：是。
3. 是否没有做硬删除：是。
4. 是否没有删除 `raw_records`：是。
5. 是否没有做地图渲染：是。
6. 是否没有做钉图上传 / 登录：是。
7. 是否没有做 Playwright：是。
8. 是否没有接优招 / 捷聘：是。
9. 是否没有改 Task 003 钉图模板字段：是。
10. 是否管理 SQL 集中在 `clean-marker-management.ts`：是。
11. 是否软删除排除默认统计：是。
12. 是否软删除排除 Clean Table 默认列表：是。
13. 是否软删除排除 Task 003 导出：是。
14. 是否编辑只允许业务字段：是。
15. 是否编辑后重算 `mergeKey` / `currentHash`：是。
16. 是否编辑后设置 `syncAction = update` / `syncStatus = pending`：是。
17. 是否异常识别是 Clean Table 派生状态：是。
18. 是否长文本不会撑爆表格：是。
19. 是否 Drawer 能查看全文：是。
20. 是否移动端或窄屏不做页面级硬撑宽：是，表格区域内部横向滚动。
21. 是否运行 check / lint / test / verify：是。
22. 是否避免提交敏感文件：是。
23. 是否更新 docs/dev-log.md、任务卡、Issue 草稿：是。
24. 是否输出完成报告：最终回复输出。
