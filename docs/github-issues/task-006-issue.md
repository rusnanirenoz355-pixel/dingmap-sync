# [Task 006] 钉图模板自动上传 MVP

Labels: `task`, `feature`, `dingmap`, `playwright`, `priority-high`

## 背景

Task 003 已能导出钉图一键导入模板，Task 004 / 005 已能把字段文本、TSV、Excel 导入 Clean Table 并管理软删除数据。下一步需要在本地环境完成“导出后上传到钉图”的 MVP，但不能绕过登录、验证码或页面限制，也不能在没有可靠结果时伪造成功。

## 目标

实现：

```text
data/exports/dingmap-import-*.xlsx
-> Dashboard 选择最近导出文件
-> POST /api/dingmap/upload 创建任务
-> 本地 headful Playwright 打开钉图
-> 定位“我协作的地图 - 速宸立信 团队”
-> 进入“面试点”地图
-> 图层列表 / 更多 / 数据导入 / 新增数据
-> 如需登录则 requires_login
-> 登录后 POST /api/dingmap/upload/continue
-> success / failed / blocked / timeout / unknown
```

目标团队和地图：

```text
团队：速宸立信 团队
地图：面试点
```

参考地址：

```text
https://dm.dingmap.com/home/map?id=c7b3a5c524864c698416c093843c34c6
```

## 范围

* 使用本地 headful Playwright。
* 登录态保存到 ignored 本地目录 `data/browser-profile/dingmap/`。
* 失败截图保存到 ignored 本地目录 `data/screenshots/dingmap-upload/`。
* API 使用 job 状态模型。
* Dashboard 展示最近导出文件、上传按钮、继续上传按钮和当前状态。
* API 只接受文件名，后端校验 basename / realpath / exportsDir。
* Playwright 必须先定位“我协作的地图 - 速宸立信 团队”，再进入“面试点”地图。
* 一键导入入口在地图内“图层列表 → 更多 → 数据导入”，不是地图列表页。
* 点击“导入”前必须先选择并确认当前导出 Excel 文件。
* 无可靠成功提示时返回 `unknown`。
* 上传结果写入本地 `sync_logs`。

## 不做范围

* 不改 Task 003 钉图模板字段。
* 不因钉图校验失败擅自修改模板。
* 不绕过验证码、人机验证或权限限制。
* 不伪造 success。
* 不提交 `.env`、`.auth`、数据库、导出文件、截图、浏览器 profile。
* 不使用真实业务数据做测试。

## 验收标准

* Dashboard 可列出最近导出的 `dingmap-import-*.xlsx`。
* Dashboard 可手动选择最近导出文件。
* `POST /api/dingmap/upload` 可创建短返回 job。
* `GET /api/dingmap/upload/status` 可返回 job 和 recentExports。
* `POST /api/dingmap/upload/continue` 仅在 `requires_login` 时可继续。
* 首次未登录时返回 `requires_login`，并保留本地 Playwright 浏览器等待用户登录。
* 找不到“速宸立信 团队”或“面试点”返回 `failed`，提示确认钉图权限。
* 验证码、人机验证或地图内入口结构变化返回 `blocked`。
* 未确认文件已选择时不能点击“导入”，返回 `blocked`。
* 可靠成功提示才返回 `success`。
* 文件已提交但无可靠结果提示返回 `unknown`。
* 路径穿越 filename 被拒绝。
* `.gitignore` 覆盖敏感目录。
* `check` / `lint` / `test` / `verify` 通过。

## Done 评论草稿

Done:

* 已从最新 `main` 创建 `codex/task-006-dingmap-auto-upload`。
* 已新增本地 headful Playwright 上传控制器。
* 已新增上传 job 状态模型。
* 已新增 `POST /api/dingmap/upload`。
* 已新增 `GET /api/dingmap/upload/status`。
* 已新增 `POST /api/dingmap/upload/continue`。
* Dashboard 已支持选择最近导出文件并启动上传。
* Dashboard 已支持 `requires_login` 后继续上传。
* Playwright 已改为按“速宸立信 团队 / 面试点”定位目标地图。
* Playwright 已改为从地图内“图层列表 → 更多 → 数据导入 → 新增数据”进入上传。
* Playwright 已改为先确认 Excel 文件已被页面选中，再点击“导入”。
* 已实现 `pending`、`opening_dingmap`、`requires_login`、`uploading`、`confirming`、`success`、`failed`、`blocked`、`timeout`、`unknown` 状态。
* 已将登录态限制在 `data/browser-profile/dingmap/`。
* 已将失败截图限制在 `data/screenshots/dingmap-upload/`。
* 已实现 filename-only API 和 basename / realpath / exportsDir 校验。
* 已确认 `unknown` 不伪造为 `success`。
* 未修改 Task 003 钉图模板字段。

验证命令：

* `corepack pnpm install`
* `corepack pnpm check`
* `corepack pnpm lint`
* `corepack pnpm test`
* `corepack pnpm verify`

测试结果：

* 18 个测试文件、70 个测试通过。

风险：

* 钉图外部页面可能需要手动登录、验证码、人机验证或额外权限。
* 找不到目标团队或“面试点”地图时会返回 `failed`，需要用户确认账号权限。
* 页面 selector 变化时会返回 `blocked` 并保存截图。
* 文件提交后无可靠成功提示时返回 `unknown`，需要人工确认钉图侧结果。
