# Task 006 DingMap Auto Upload MVP Design

## Goal

Task 006 adds a local MVP for uploading the latest DingMap import workbook from `data/exports/` into the target DingMap map:

```text
Clean Table
-> export dingmap-import-*.xlsx
-> POST /api/dingmap/upload
-> local headful Playwright
-> DingMap upload flow
-> success / failed / blocked / requires_login / unknown
```

Target identity:

```text
Team: 速宸立信 团队
Map: 面试点
```

Reference map URL:

```text
https://dm.dingmap.com/home/map?id=c7b3a5c524864c698416c093843c34c6
```

The deliverable is an automation MVP, not only a flow exploration note. If DingMap requires login, captcha, extra permission, missing team/map access, or changes the page structure, the system must return the corresponding state instead of pretending the upload succeeded.

## DingMap Flow

The automation must not upload into a random map or default to "地图1". It uses this path:

1. Open the DingMap home/list page.
2. If not logged in, return `requires_login` and keep the local Playwright browser open.
3. Locate `我协作的地图 - 速宸立信 团队`.
4. Within that team section, locate and click the `面试点` map card.
5. After entering the map, locate the left-side `图层列表`.
6. Click the current layer area's `更多` button.
7. Click `数据导入`.
8. Wait for the `数据导入` dialog.
9. Select the `新增数据` tab.
10. Keep the coordinate type default, or use `火星坐标（高德/腾讯/谷歌）` when the UI requires choosing.
11. Keep the marker style default.
12. Use `点击选择导入文件` or the underlying file input to upload the selected `data/exports/dingmap-import-*.xlsx`.
13. Click the dialog's bottom-right `导入` button.
14. Record `success`, `failed`, or `unknown`.
15. If the team/map or upload path cannot be verified, return a clear status and save a screenshot.

Target lookup rules:

* Missing `我协作的地图 - 速宸立信 团队` returns `failed` with a permission check message.
* Missing `面试点` after the team is found returns `failed` with a permission/name check message.
* Missing `图层列表`, `更多`, `数据导入`, `新增数据`, upload control, or reliable result markers returns `blocked` or `unknown` as appropriate.

## Job Model

The upload API is intentionally job-based so the Dashboard does not hold an unbounded long request:

* `POST /api/dingmap/upload` creates an upload job.
* `GET /api/dingmap/upload/status` reads the current job and recent export files.
* `POST /api/dingmap/upload/continue` resumes after the user manually logs in.

Supported statuses:

* `pending`
* `opening_dingmap`
* `requires_login`
* `uploading`
* `confirming`
* `success`
* `failed`
* `blocked`
* `timeout`
* `unknown`

`unknown` is used when the file was submitted or selected but the page did not expose a reliable success or failure signal. The Dashboard labels this as "已提交，结果待人工确认".

## Browser Automation

The automation uses local headful Playwright with persistent context:

```text
data/browser-profile/dingmap/
```

Rules:

* First run can open a Playwright browser and return `requires_login`.
* The user logs in manually in that opened browser.
* The Dashboard "继续上传" action resumes the same job.
* Captcha / human verification returns `blocked`.
* Missing target team/map returns `failed` with a DingMap permission hint.
* Missing map-internal import entry or file input returns `blocked`.
* A reliable DingMap success hint returns `success`.
* A reliable DingMap failure hint returns `failed`.
* No reliable terminal hint after submission returns `unknown`.

Failure screenshots are saved locally:

```text
data/screenshots/dingmap-upload/{timestamp}-{stage}.png
```

Screenshots and browser profile are diagnostic local state only and must not be committed.

## File Selection And Safety

Default selection:

* Pick the latest `dingmap-import-*.xlsx` in `data/exports/`.

Dashboard selection:

* Shows recent export files.
* Allows the user to choose one recent export file before upload.

API boundary:

* Accepts only a file name, never an arbitrary path.
* Enforces basename equality.
* Enforces `dingmap-import-YYYYMMDD-HHMMSS.xlsx`.
* Resolves and realpaths the file under `data/exports/`.
* Rejects path traversal and missing files.

## Dashboard UX

The Dashboard export panel now includes:

* Recent export file selector.
* "自动上传到钉图" action.
* "继续上传" action for `requires_login`.
* Upload status label and message.
* Screenshot path when a local failure screenshot exists.
* Direct DingMap link for manual checking.

## Non-Goals

* Do not change Task 003 DingMap template fields.
* Do not modify the export workbook to work around DingMap validation failures.
* Do not submit real business data in tests or documentation.
* Do not add cloud browser automation.
* Do not store login state outside ignored local directories.
* Do not report `success` without a reliable DingMap success signal.

## Verification

Automated verification covers local boundaries:

* TypeScript route and package imports.
* Export file path safety.
* Recent export selection.
* Upload API path traversal rejection.
* Upload status and continue error paths.

Manual live DingMap verification may still end as `requires_login`, `blocked`, or `unknown` depending on the external site state. Those are valid MVP outcomes when the page cannot be safely automated to a confirmed success.

## Task 006-C Addendum: Platform Selection And Row Limit

Task 006-C extends the MVP without changing the Task 003 DingMap import template.

Platform configuration is centralized in `packages/browser-controller/dingmap-platforms.ts`. The Dashboard, upload API, job status, sync log payload, and browser automation all use the same platform config. Supported platform keys are `other`, `shangchao`, `taobao`, `meituan`, `maicai`, and `mianshi`; missing platform defaults to `mianshi`.

Platform mapping:

| Platform | Layer | Marker Color | Marker Size |
| --- | --- | --- | --- |
| 其他点 | 其他点 | 橙色 | 小 |
| 商超点 | 商超点 | 紫色 | 小 |
| 淘宝点 | 淘宝点 | 蓝色 | 小 |
| 美团点 | 美团点 | 黄色 | 小 |
| 买菜点 | 买菜点 | 绿色 | 小 |
| 面试点 | 面试点 | 红色 | 小 |

The target map remains `面试点`; platform selection only chooses the layer inside the map. The browser automation locates the selected layer in the left layer list, opens that layer's `更多` menu, then enters `数据导入 -> 新增数据`. Color swatch nth fallback is allowed only through centralized selector/config helpers.

Before browser automation starts, the upload service reads the generated `.xlsx` and counts data rows without the header row. Header + 2000 data rows is allowed. Header + 2001 data rows returns `blocked` with stage `row-limit`; the service must not open DingMap, upload the file, or click import. Automatic batching is out of scope.

After the import button is clicked, the Playwright browser window is intentionally kept open. `unknown` is preserved when DingMap does not expose a reliable success or failure signal.
