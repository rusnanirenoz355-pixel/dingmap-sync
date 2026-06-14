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

## Task 007-C 人工验收修复收口

### 修复内容

* 优招钉图导出备注移除岗位名称，仅保留薪资方案和新人政策。
* Dashboard 首页 Clean Table 使用独立滚动容器，支持横向和纵向内部滚动，表头 sticky。
* 优招导出城市下拉读取本地已入库城市，保留“全部城市”，不再使用“当前城市”作为导出选项。
* `/data-management` 不再展示或编辑面试时间。
* 已导入数据异常规则统一为名称或地址缺失才判异常；缺经纬度、电话、薪资、福利、岗位、备注和面试时间不再判异常。

### 验收与边界

* 定向测试覆盖导出备注、城市列表、滚动容器、面试时间移除和异常规则。
* `corepack pnpm verify` 通过。
* 未重新采集优招，未运行其他城市，未执行钉图上传。
* 未提交真实业务数据、DB、导出 Excel、截图、browser profile、HAR、cookie 或 token。

### Task 007-D 待办（未实施）

* 对账杭州页面数量与当前系统数量差异。
* 后续复核业务线到目标图层映射。
* 后续为 `/data-management` 增加多选软删除和删除当前筛选结果。

## Task 007 文档同步补录

### Done

* Task 007-C 人工验收修复已完成并推送。
* 完成提交：`7d3dd680780fe4b74481d237d4c3937cb6eb2a04`。
* 提交说明：`fix: refine youzhao export and data management`。
* 优招钉图 Excel 的“备注”已删除岗位名称，只保留薪资方案和新人政策。
* 字段一仍为站长姓名 + 空格 + 站长电话。
* 字段二仍为结算规则。
* 不影响 `manual_paste` 和普通 Excel 导出。
* Dashboard 首页 Clean Table 已增加独立纵向和横向滚动，表头 sticky，页面 body 不再因宽表整体横向溢出。
* 城市下拉已改为本地真实城市列表，当前显示全部城市和杭州，已删除“当前城市”选项。
* 城市列表只读取本地数据，不触发优招网络采集。
* `/data-management` 已移除面试时间的页面展示、编辑输入和保存提交。
* 数据库字段未删除，未做 schema migration。
* 异常规则已统一为名称为空或地址为空才异常，名称和地址均存在则正常。
* 经纬度、电话、薪资、福利、岗位、备注和面试时间缺失不再导致异常。
* 旧数据采用查询时实时计算，不做数据库回填。
* 未重新采集杭州，未运行其他城市，未执行钉图上传。

### Verification

```text
定向测试：
6 个测试文件
39 项通过

完整 verify：
27 个测试文件
144 项通过
```

### Local Observation

```text
正常/有效：770
异常：0
已删除：9
```

该数量来自 Task 007-C 完成时的本地管理统计，不等同于优招页面全部岗位数，后续由 Task 007-D 专门对账。

### Cross Device Sync

* 公司电脑路径：`C:\Users\EDY\Documents\dingmap-sync`。
* 家庭电脑路径：`C:\Users\Administrator\Documents\dingmap-sync`。
* 公司电脑已将 Task 007-C 推送到 `origin/codex/task-007-youzhao-collector`。
* 家庭电脑已成功 fetch 并切换到同一分支。
* 家庭电脑 HEAD 已同步到 `7d3dd680`。
* 家庭电脑 verify 结果为 27 个测试文件、144 项测试通过。
* 家庭电脑可启动 Dashboard。
* GitHub 代码同步不包含本地运行时数据。

以下内容没有通过 Git 同步：SQLite 数据库、优招已采集岗位数据、导出 Excel、checkpoint、browser profile、登录 session、Cookie、Token、截图、HAR、`.env`、`.auth`。

因此家庭电脑不得为了“补数据”重新执行杭州 full。

### Task 007-D Next

当前状态：

```text
已确认需求，尚未实现
```

#### 数量对账

用户在优招页面看到杭州 841 条。系统曾出现以下观测值：

* 优招页面显示：841。
* 此前 full API total：786。
* Task 007-C 管理正常/有效：770。
* Task 007-C 已删除：9。
* 此前唯一导出曾出现：768。

这些数字暂时不能混为同一统计口径。Task 007-D 必须核对页面是否包含全部招聘状态、API 是否固定 `status=1`、页面城市值与 API 城市值、原始条数、招聘中条数、invalid、duplicate、重复 sourceId、已软删除、Clean Table 有效数和最终唯一导出数。

未完成对账前，不得直接重跑杭州 full，也不得直接认定漏抓 71 条。

#### 业务线分类修订

| 匹配规则 | 映射 |
| --- | --- |
| 叮咚分拣、小象分拣、快递 | 其他点 |
| 小象配送、叮咚 | 买菜点 |
| 美团 | 美团点 |
| 面试点 | 面试点 |
| 淘宝UB、淘宝ub、淘宝专送 | 淘宝点 |
| 七鲜配送、世纪联华、京东外卖、大润发、山姆配送、必胜客配送、永辉配送、沃尔玛配送、瑞幸配送、瑞辛配送、盒马、肯德基配送、达达、驻店KA配送、麦当劳配送 | 商超点 |

“叮咚分拣”必须先被其他点规则命中。未命中业务线暂定继续兜底为商超点，但必须统计兜底数量。

Task 007-D 需要新增或统一共享映射函数，供采集预览、任务统计、Clean Table、单图层导出、全部图层导出和全部城市导出共同使用。不得根据岗位名称、站点名称或地址猜测分类。

#### 管理数据批量软删除

`/data-management` 后续增加每行复选框、多选、选择当前页、删除选中项和删除当前筛选结果。

删除必须使用现有软删除机制。“一键删除”定义为删除当前筛选条件下的全部记录；无筛选时才代表当前管理范围中的全部记录。

必须二次确认，并显示预计删除数量、当前筛选范围、数据来源范围和软删除说明。软删除后必须刷新管理列表、总数、正常/异常统计、Dashboard Clean Table、城市下拉、导出数量和图层统计。不得物理删除数据库记录或 `raw_records`。
