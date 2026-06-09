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

* 21 个测试文件、83 个测试通过。

风险：

* 钉图外部页面可能需要手动登录、验证码、人机验证或额外权限。
* 找不到目标团队或“面试点”地图时会返回 `failed`，需要用户确认账号权限。
* 页面 selector 变化时会返回 `blocked` 并保存截图。
* 文件提交后无可靠成功提示时返回 `unknown`，需要人工确认钉图侧结果。

## Task 006-C Done 草稿：平台选择与导入限制修复

Done:

* Dashboard 已新增“选择平台”下拉，默认“面试点”。
* 平台选项：其他点、商超点、淘宝点、美团点、买菜点、面试点。
* 上传 API 已接收 `platform`，缺省 `mianshi`，非法 key 先返回错误。
* `GET /api/dingmap/upload/status` 已返回 `platformOptions`。
* 平台配置集中在 `packages/browser-controller/dingmap-platforms.ts`。
* 平台到图层映射已完成：other/shangchao/taobao/meituan/maicai/mianshi。
* 平台到标记颜色映射已完成：橙色/紫色/蓝色/黄色/绿色/红色。
* 其他点已设置为橙色。
* 标记大小固定为“小”。
* 坐标类型保持“火星坐标（高德/腾讯/谷歌）”。
* 浏览器自动化改为按所选平台图层进入“更多 → 数据导入 → 新增数据”。
* 颜色 nth fallback 已集中在 selector / platform config 中。
* 上传前已检查 Excel 数据行数，2000 行按数据行计算，不含表头。
* 表头 + 2000 行数据允许；表头 + 2001 行数据返回 `blocked / row-limit`。
* 超过 2000 行时不打开钉图、不上传、不点击导入。
* 文件选择确认仍保留，确认失败不点击“导入”。
* 导入提交后不主动关闭 Playwright 浏览器窗口。
* `unknown` 仍不伪造成 `success`。
* `sync_logs` 继续记录上传摘要，并记录 platform / layer / color / size / stage，不记录敏感内容。

新增 / 更新测试：

* `packages/browser-controller/dingmap-platforms.test.ts`
* `packages/browser-controller/dingmap-selectors.test.ts`
* `packages/dingmap/read-export-row-count.test.ts`
* `apps/dashboard/app/api/dingmap/upload/dingmap-upload-routes.test.ts`

验证命令：

* `corepack pnpm run verify`

测试结果：

* 21 个测试文件、83 个测试通过。

剩余风险：

* 钉图真实页面 selector 变化时仍可能返回 `blocked`。
* 真实上传仍可能遇到登录、验证码、人机验证或权限不足。
* 自动分批导入不在本任务范围内。

## Task 006-D Done 草稿：模板字段映射与导出命名

Done:

* 已按真实钉图导入模板修正表头：标记名称、详细地址、经度、纬度、备注、字段一、字段二。
* 已修正字段映射：标记名称=站点名称，详细地址=地址，经度=经度，纬度=纬度。
* 已修正钉图模板“备注”列：写入薪资。
* 已修正“字段一”：写入联系人和电话，格式为 `联系人：...；电话：...`。
* 已修正“字段二”：写入系统业务备注，不再 fallback 到面试时间。
* 已避免字段一输出 `undefined` / `null` / `-`。
* Dashboard 已新增“导出名称”输入框。
* 导出 API 已接收平台和导出名称。
* 导出文件名已支持 `dingmap-import-{平台中文名}-{导出名称}-{timestamp}.xlsx`。
* 用户未填写导出名称时，仍生成带平台中文名的文件名。
* Windows 非法文件名字符会被清理，文件仍只写入 `data/exports/`。
* 最近导出文件列表兼容旧时间戳文件名和新可读文件名。
* 未提交用户提供的真实钉图模板文件。
* 未修改钉图自动上传主流程、平台图层映射、颜色映射、2000 行限制或 unknown 逻辑。

测试：

* `packages/dingmap/export-template.test.ts`
* `packages/dingmap/one-click-export.test.ts`
* `packages/db/dingmap-export.test.ts`

风险：

* 已存在的旧导出文件名仍显示为旧格式；重新导出后才会生成更可读的新文件名。

## Task 006-E Done 草稿：验收问题集中修复

Done:

* 已修复图层“更多”锚点：自动化先按目标图层名称定位图层卡片，再点击该卡片内部“更多”。
* 已移除全局第一个“更多”兜底，避免点到其他图层。
* 已在点击候选 locator 前执行 `scrollIntoViewIfNeeded`，支持图层在列表下方时滚动查找。
* 找不到目标图层时返回 `blocked / layer-not-found`，Dashboard 可显示明确提示。
* 已修复中文文件名下载：路由解码 URL filename，响应头使用 ASCII fallback + `filename*=UTF-8''...`。
* 下载路由继续使用 `data/exports/` 内 realpath 校验，拒绝路径穿越和目录外文件。
* 已为下载响应补充 `Content-Length`。
* 已调整识别预览字段：行号、来源、站点名称、站点地址、联系人、薪资待遇、福利待遇、交付条件、原始文本、状态、错误 / 警告。
* 已删除独立电话列；联系人列合并联系人和电话，格式为 `联系人 电话`。
* 已调整无坐标异常规则：无经纬度但有站点地址视为正常；无地址且无完整坐标才标记异常。
* 已统一钉图模板映射：标记名称=站点名称，详细地址=站点地址，经度=经度，纬度=纬度，备注=薪资待遇，字段一=联系人 + 电话，字段二=交付条件。
* 未扩展钉图模板列，表头仍为：标记名称、详细地址、经度、纬度、备注、字段一、字段二。
* 未修改平台颜色映射、2000 行限制、unknown 状态逻辑。
* 未做真实钉图重复提交。

新增 / 更新测试：

* `packages/browser-controller/dingmap-selectors.test.ts`
* `apps/dashboard/app/api/dingmap/download/dingmap-download-route.test.ts`
* `apps/dashboard/app/dashboard-preview-fields.test.ts`
* `packages/db/clean-marker-management.test.ts`
* `packages/dingmap/export-template.test.ts`
* `packages/dingmap/one-click-export.test.ts`

验证命令：

* `corepack pnpm run check`
* `corepack pnpm run lint`
* `corepack pnpm run test`
* `corepack pnpm run verify`

测试结果：

* `corepack pnpm run verify` 通过。
* 23 个测试文件、95 个测试通过。

剩余风险：

* 钉图外部页面 DOM 仍可能变化，后续可按需要补本地 inspector/debug 脚本。
* 真实上传仍可能遇到登录、验证码、人机验证或权限阻塞。

## Task 006-F Done 草稿：自动化浏览器统一与人工辅助定位

Done:

* 已将新导出文件名改为 `平台-导出名称-M.D-HH.mm.xlsx`。
* 导出名称为空时使用 `未命名`，例如 `美团点-未命名-6.9-17.31.xlsx`。
* 文件名继续清理 Windows 非法字符。
* 旧 `dingmap-import-...` 文件名继续兼容最近导出、下载和上传选择。
* “打开钉图”已改为调用 `/api/dingmap/open`，不再走普通默认浏览器链接。
* 自动化浏览器统一使用 `data/browser-profile/dingmap/`，优先 `channel: "chrome"`。
* 自动化 Chrome 中已有 `dm.dingmap.com` page 时优先复用。
* 新增 `manual_assist` 状态和人工辅助步骤流。
* Dashboard 上传入口默认进入人工辅助流程，不再继续盲猜钉图元素。
* 人工辅助步骤会在关键点暂停：确认登录/地图、找图层、点图层“更多”、点“数据导入”、确认新增数据、确认样式、选择文件、点导入、读结果。
* 用户在自动化 Chrome 操作完后，点击 Dashboard “继续上传”，系统读取页面结构再进入下一步。
* 每次继续会保存截图到 `data/screenshots/dingmap-upload/`，DOM/候选元素摘要到 `data/debug/dingmap-upload/`。
* 已将 `data/debug/` 加入 `.gitignore`。
* success / failed / blocked / timeout / unknown 路径不再自动关闭自动化浏览器。
* Dashboard stage 改为中文映射，长文件名截断显示。
* 仍保留 2000 行限制、平台颜色映射、中文下载、模板字段映射和 unknown 不伪造 success。
* 未做真实钉图重复提交。

新增 / 更新测试：

* `packages/browser-controller/dingmap-assisted-locator.test.ts`
* `packages/browser-controller/dingmap-upload-safety.test.ts`
* `apps/dashboard/app/dashboard-dingmap-upload-ui.test.ts`
* `packages/dingmap/one-click-export.test.ts`
* `packages/db/dingmap-export.test.ts`

验证命令：

* `corepack pnpm run check`
* `corepack pnpm run lint`
* `corepack pnpm run test`

测试结果：

* 26 个测试文件、102 个测试通过。

剩余风险：

* 人工辅助模式会采集真实页面 DOM 摘要，但只保存到 ignored 本地目录。
* 如果公司电脑没有安装 Chrome channel，自动化 Chrome 打开会失败，需要安装 Chrome 或后续增加 fallback。
* 真实上传仍可能遇到登录、验证码、人机验证或权限阻塞；本任务不绕过这些限制。
