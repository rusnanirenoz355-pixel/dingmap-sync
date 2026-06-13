# Task 007 Youzhao Collector Design

## Purpose

Task 007 adds the first real web-source collector for Youzhao Partner. The collector must keep authentication local, collect only a small city-scoped batch, reuse the shared import pipeline, and keep DingMap export as the only downstream output.

## Authentication

The Dashboard does not receive Youzhao cookies from `hr.qingz.xyz`, so localhost request-header forwarding is not a valid primary login strategy. The approved strategy is:

```text
Playwright persistent browser context
-> user manually logs in to https://hr.qingz.xyz/push/records
-> profile remains under data/browser-profile/youzhao/
-> server uses the same context request API for Youzhao API calls
```

No account, password, cookie, token, localStorage, sessionStorage, HAR, screenshot, or storage state file may be committed.

## Collection Limits

First version:

* one city only
* `page >= 1`
* `pageSize = 1..50`
* `limit = 20..100`
* fixed recruiting status request parameter `status = 1`
* no full 9858-record crawl
* no automatic all-city iteration

## Data Flow

```text
Youzhao API response
-> packages/sources/youzhao mapper
-> RawImportRow source=youzhao originType=web
-> buildImportPreview
-> importCleanMarkers
-> raw_records + clean_markers
-> /data-management
-> Task 003 DingMap export
```

The import endpoint accepts collection parameters only. It refetches server-side, rebuilds preview rows, recalculates `mergeKey/currentHash`, filters non-recruiting rows, and calls `importCleanMarkers()`.

## Mapping

* `siteName`: 合作站点名称
* `address`: 站点地址
* `stationManager`: 站长姓名
* `phone`: 站长电话
* `jobTitle`: 岗位名称
* `salary`: 薪资方案
* `welfare`: 新人政策
* `remark`: 结算规则
* `longitude`: null
* `latitude`: null
* `sourceId`: `siteId:jobId` when both exist, otherwise `jobId`; missing `jobId` is invalid

Same-site different-job records remain separate.

## DingMap Export

The seven headers remain unchanged. For Youzhao rows only:

* 标记名称 = siteName
* 详细地址 = address
* 经度 / 纬度 = empty cells
* 备注 = sections for job title, salary, and welfare; empty sections are omitted
* 字段一 = station manager + space + phone
* 字段二 = settlement rule

Other sources keep the Task 003 mapping.

## Target Layers

The first version records and displays target layer counts only:

* 美团 -> 美团点
* 淘宝专送 / 淘宝UB -> 淘宝点
* 小象配送 / 叮咚 -> 买菜点
* 分拣员 -> 其他点
* everything else -> 商超点

City/layer-split Excel export is A3.

## Full Crawl Plan

The 9858-record crawl remains design-only for this task:

1. Run per city, never default to nationwide.
2. Use checkpoint fields: city, page, pageSize, processed sourceIds, failed pages, startedAt, updatedAt.
3. Use bounded retries and low request rate.
4. Stop immediately for 401, 403, captcha, blocked, timeout bursts, or schema changes.
5. Cache raw pages locally under ignored `data/youzhao/`.
6. Import each batch through the shared pipeline.
7. Export DingMap files in batches no larger than 2000 rows.
