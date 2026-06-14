# 任务卡 007：优招网页接口探测与小批量岗位采集 MVP

## GitHub Issue

* Issue 标题：`[Task 007] 优招网页 API 探测与小批量导入 Clean Table`
* Issue 草稿：`docs/github-issues/task-007-issue.md`
* Labels：`task`, `feature`, `youzhao`, `clean-table`, `priority-high`

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

第一版只做分类统计，不做按图层拆分 Excel：

* 包含“美团” -> 美团点
* 包含“淘宝专送”或“淘宝UB” -> 淘宝点
* 包含“小象配送”或“叮咚” -> 买菜点
* 包含“分拣员” -> 其他点
* 其他全部 -> 商超点

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
* 不做按城市 / 图层拆分 Excel，本项留到 A3。

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
9. 钉图导出按每批最多 2000 条拆分，A3 再做城市 / 图层拆分文件。

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

### 当前状态

* Task 007-B 已完成自动化测试和类型检查阶段。
* 真实 smoke 待最终验证阶段执行，最多 40 条。
* 是否已执行杭州全量：否。
