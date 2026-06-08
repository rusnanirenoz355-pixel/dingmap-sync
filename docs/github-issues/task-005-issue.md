# [Task 005] Clean Table 已导入数据管理与软删除

Labels: `task`, `feature`, `clean-table`, `data-management`, `priority-high`

## 背景

Task 004 已支持字段文本、TSV 和带表头 Excel 导入 Clean Table。导入后需要一个管理层处理名称、地址、坐标、备注、重复和异常等问题，并保证不需要导出的数据可以通过软删除排除。

## 目标

实现闭环：

```text
字段文本 / TSV / Excel 导入
-> Clean Table
-> 已导入数据管理
-> 查询 / 筛选 / 编辑 / 异常识别 / 软删除
-> Dashboard 统计同步
-> Task 003 钉图模板导出排除软删除
```

## 范围

* Dashboard 新增已导入数据管理入口。
* 独立 `/data-management` 页面。
* 管理列表、搜索、来源筛选、异常筛选、已删除筛选、分页。
* 单条业务字段编辑。
* 服务端重算 `mergeKey` / `currentHash`。
* 软删除 `deleted_at`。
* 异常识别：缺坐标、坐标非法、error_msg 非空、疑似重复。
* 长文本摘要展示和 Drawer 查看全文。
* 默认统计、Clean Table 默认列表、Task 003 导出排除软删除。

## 隐私和数据口径

* 手机号和地址是运行时业务字段，允许进入 Clean Table、raw_records、管理页和钉图导出模板。
* 测试、文档、任务卡、Issue 草稿和 Git 样例不保存真实手机号或真实地址。
* 不提交真实 Excel、账号信息、Cookie、`.env`、`.auth`。
* 不提交 `data/*.db`、`data/uploads/`、`data/exports/`。

## 不做范围

* 不做 `import_batch_id`。
* 不做恢复按钮。
* 不做硬删除。
* 不删除 `raw_records`。
* 不做地图渲染。
* 不做钉图真实上传 / 登录。
* 不做 Playwright。
* 不做 OCR。
* 不接优招 / 捷聘。
* 不改 Task 003 钉图模板 7 列字段。
* 不做批量编辑 / 批量删除。

## 验收标准

* Dashboard 可进入 `/data-management`。
* 管理页默认列出有效 Clean Table 数据。
* 支持名称 / 地址搜索。
* 支持来源筛选。
* 支持只看异常、包含已删除、只看已删除。
* 可编辑业务字段。
* source / originType / sourceId / createdAt / updatedAt / deletedAt 只读。
* 编辑后重算 `mergeKey` / `currentHash`。
* 编辑后 `syncAction = update`、`syncStatus = pending`。
* 可软删除数据。
* 软删除后默认列表、统计、Task 003 导出均排除。
* 异常识别清楚。
* 长文本不会撑爆表格，Drawer 可查看全文。
* check / lint / test / verify 通过。

## Done 评论草稿

Done:

* 已基于 Task 004 分支成果继续开发，创建 `codex/task-005-imported-data-management` 分支。
* 已新增 `deleted_at TEXT`，fresh schema 和老库 migration 均支持。
* 未新增 `import_batch_id`。
* 已新增 `packages/db/clean-marker-management.ts`，集中处理 list / statistics / edit / softDelete / anomaly。
* 默认 Clean Table 列表排除软删除数据。
* Dashboard 统计排除软删除数据。
* Task 003 导出 SQL 和 `filterExportableMarkers` 排除软删除数据。
* 已新增 `GET /api/clean-markers/manage`。
* 已新增 `PATCH /api/clean-markers/[id]`。
* 已新增 `DELETE /api/clean-markers/[id]`。
* 已新增 `/data-management` 页面。
* Dashboard 已新增“管理已导入数据”入口。
* 编辑保存后服务端重算 `mergeKey` / `currentHash`。
* 编辑保存后设置 `manualOverride = true`、`syncAction = update`、`syncStatus = pending`。
* 软删除设置 `syncAction = archive`、`syncStatus = skipped`。
* 异常识别支持缺坐标、坐标非法、error_msg、疑似重复。
* 长文本摘要展示，Drawer 查看全文和编辑。
* 未做钉图上传、登录、Playwright、OCR、优招 / 捷聘、硬删除或批量操作。
* 未改 Task 003 钉图 7 列字段。

验证命令：

* `corepack pnpm run check`：通过。
* `corepack pnpm run lint`：通过。
* `corepack pnpm run test`：通过，16 个测试文件、63 个测试。
* `corepack pnpm run verify`：通过，check + lint + test 全部通过。
* HTTP smoke：通过，Dashboard 和 `/data-management` 返回 200。

Commit:

* 设计提交：`7df2573b965e191214324e3187e387ce54900eb2`
* 实现计划提交：`4fafbc521fa0aa8e342fcb35331e81af5b0a89f7`
* 功能提交：`d867d36d99e5b740e76d42d7184989f0b84cee85`

风险：

* 第一版不做恢复、批量编辑、批量删除、权限审计。
* 管理页展示运行时业务字段；测试和文档保持脱敏。
* 本轮 Browser 控制工具未暴露，使用 HTTP smoke 替代页面可达性验证。

下一步：

* 用脱敏数据人工验收导入、编辑、软删除、导出链路。
* 如需恢复已删除数据，单独开后续任务卡。
