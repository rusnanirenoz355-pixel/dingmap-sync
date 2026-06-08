# 任务卡 004：字段文本 / TSV / 带表头 Excel 导入 Clean Table

## GitHub Issue

* Issue 标题：`[Task 004] 字段文本 / TSV / 带表头 Excel 导入 Clean Table`
* Issue 编号：线上 Issue 如已手动创建，请以线上为准
* Issue 链接：`docs/github-issues/task-004-issue.md`
* Labels：`task`, `feature`, `excel-import`, `clean-table`, `priority-high`

## 任务目标

实现字段名文本、TSV 粘贴、带表头 `.xlsx` 三种入口进入 Clean Table，并复用 Task 003 钉图模板导出。所有入口只负责解析到 raw rows，预览、校验、去重、导入、服务端二次校验统一走公共导入管线。

## 已完成

1. 新增 `packages/sources/import-pipeline/`，集中处理字段别名映射、手机号规范化、校验、merge key、hash、preview summary。
2. `manual_paste` 保留原公开函数名，内部改为 key-value / TSV parser + 公共 pipeline。
3. 支持 key-value 字段文本，中文冒号和英文冒号均可解析，空行分隔多条记录。
4. 支持 TSV 粘贴，第一行作为表头，复用 Task 002 表头识别和校验规则。
5. 新增 `packages/sources/excel-import/`，支持内存解析 `.xlsx`，默认首个 Sheet，可按 Sheet 名选择。
6. Excel 限制：文件不超过 5 MB，数据行不超过 1000 行，空行跳过。
7. 新增 `packages/db/import-clean-markers.ts`，共享 DB 导入服务会从 raw rows 服务端二次 preview，不信任前端传回的 status / mergeKey / currentHash。
8. `valid` 新增，`duplicate` 跳过，`invalid` 跳过，`update_candidate` 默认按 merge key 更新。
9. Excel 导入写入 `source = excel`、`originType = excel`。
10. 字段文本 / TSV 写入 `source = manual_paste`、`originType = manual_paste`。
11. 新增 `POST /api/excel/preview` 和 `POST /api/excel/import`。
12. Dashboard 新增“字段文本 / TSV 导入”和“Excel 导入”两块入口，并保留 Task 003 “导出钉图模板”按钮。
13. `vitest.config.ts` 增加 `apps/**/*.test.ts`，覆盖 Dashboard API route 测试。
14. 测试文件不写完整业务手机号字面量，运行时用拼接方式生成合成手机号。

## 隐私和数据口径

* 手机号是业务字段，运行时允许导入 `clean_markers`、`raw_records`，并允许导出到钉图模板。
* 真实手机号、真实地址不写入测试文件、任务卡示例、Issue 草稿、文档样例或 Git 提交样例。
* 不提交真实 Excel、Cookie、账号信息、`.env`、`.auth`。
* 不提交 `data/*.db`、`data/uploads/`、`data/exports/`。

## 不做范围

1. 不做 OCR / 图片识别。
2. 不做无表头猜测。
3. 不做多 Sheet 合并。
4. 不支持 `.xls` / `.csv`。
5. 不做钉图真实上传。
6. 不做钉图登录。
7. 不做 Playwright 自动操作。
8. 不接优招 / 捷聘采集。
9. 不修改 Task 003 钉图 7 列模板字段。
10. 不改数据库 schema。

## 涉及模块

* `packages/sources/import-pipeline/`
* `packages/sources/manual-paste/parser.ts`
* `packages/sources/manual-paste/mapper.ts`
* `packages/sources/excel-import/`
* `packages/db/import-clean-markers.ts`
* `packages/db/manual-paste.ts`
* `packages/db/excel-import.ts`
* `apps/dashboard/app/api/excel/preview/route.ts`
* `apps/dashboard/app/api/excel/import/route.ts`
* `apps/dashboard/app/page.tsx`
* `vitest.config.ts`

## 新增 / 更新测试

* `packages/sources/import-pipeline/preview.test.ts`
* `packages/sources/manual-paste/parser.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/sources/excel-import/parser.test.ts`
* `apps/dashboard/app/api/excel/excel-routes.test.ts`
* `packages/normalizer/build-marker-hash.test.ts`
* `packages/normalizer/normalize-phone.test.ts`

覆盖内容：

* key-value 字段文本解析。
* TSV 表头解析兼容。
* 中文字段别名映射。
* 空行跳过。
* 未识别字段保留在 `raw`。
* 手机号规范化。
* `valid` / `invalid` / `duplicate` / `update_candidate`。
* DB insert / update / skip / revalidate。
* Excel `.xlsx` 内存解析、Sheet 选择、5 MB 限制、1000 行限制。
* Excel API preview / import。
* Excel 导入后仍可被 Task 003 export 过滤器选中。

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
| corepack pnpm run test | 成功 | 12 个测试文件、46 个测试通过 |
| corepack pnpm run verify | 成功 | check + lint + test 全部通过 |
| Browser smoke | 成功 | Dashboard 可见字段文本 / TSV、Excel 导入、钉图导出、Clean Table，控制台无 error |

## 提交记录

* 设计提交：`eb7eecd31011258b607872b6fcb6d7f7b7391a77`
* 扩展设计提交：`e9471cc8f655c7372f86e5bbf074d0b7e0590727`
* 实现计划提交：`fa2ac8f50a82a8cfd63cf654f8fdbed9a42bba6f`
* 功能提交：`60a9abad1ab607b3bf07e1c5931cfa004f88e202`

## 当前状态

* Task 004-A 已实现并完成验证。
* GitHub App 当前未直接创建或更新线上 Issue；本地草稿已生成。
* 数据库 schema 未改动。
* Task 003 导出逻辑未改动。

## 任务卡自查

1. 是否只做字段文本 / TSV / 带表头 Excel 导入 Clean Table：是。
2. 是否没有做 OCR / 图片识别：是。
3. 是否没有做无表头猜测：是。
4. 是否没有多 Sheet 合并：是。
5. 是否复用 Task 002 清洗规则：是，已抽为共享 import pipeline。
6. 是否抽出共享 DB import 服务：是。
7. 是否 import API 服务端二次校验：是。
8. 是否 update_candidate 默认更新：是。
9. 是否 Excel source = excel，manual paste source = manual_paste：是。
10. 是否复用 Task 003 钉图模板导出：是。
11. 是否先预览，再入库：是。
12. 是否先校验，再导入：是。
13. 是否处理 duplicate / invalid / update_candidate：是。
14. 是否避免提交真实数据：是，提交前继续检查。
15. 是否更新 docs/dev-log.md：是。
16. 是否更新 GitHub Issue 或本地草稿：是，已生成本地草稿。
17. 是否运行 check / lint / test / verify：是。
18. 是否输出完成报告：最终回复输出。
