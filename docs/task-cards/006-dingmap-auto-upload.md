# 任务卡 006：钉图模板自动上传 MVP

## GitHub Issue

* Issue 标题：`[Task 006] 钉图模板自动上传 MVP`
* Issue 编号：线上 Issue 如已手动创建，请以线上为准
* Issue 链接：`docs/github-issues/task-006-issue.md`
* Labels：`task`, `feature`, `dingmap`, `playwright`, `priority-high`

## 任务目标

在 Task 003 钉图模板导出和 Task 005 已导入数据管理的基础上，交付本地一键上传 MVP：

```text
Clean Table
-> 导出 dingmap-import-*.xlsx
-> 选择最近导出文件
-> 本地 headful Playwright 打开钉图
-> 定位“我协作的地图 - 速宸立信 团队”
-> 打开“面试点”地图
-> 图层列表 / 更多 / 数据导入 / 新增数据
-> 自动选择文件并尝试确认导入
-> 返回明确状态
```

目标钉图团队和地图：

```text
团队：速宸立信 团队
地图：面试点
```

参考地图地址：

```text
https://dm.dingmap.com/home/map?id=c7b3a5c524864c698416c093843c34c6
```

## 已完成

1. 从最新 `main` 创建 `codex/task-006-dingmap-auto-upload`。
2. 新增 `packages/browser-controller/dingmap-selectors.ts`，集中维护第一版钉图页面 selector。
3. 新增 `packages/browser-controller/dingmap-upload.ts`，使用本地 headful Playwright 和 persistent profile。
4. 新增 `packages/db/dingmap-upload-job.ts`，实现上传 job 状态模型。
5. 新增 `POST /api/dingmap/upload`。
6. 新增 `GET /api/dingmap/upload/status`。
7. 新增 `POST /api/dingmap/upload/continue`。
8. Dashboard 钉图导出区新增最近导出文件选择。
9. Dashboard 新增“自动上传到钉图”和 `requires_login` 下的“继续上传”。
10. Dashboard 显示上传状态、状态消息和失败截图路径。
11. 默认选择 `data/exports/` 下最新 `dingmap-import-*.xlsx`。
12. API 只接受文件名，不接受任意路径。
13. 后端做 basename、文件名格式、resolve、realpath、exportsDir 校验。
14. 登录态保存到 `data/browser-profile/dingmap/`。
15. 失败截图保存到 `data/screenshots/dingmap-upload/`。
16. `.gitignore` 覆盖 `.env`、`.env.*`、`.auth/`、`data/*.db`、`data/**/*.db`、`data/uploads/`、`data/exports/`、`data/screenshots/`、`data/browser-profile/`。
17. 上传结束写入 `sync_logs`，记录 filename、submitted、status、teamName、mapName、entryUrl、referenceMapUrl 和截图路径。
18. 对无可靠成功提示的页面返回 `unknown`，Dashboard 展示“已提交，结果待人工确认”。
19. 自动化入口修正为地图列表页，优先定位“我协作的地图 - 速宸立信 团队”。
20. 找到团队后再定位并点击“面试点”地图卡片。
21. 进入地图后从左侧“图层列表”的当前图层“更多”菜单进入“数据导入”。
22. 在“数据导入”窗口选择“新增数据”，坐标类型保持默认或使用“火星坐标（高德/腾讯/谷歌）”，标记样式保持默认。
23. 点击上传区域“点击选择导入文件”或底层文件 input，上传当前系统导出的 Excel。
24. 点击“导入”前必须确认钉图页面已选择当前 Excel 文件；无法确认时返回 `blocked`，阶段为 `upload-input`。
25. 文件确认后才点击右下角“导入”；找不到可点击按钮时返回 `blocked`，阶段为 `import-confirm`。

## 状态口径

* `requires_login`：钉图需要登录，用户在 Playwright 浏览器中手动登录后再继续。
* `blocked`：验证码、人机验证、图层/菜单/上传控件缺失或页面结构变化等不可自动化阻塞。
* `failed`：目标团队或“面试点”地图找不到、钉图页面出现可靠失败提示或本地自动化异常。
* `timeout`：等待过程超过任务超时。
* `unknown`：文件已提交或已选择，但没有可靠成功 / 失败提示。
* `success`：仅当页面出现可靠成功提示时返回。

## 隐私和敏感文件

* 不使用真实业务数据做测试。
* 不提交账号、Cookie、浏览器登录态、`.env`、`.auth`。
* 不提交数据库、上传文件、导出文件、截图和浏览器 profile。
* 截图仅用于本地排查。

## 不做范围

1. 不改 Task 003 钉图模板字段。
2. 不在钉图校验失败时擅自修改导出模板。
3. 不做云端浏览器或远程托管自动化。
4. 不绕过验证码、人机验证或权限限制。
5. 不伪造上传成功。
6. 不接优招 / 捷聘采集。
7. 不做批量上传历史文件。
8. 不新增数据库 schema。

## 涉及模块

* `.gitignore`
* `apps/dashboard/app/page.tsx`
* `apps/dashboard/app/api/dingmap/upload/route.ts`
* `apps/dashboard/app/api/dingmap/upload/status/route.ts`
* `apps/dashboard/app/api/dingmap/upload/continue/route.ts`
* `packages/browser-controller/dingmap-selectors.ts`
* `packages/browser-controller/dingmap-upload.ts`
* `packages/db/dingmap-export.ts`
* `packages/db/dingmap-upload-job.ts`
* `packages/db/package.json`
* `vitest.config.ts`

## 新增 / 更新测试

* `packages/db/dingmap-export.test.ts`
* `apps/dashboard/app/api/dingmap/upload/dingmap-upload-routes.test.ts`
* `packages/browser-controller/dingmap-selectors.test.ts`

覆盖内容：

* 导出文件名格式校验。
* 路径穿越拒绝。
* existing export realpath 校验。
* 最近导出文件按 mtime 选择。
* 上传 API 拒绝带路径的 filename。
* 上传状态 API 返回 job / recentExports 结构。
* 没有 `requires_login` 任务时不能 continue。
* 上传目标团队 / 地图 / 地图内数据导入 selector 被固定为“速宸立信 团队 / 面试点”。
* 上传顺序被固定为先选择文件，再点击“导入”。

## 命令验证清单

* [x] `corepack pnpm install`
* [x] `corepack pnpm check`
* [x] `corepack pnpm lint`
* [x] `corepack pnpm test`
* [x] `corepack pnpm verify`
* [x] dev server / Dashboard smoke
* [x] 敏感文件检查

## 当前风险

* 钉图页面是外部系统，selector 可能随时变化。
* 首次真实上传大概率需要手动登录。
* 钉图可能出现验证码、人机验证或权限阻塞，此时必须返回 `blocked` 或 `requires_login`。
* 如果找不到“速宸立信 团队”或“面试点”，返回 `failed` 并提示确认钉图权限。
* 若文件提交后没有可靠成功提示，只能返回 `unknown`，需要人工确认钉图侧结果。
* 新路径 live smoke 使用脱敏 synthetic 文件，已进入“速宸立信 团队 / 面试点 / 数据导入”流程并点击“导入”，最终返回 `unknown`，需要人工确认钉图侧结果。

## 任务卡自查

1. 是否交付自动上传 MVP，而不只是流程探测文档：是。
2. 是否使用本地 headful Playwright：是。
3. 是否登录态只放 ignored 本地目录：是。
4. 是否 upload API 使用 job 状态模型：是。
5. 是否 API 只接受文件名：是。
6. 是否做路径穿越防护：是。
7. 是否失败截图保存到 ignored 本地目录：是。
8. 是否不伪造 success：是。
9. 是否 `unknown` 有明确 UI 文案：是。
10. 是否未修改 Task 003 模板字段：是。
11. 是否优先按“速宸立信 团队 / 面试点”定位目标地图：是。
12. 是否从地图内“更多 → 数据导入”进入上传：是。
13. 是否点击“导入”前确认已选择当前 Excel：是。

## 006-C 追加：平台选择、图层样式和 2000 行限制

### 新增范围

* Dashboard 自动上传区域新增“选择平台”，默认“面试点”，选项为：其他点、商超点、淘宝点、美团点、买菜点、面试点。
* 上传 API 接收 `platform`，缺省为 `mianshi`，非法平台 key 返回清晰错误。
* 平台配置集中维护在 `packages/browser-controller/dingmap-platforms.ts`，UI、API、browser-controller 复用同一份配置。
* 平台到图层映射：其他点、商超点、淘宝点、美团点、买菜点、面试点。
* 平台到颜色映射：其他点=橙色，商超点=紫色，淘宝点=蓝色，美团点=黄色，买菜点=绿色，面试点=红色。
* 标记大小固定“小”，坐标类型固定“火星坐标（高德/腾讯/谷歌）”。
* 自动化按用户选择的平台图层点击左侧图层列表中的“更多”，不再固定第一个图层。
* 导入前检查 Excel 数据行数，表头不计入：2000 行允许，2001 行返回 `blocked / row-limit`。
* 超过 2000 行时不打开钉图、不上传、不点击导入。
* 导入提交后不主动关闭 Playwright 浏览器窗口，便于用户人工确认 `unknown`。
* 仍然不伪造 `unknown` 为 `success`。

### 追加测试

* `packages/browser-controller/dingmap-platforms.test.ts`
* `packages/dingmap/read-export-row-count.test.ts`
* `packages/browser-controller/dingmap-selectors.test.ts`
* `apps/dashboard/app/api/dingmap/upload/dingmap-upload-routes.test.ts`

### 追加自查

1. 是否仍在 `codex/task-006-dingmap-auto-upload`：是。
2. 是否新增 Dashboard 平台下拉：是。
3. 是否区分目标地图“面试点”和平台图层“面试点”：是。
4. 是否其他点为橙色：是。
5. 是否标记大小固定“小”：是。
6. 是否 2000 行限制按数据行计算且不含表头：是。
7. 是否超过 2000 行不打开钉图：是。
8. 是否保留文件选择确认：是。
9. 是否 unknown 不伪造成 success：是。
10. 是否不改 Task 003 模板字段和 Excel 模板字段：是。

## 006-D 追加：钉图模板字段映射与导出命名

### 字段映射修正

导出 Excel 表头固定为：

```text
标记名称 / 详细地址 / 经度 / 纬度 / 备注 / 字段一 / 字段二
```

字段来源：

* 标记名称 = 站点名称
* 详细地址 = 地址
* 经度 = 经度
* 纬度 = 纬度
* 备注 = 薪资
* 字段一 = 联系人 + 电话，格式为 `联系人：...；电话：...`
* 字段二 = 系统业务备注

### 导出命名修正

* Dashboard 已新增“导出名称”输入框。
* 导出文件名支持平台中文名和用户自定义名称。
* 命名格式：`dingmap-import-{平台中文名}-{导出名称}-{timestamp}.xlsx`。
* 用户未填写导出名称时，仍生成 `dingmap-import-{平台中文名}-{timestamp}.xlsx`。
* Windows 非法文件名字符会被清理。
* 文件仍只写入 `data/exports/`。
* 最近导出文件下拉兼容旧文件名和新文件名。

### 006-D 测试

* `packages/dingmap/export-template.test.ts`
* `packages/dingmap/one-click-export.test.ts`
* `packages/db/dingmap-export.test.ts`

### 006-D 自查

1. 是否仍在 `codex/task-006-dingmap-auto-upload`：是。
2. 是否使用真实模板表头作为字段参考：是。
3. 是否没有提交真实模板文件：是。
4. 是否备注列写薪资：是。
5. 是否字段二写系统备注：是。
6. 是否新增导出名称输入框：是。
7. 是否文件名包含平台中文名：是。
8. 是否文件名可包含用户自定义名称：是。
9. 是否兼容旧导出文件名：是。
10. 是否不影响自动上传 platform 参数和 2000 行限制：是。
