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
