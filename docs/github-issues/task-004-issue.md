# [Task 004] 字段文本 / TSV / 带表头 Excel 导入 Clean Table

Labels: `task`, `feature`, `excel-import`, `clean-table`, `priority-high`

## 背景

Task 001 / 001-D / 002 / 003 已完成。Task 003 已提供 Clean Table → 钉图模板导出的标准输出层。Task 004 需要把字段文本、TSV 粘贴、带表头 Excel 三种入口统一导入 Clean Table，并继续复用 Task 003 导出能力。

## 目标

实现闭环：

```text
字段文本 / TSV / Excel
-> parser 转 raw rows
-> 公共 import pipeline
-> 预览 / 校验 / 去重
-> 服务端二次校验
-> 写入 raw_records + clean_markers
-> Dashboard 显示
-> Task 003 钉图模板导出
```

## 范围

* key-value 字段文本粘贴。
* TSV / 表格文本粘贴。
* 带表头 `.xlsx` Excel 导入。
* 中文字段别名映射。
* `valid` / `invalid` / `duplicate` / `update_candidate` 状态。
* 共享 preview / validation / dedupe / import / revalidate。
* 共享 DB import 服务。
* Excel preview / import API。
* Dashboard 双入口导入 UI。
* 复用 Task 003 导出钉图模板。

## 隐私和数据口径

* 手机号是运行时业务字段，允许进入 Clean Table、raw_records，并允许导出到钉图模板。
* 测试、文档、任务卡、Issue 草稿和 Git 样例不保存真实手机号或真实地址。
* 不提交真实 Excel、账号信息、Cookie、`.env`、`.auth`。
* 不提交 `data/*.db`、`data/uploads/`、`data/exports/`。

## 不做范围

* 不做 OCR / 图片识别。
* 不做无表头猜测。
* 不做多 Sheet 合并。
* 不支持 `.xls` / `.csv`。
* 不做钉图真实上传。
* 不做钉图登录。
* 不做 Playwright 自动操作。
* 不接优招 / 捷聘采集。
* 不改 Task 003 钉图 7 列模板。
* 不改数据库 schema。

## 验收标准

* Dashboard 可以生成字段文本 / TSV 预览。
* Dashboard 可以上传 `.xlsx` 并生成预览。
* 预览显示 `valid` / `invalid` / `duplicate` / `update_candidate`。
* valid 行可导入 Clean Table。
* duplicate / invalid 跳过。
* update_candidate 默认更新。
* Excel 行写入 `source = excel`、`originType = excel`。
* 字段文本 / TSV 行写入 `source = manual_paste`、`originType = manual_paste`。
* 导入后的 Clean Table 可以继续使用 Task 003 导出钉图模板。
* 不提交真实数据或 runtime data 目录。
* check / lint / test / verify 通过。

## Done 评论草稿

Done:

* 已新增 `packages/sources/import-pipeline/`，统一字段别名映射、校验、merge key、hash、preview summary。
* 已支持 key-value 字段文本粘贴，中文冒号和英文冒号均可解析，空行分隔多条记录。
* 已保留 TSV 粘贴能力，第一行作为表头。
* 已新增 `.xlsx` Excel 内存解析，默认首个 Sheet，可按 Sheet 名选择。
* Excel 已限制 5 MB、1000 行，空行会跳过。
* 已新增 `packages/db/import-clean-markers.ts`，导入时服务端从 raw rows 二次校验，不信任前端 status / mergeKey / currentHash。
* 已实现 `valid` 新增、`duplicate` 跳过、`invalid` 跳过、`update_candidate` 更新。
* Excel 导入写入 `source = excel`、`originType = excel`。
* 字段文本 / TSV 写入 `source = manual_paste`、`originType = manual_paste`。
* 已新增 `POST /api/excel/preview` 和 `POST /api/excel/import`。
* Dashboard 已新增“字段文本 / TSV 导入”和“Excel 导入”入口。
* Dashboard 保留 Task 003 “导出钉图模板”按钮。
* 已新增 import pipeline、manual paste、DB import、Excel parser、Excel API route 测试。
* 未改数据库 schema。
* 未改 Task 003 钉图 7 列模板。
* 未做钉图真实上传、登录或 Playwright 自动操作。

验证命令：

* `corepack pnpm run check`：通过。
* `corepack pnpm run lint`：通过。
* `corepack pnpm run test`：通过，12 个测试文件、46 个测试。
* `corepack pnpm run verify`：通过，check + lint + test 全部通过。
* Browser smoke：通过，Dashboard 双入口和导出区可见，控制台无 error。

Commit:

* 设计提交：`eb7eecd31011258b607872b6fcb6d7f7b7391a77`
* 扩展设计提交：`e9471cc8f655c7372f86e5bbf074d0b7e0590727`
* 实现计划提交：`fa2ac8f50a82a8cfd63cf654f8fdbed9a42bba6f`
* 功能提交：`60a9abad1ab607b3bf07e1c5931cfa004f88e202`

风险：

* 第一版只支持 `.xlsx` 第一行表头。
* Sheet 可选择但不合并。
* 当前未做真实钉图上传验证，导出仍停留在 Task 003 文件生成层。

下一步：

* 用脱敏或本地测试数据走一次字段文本 / TSV / Excel 导入，再导出钉图模板文件做人工验收。
* 若后续要接优招 / 捷聘，继续先入 Clean Table，再复用 Task 003 导出。
