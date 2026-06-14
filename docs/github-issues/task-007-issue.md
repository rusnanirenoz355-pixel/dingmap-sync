# [Task 007] 优招网页 API 探测与小批量导入 Clean Table

## 背景

Task 003 已提供 Clean Table -> 钉图七列模板导出，Task 005 已提供已导入数据管理。Task 007 接入第一个真实网页来源：优招伙伴通网页端岗位数据。

## 范围

* 使用 Playwright persistent context 让用户手动登录优招。
* 不复制 cookie/token，不保存账号密码。
* 在同一认证 context 中请求优招岗位 API。
* 小批量采集 20-100 条，单城市，不全量。
* 转成 `source = youzhao`、`originType = web` raw rows。
* 复用公共 import pipeline 和 `importCleanMarkers()`。
* Dashboard 提供最小“优招采集”面板。
* `/data-management` 可看到导入结果。
* 继续复用 Task 003 钉图模板导出。

## 已完成

* A1：API probe / preview 与 mapper。
* A2：人工登录 persistent context、session check、服务端重新采集 import、Dashboard 最小面板。
* 优招专属钉图导出内容映射，不改七列表头。
* 业务线目标图层统计。
* 单城市、limit/page/pageSize 参数边界。
* 真实数据、登录态、HAR、截图、DB 均不进入 Git。

## 不做

* 不跑 9858 条全量。
* 不做小程序采集。
* 不做高并发或定时任务。
* 不绕过验证码。
* 不自动上传钉图。
* 不做按城市 / 图层拆分 Excel，留到 A3。

## 验收

* check / lint / test / verify 通过。
* 敏感文件审计无命中。
* A2 后停止，不进行全量抓取。

## 后续

Task 007-A3：按城市和目标图层拆分钉图导入 Excel，并继续限制批量规模。

## Task 007-C 更新：优招导出筛选组合

### 范围

* 城市范围和目标图层是两个独立筛选项。
* 城市范围支持当前指定城市和 `city = "all"`。
* 目标图层支持 `targetLayer = "all"`、美团点、淘宝点、买菜点、其他点、商超点。
* `city = "all"` 只读取本地 Clean Table 已采集数据，不请求优招接口，不自动遍历城市。

### 验收口径

* 单城市 + 单图层：只生成该城市该图层文件。
* 单城市 + 全部图层：按该城市已有数据分图层生成文件，无数据图层不生成空文件。
* 全部城市 + 单图层：不同城市的同一图层合并到同一个文件，不按城市拆分。
* 全部城市 + 全部图层：按目标图层分文件。
* 全部城市导出排除 `raw.city` 缺失记录，并统计 `missingCityExcluded`。
* 单城市导出匹配会标准化城市文本，兼容 raw 中带“市”后缀的城市值。
* 单文件超过 2000 条自动拆批。
* 合法筛选无数据时返回 `files = []`、`totalExported = 0`，不生成空 Excel。
* manual_paste / excel 通用导出不受影响。

### 杭州 full 对账

* API total 786，invalid 15，有效处理数 771。
* 实际可导出 Clean Marker 768。
* 未导出 3 条的明确原因是源 API 内重复 `sourceId`；Task 007 以 `sourceId` 为稳定记录粒度，不伪造新记录。
* `missingCity`、软删除、raw 关联缺失、城市错配和图层映射失败均为 0。

## Task 007-B 更新：单城市采集任务与 smoke 保护

### 范围

* 增加 `mode = smoke | full`。
* 本阶段只允许真实执行杭州 smoke：`pageSize = 20`、最多 2 页、最多 40 条。
* full 只实现能力和保护，不在本阶段实际运行。
* full 必须二次确认，确认文案包含城市和 API total，服务端未确认则拒绝启动。

### 完成内容

* 新增优招任务服务，支持 start / pause / resume / cancel / restart / current。
* smoke 完成状态为 `smoke_completed`，不会伪装成完整城市 `completed`。
* full 一致性公式为 API 招聘中 total = imported + duplicate + update_candidate + invalid。
* `filteredNonRecruiting` 单独统计，不进入 full 一致性公式。
* `update_candidate` 只计数，不自动覆盖现有 Clean Marker。
* checkpoint 只保存 SHA-256 sourceId hashes，不保存原始 sourceId 或业务字段。
* tasks API 响应不返回 rows、rawRows、cleanMarkers、业务字段、cookie 或 token。
* Dashboard 新增单城市任务控制区和“部分数据导出”。
* smoke 导出文件名包含 `部分数据`。

### 禁止确认

* 未执行杭州 full。
* 未自动遍历城市。
* 未保存真实响应 JSON / HAR / HTML / 截图。
* 未提交 DB、导出文件、browser profile、cookie 或 token。

### 验收

* check / lint / test / verify 通过。
* 敏感文件审计无命中。
* 完成后才可由用户另行批准杭州 full。
