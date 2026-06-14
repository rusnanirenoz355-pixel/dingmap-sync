# 任务卡 007：优招网页接口探测与小批量岗位采集 MVP

## GitHub Issue

* Issue 标题：`[Task 007] 优招网页 API 探测与小批量导入 Clean Table`
* Issue 草稿：`docs/github-issues/task-007-issue.md`
* Labels：`task`, `feature`, `youzhao`, `clean-table`, `priority-high`

## 当前阶段状态

当前分支仍为：

```text
codex/task-007-youzhao-collector
```

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| Task 007-A1 | 已完成 | 优招 API 探测和预览 |
| Task 007-A2 | 已完成 | 登录会话、字段映射和导入 |
| Task 007-A3 | 已完成 | 优招钉图 Excel 导出 |
| Task 007-B | 已完成 | smoke 任务及分页、暂停、恢复 |
| Task 007-C 初版 | 已完成 | 杭州 full、统一导出筛选 |
| Task 007-C 人工验收修复 | 已完成并推送 | commit `7d3dd680` |
| Task 007-D | 待执行 | 数量对账、分类修订、批量软删除 |
| PR / merge main | 未执行 | 当前仍在 Task 007 功能分支 |

## 目标

实现优招网页端第一版小批量采集闭环：

```text
Playwright persistent context 人工登录
-> 认证 context 请求优招岗位 API
-> 小批量采集 20-100 条
-> 转换为 youzhao raw rows
-> 复用公共 import pipeline
-> 写入 raw_records / clean_markers
-> Dashboard 和 /data-management 查看
-> 继续复用 Task 003 钉图模板导出
```

## 已完成

### A1：API Probe / Preview

* 扩展公共 import pipeline，支持 `source = youzhao`、`originType = web`。
* 新增 `packages/sources/youzhao/` client / mapper。
* 支持单城市参数校验：`city` 必填，`page >= 1`，`pageSize = 1..50`，`limit = 20..100`。
* 固定优招招聘中请求参数 `status = 1`。
* 字段映射：
  * 合作站点名称 -> `siteName`
  * 站点地址 -> `address`
  * 站长姓名 -> `stationManager`
  * 站长电话 -> `phone`
  * 岗位名称 -> `jobTitle`
  * 薪资方案 -> `salary`
  * 新人政策 -> `welfare`
  * 结算规则 -> `remark`
* `sourceId` 规则：
  * `siteId` 和 `jobId` 都有：`siteId:jobId`
  * 只有 `jobId`：`jobId`
  * 缺 `jobId`：invalid
* 同站点不同岗位保留为独立记录。
* 经纬度第一版固定为空，不阻止 preview / import / export。

### A2：人工登录 / 服务端重采集 / 导入 / Dashboard

* 新增 `packages/browser-controller/youzhao-session.ts`。
* 使用 Playwright persistent context 打开 `https://hr.qingz.xyz/push/records`。
* 本地 profile：`data/browser-profile/youzhao/`，已由 `.gitignore` 覆盖。
* 不保存账号、密码、cookie、token、localStorage、sessionStorage。
* 新增登录 API：
  * `POST /api/youzhao/session/open`
  * `GET /api/youzhao/session/check?city=...`
* `probe` / `preview` / `import` 默认使用认证 context。
* 新增 `POST /api/youzhao/import`，只接收采集参数，服务端重新采集、重新 preview、重新计算 `mergeKey/currentHash`，再调用 `importCleanMarkers()`。
* Dashboard 新增“优招采集”最小面板：
  * 打开优招登录
  * 检查登录状态
  * 城市 / 起始页 / 每页数量 / 采集数量
  * 探测接口
  * 生成预览
  * 导入 Clean Table
  * 结果摘要和目标图层统计
* Preview 表显示目标图层。
* Task 003 七列表头保持不变。
* 对 `source = youzhao` 的钉图导出映射：
  * 标记名称 = 合作站点名称
  * 详细地址 = 站点地址
  * 经度 / 纬度 = 空单元格
  * 备注 = 岗位名称 / 薪资方案 / 新人政策分段
  * 字段一 = 站长姓名 + 空格 + 站长电话
  * 字段二 = 结算规则

## 业务线目标图层

* 包含“美团” -> 美团点
* 包含“淘宝专送”或“淘宝UB” -> 淘宝点
* 包含“小象配送”或“叮咚” -> 买菜点
* 包含“分拣员” -> 其他点
* 其他全部 -> 商超点

## 优招钉图导出筛选组合

优招导出保留完整组合能力，城市范围和目标图层是两个独立筛选项：

* 城市范围：
  * 当前指定城市：`city = "<城市>"`
  * 全部城市：`city = "all"`
* 目标图层：
  * 全部图层：`targetLayer = "all"`
  * 单图层：`targetLayer = "美团点" | "淘宝点" | "买菜点" | "其他点" | "商超点"`
* 支持组合：
  * 单城市 + 单图层：只生成该城市该图层文件。
  * 单城市 + 全部图层：按该城市已有数据分图层生成文件，无数据图层不生成空文件。
  * 全部城市 + 单图层：将本地已采集城市的同一图层合并到同一个文件，不按城市拆分。
  * 全部城市 + 全部图层：本地已采集城市按目标图层分文件导出。
* `city = "all"` 只读取本地 Clean Table 中已采集数据，不请求优招接口，不自动遍历城市。
* 全部城市导出仅包含 `source = youzhao`、`originType = web`、`deleted_at IS NULL` 且 `raw.city` 非空的数据。
* `raw.city` 缺失的数据不导出，并在返回结构中统计 `missingCityExcluded`。
* 单城市匹配会标准化城市文本，兼容 raw 中带“市”后缀的城市值。
* 单个导出文件最多 2000 条，超过后按“第1批 / 第2批”拆分。
* 固定钉图七列表头保持不变，经度 / 纬度仍为空单元格。
* 合法筛选范围无数据时返回 `files = []`、`totalExported = 0`，不生成空 Excel。

## 不做范围

* 不跑完整 9858 条。
* 不遍历多个城市。
* 不做小程序采集。
* 不做高并发。
* 不绕过验证码或风控。
* 不保存账号密码 / cookie / token。
* 不提交真实采集结果、HAR、截图、DB 或导出文件。
* 不自动上传钉图。
* 不改 Task 003 七列表头。

## 9858 条全量方案

后续全量方案只作为设计，不在 Task 007-A 执行：

1. 仍使用 persistent context 的认证 API 请求。
2. 单城市逐批执行，禁止默认全国全量。
3. 推荐 `pageSize = 50`，每批 500-1000 条。
4. 增加 checkpoint：城市、页码、pageSize、已处理 sourceId、失败页。
5. 每页请求设置超时和最多 2-3 次重试。
6. 401 / 403 / 验证码 / schema_changed 立即停止。
7. 每批写入 raw cache 后再走公共 import pipeline。
8. 继续以 `sourceId` 和 `mergeKey` 处理 duplicate / update_candidate。
9. 钉图导出按城市范围和目标图层筛选，单文件最多 2000 条并自动拆批。

## 测试

新增或更新：

* `packages/browser-controller/youzhao-session.test.ts`
* `packages/db/youzhao-import.test.ts`
* `apps/dashboard/app/api/youzhao/youzhao-routes.test.ts`
* `packages/sources/youzhao/client.test.ts`
* `packages/sources/youzhao/mapper.test.ts`
* `packages/dingmap/export-template.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/sources/import-pipeline/preview.test.ts`

## 当前状态

* A1 commit：`58e2f21`
* A2 已完成代码与自动化测试。
* 真实优招 smoke 需要用户手动登录后执行；当前未提交任何真实优招数据。

## B：单城市全量采集能力与 smoke 保护

### 目标

实现单城市采集任务编排能力，但本阶段真实运行只允许：

```text
mode = smoke
city = 杭州
pageSize = 20
maxPages = 2
maxItems = 40
```

杭州 full run 必须等本阶段完成、提交、推送并输出报告后，由用户再次明确批准。

### 已完成

* 新增 `mode = smoke | full`。
* `smoke` 固定最多 2 页 / 40 条，完成后状态为 `smoke_completed`，不会自动切换 full。
* `full` 必须传入二次确认和 API 总数，未确认时服务端拒绝启动。
* 新增任务状态：`idle`、`running`、`paused`、`completed`、`smoke_completed`、`failed`、`requires_login`、`forbidden`、`blocked`、`schema_changed`、`timeout`、`cancelled`、`count_mismatch`。
* 每页继续复用 `importCleanMarkers()`，并通过 `updateCandidates: "skip"` 防止自动覆盖 update_candidate。
* `pause` / `cancel` 只在当前页 HTTP、mapper、DB import、checkpoint 写入完成后生效。
* `resume` 前重新执行 session check，只有 authenticated 才继续。
* checkpoint 写入 `data/youzhao/checkpoints/<encodeURIComponent(city)>.json`，仅保存 sourceId 的 SHA-256 hash，不保存原始 sourceId 或业务字段。
* current task state 写入同一 ignored 目录，仅保存脱敏状态和计数，供 `/api/youzhao/tasks/current` 跨 route bundle 读取。
* `failedPages` 只保存 `{ page, attempts, status }`，不保存响应体、header、cookie 或业务数据。
* 重试间隔为 1s / 3s / 8s，测试使用可注入 sleep，不真实等待。
* 新增 tasks API：
  * `POST /api/youzhao/tasks/start`
  * `POST /api/youzhao/tasks/pause`
  * `POST /api/youzhao/tasks/resume`
  * `POST /api/youzhao/tasks/cancel`
  * `POST /api/youzhao/tasks/restart`
  * `GET /api/youzhao/tasks/current`
* tasks API 响应不返回 rows、rawRows、cleanMarkers、完整业务字段、token 或 cookie。
* A3 导出复用增加 `partial` 文件名标记，smoke 导出文件名包含 `部分数据`，full 完成导出不包含该标记。
* Dashboard 增加单城市任务控制区和“部分数据导出”按钮。

### 计数规则

full 模式一致性检查：

```text
API 招聘中 total = imported + duplicate + update_candidate + invalid
```

`filteredNonRecruiting` 单独统计，不进入 full 一致性公式。`update_candidate` 不计为 imported 或 updated。

smoke 模式只检查：

```text
实际处理数量 = imported + duplicate + update_candidate + invalid
```

### 不做范围

* 不执行杭州 full run。
* 不自动遍历城市。
* 不写 JSON / HAR / HTML / 截图 / 真实响应日志。
* 不保存账号密码、cookie、token 或浏览器 profile 到 Git。
* 不自动上传钉图。
* 不覆盖 update_candidate。

### 测试补充

新增或更新：

* `packages/db/youzhao-collection-task.test.ts`
* `apps/dashboard/app/api/youzhao/youzhao-task-routes.test.ts`
* `apps/dashboard/app/dashboard-youzhao-ui.test.ts`
* `packages/db/import-clean-markers.test.ts`
* `packages/db/youzhao-dingmap-export.test.ts`
* `apps/dashboard/app/api/youzhao/youzhao-export-routes.test.ts`
* `apps/dashboard/app/dashboard-youzhao-ui.test.ts`

### 当前状态

* Task 007-B 已完成自动化测试和类型检查阶段。
* 真实 smoke 待最终验证阶段执行，最多 40 条。
* 是否已执行杭州全量：否。

## C：人工验收修复与导出管理收口

### 范围

* 优招钉图导出备注不再输出岗位名称，只保留薪资方案和新人政策。
* Dashboard 首页 Clean Table 使用独立滚动容器，支持横向和纵向内部滚动，表头 sticky。
* 优招导出城市下拉读取本地已入库城市，第一项为“全部城市”，不再使用“当前城市”作为导出选项。
* `/data-management` 删除面试时间的展示和编辑入口。
* 异常规则统一为名称或地址缺失才判异常，缺经纬度、电话、薪资、福利、岗位、备注和面试时间不再判异常。

### 验收

* 定向测试覆盖导出备注、城市列表、滚动容器、面试时间移除和异常规则。
* `corepack pnpm verify` 通过。
* 未重新采集优招，未运行其他城市，未执行钉图上传。
* 未提交 DB、导出 Excel、截图、browser profile、HAR、cookie、token 或真实业务数据。

## D：待办记录（已确认需求，尚未实现）

Task 007-D 当前状态必须保持为：

```text
已确认需求，尚未实现
```

不得写成开发中或已完成。

### 数量对账

用户在优招页面看到杭州 841 条。系统曾出现以下观测值：

* 优招页面显示：841。
* 此前 full API total：786。
* Task 007-C 管理正常/有效：770。
* Task 007-C 已删除：9。
* 此前唯一导出曾出现：768。

这些数字暂时不能混为同一统计口径。

Task 007-D 必须核对：

* 页面是否包含全部招聘状态。
* API 是否固定 `status=1`。
* 页面城市值与 API 城市值。
* 原始条数。
* 招聘中条数。
* invalid。
* duplicate。
* 重复 sourceId。
* 已软删除。
* Clean Table 有效数。
* 最终唯一导出数。

未完成对账前，不得直接重跑杭州 full，也不得直接认定漏抓 71 条。

### 业务线分类修订

记录用户确认的分类规则及匹配优先级：

| 匹配规则 | 映射 |
| --- | --- |
| 叮咚分拣、小象分拣、快递 | 其他点 |
| 小象配送、叮咚 | 买菜点 |
| 美团 | 美团点 |
| 面试点 | 面试点 |
| 淘宝UB、淘宝ub、淘宝专送 | 淘宝点 |
| 七鲜配送、世纪联华、京东外卖、大润发、山姆配送、必胜客配送、永辉配送、沃尔玛配送、瑞幸配送、瑞辛配送、盒马、肯德基配送、达达、驻店KA配送、麦当劳配送 | 商超点 |

“叮咚分拣”必须先被其他点规则命中。未命中业务线暂定继续兜底为商超点，但必须统计兜底数量。

Task 007-D 需要新增或统一共享映射函数，供以下位置共同使用：

* 采集预览。
* 任务统计。
* Clean Table。
* 单图层导出。
* 全部图层导出。
* 全部城市导出。

不得根据岗位名称、站点名称或地址猜测分类。

### 管理数据批量软删除

`/data-management` 后续增加：

* 每行复选框。
* 多选。
* 选择当前页。
* 删除选中项。
* 删除当前筛选结果。

删除必须使用现有软删除机制。

“一键删除”定义为：

```text
删除当前筛选条件下的全部记录
```

无筛选时才代表当前管理范围中的全部记录。

必须二次确认，并显示：

* 预计删除数量。
* 当前筛选范围。
* 数据来源范围。
* 软删除说明。

软删除后必须刷新：

* 管理列表。
* 总数。
* 正常/异常统计。
* Dashboard Clean Table。
* 城市下拉。
* 导出数量。
* 图层统计。

不得物理删除数据库记录或 `raw_records`。
