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
