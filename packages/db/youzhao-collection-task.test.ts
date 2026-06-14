import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ImportPreviewRow } from "@dingmap-sync/shared";
import {
  YOUZHAO_TASK_STATUSES,
  cancelYouzhaoCollectionTask,
  getYouzhaoCollectionTask,
  getYouzhaoCheckpointPath,
  pauseYouzhaoCollectionTask,
  restartYouzhaoCollectionTask,
  resumeYouzhaoCollectionTask,
  startYouzhaoCollectionTask,
} from "./youzhao-collection-task";
import type { RawImportRow } from "../sources/import-pipeline";

const checkpointDir = join(process.cwd(), "data", "temp", "youzhao-task-test");

describe("youzhao collection task service", () => {
  beforeEach(() => {
    if (existsSync(checkpointDir)) {
      rmSync(checkpointDir, { recursive: true, force: true });
    }
    mkdirSync(checkpointDir, { recursive: true });
  });

  it("exposes smoke_completed and count_mismatch statuses", () => {
    expect(YOUZHAO_TASK_STATUSES).toEqual(expect.arrayContaining(["smoke_completed", "count_mismatch"]));
  });

  it("runs smoke mode for at most two pages and forty items without switching to full", async () => {
    const requestedPages: number[] = [];
    const result = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async ({ page }) => {
          requestedPages.push(page);
          return successPage(page, 20, 99);
        },
        importRows: async (rows, options) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
          options,
        }),
      },
    );

    expect(requestedPages).toEqual([1, 2]);
    expect(result.mode).toBe("smoke");
    expect(result.status).toBe("smoke_completed");
    expect(result.pageSize).toBe(20);
    expect(result.maxPages).toBe(2);
    expect(result.maxItems).toBe(40);
    expect(result.processedPages).toBe(2);
    expect(result.processedItems).toBe(40);
    expect(result.counts.imported).toBe(40);
    expect(result.counts.duplicate).toBe(0);
    expect(result.counts.update_candidate).toBe(0);
    expect(result.counts.invalid).toBe(0);
  });

  it("writes safe checkpoints with schema version and source id hashes only", async () => {
    await startYouzhaoCollectionTask(
      { city: "杭/州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async () => successPage(1, 1, 1),
        importRows: async (rows, options) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
          options,
        }),
      },
    );

    const checkpointPath = getYouzhaoCheckpointPath("杭/州", checkpointDir);
    const checkpointText = readFileSync(checkpointPath, "utf8");
    const checkpoint = JSON.parse(checkpointText) as {
      schemaVersion?: number;
      processedSourceIdHashes?: string[];
    };

    expect(checkpointPath).toContain(encodeURIComponent("杭/州"));
    expect(checkpoint.schemaVersion).toBe(1);
    expect(checkpoint.processedSourceIdHashes).toHaveLength(1);
    expect(checkpointText).not.toContain("site-1:job-1");
    expect(checkpointText).not.toContain("Synthetic Site");
    expect(checkpointText).not.toContain("Synthetic Road");
    expect(checkpointText).not.toContain("19900000000");
  });

  it("requires explicit confirmation before full mode can start", async () => {
    const rejected = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "full", confirmed: false, confirmedTotal: 99 },
      {
        checkpointDir,
        collectPage: async () => successPage(1, 1, 1),
      },
    );
    const accepted = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "full", confirmed: true, confirmedTotal: 2, pageSize: 1 },
      {
        checkpointDir,
        collectPage: async ({ page }) => successPage(page, 1, 2),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
      },
    );

    expect(rejected.status).toBe("failed");
    expect(rejected.lastErrorStatus).toBe("full_confirmation_required");
    expect(accepted.status).toBe("completed");
    expect(accepted.mode).toBe("full");
  });

  it("marks full runs count_mismatch without including filtered non recruiting rows", async () => {
    const result = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "full", confirmed: true, confirmedTotal: 3, pageSize: 2 },
      {
        checkpointDir,
        collectPage: async ({ page }) => ({
          ...successPage(page, page === 1 ? 2 : 0, 3),
          filteredNonRecruiting: page === 1 ? 1 : 0,
        }),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
      },
    );

    expect(result.status).toBe("count_mismatch");
    expect(result.totalFromApi).toBe(3);
    expect(result.counts.imported).toBe(2);
    expect(result.counts.filteredNonRecruiting).toBe(1);
  });

  it("requests update candidates to be skipped instead of updated", async () => {
    const seenOptions: unknown[] = [];
    await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async () => successPage(1, 1, 1),
        importRows: async (rows, options) => {
          seenOptions.push(options);
          return {
            inserted: 0,
            updated: 0,
            skippedDuplicate: 0,
            skippedInvalid: 0,
            skippedOther: 0,
            updateCandidate: rows.length,
            cleanMarkers: [],
          };
        },
      },
    );

    expect(seenOptions).toEqual([{ updateCandidates: "skip" }]);
  });

  it("applies pause and cancel after the current page checkpoint", async () => {
    const paused = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async ({ page }) => successPage(page, 20, 99),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
        afterPage: async () => {
          pauseYouzhaoCollectionTask("杭州");
        },
      },
    );

    const cancelled = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async ({ page }) => successPage(page, 20, 99),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
        afterPage: async () => {
          cancelYouzhaoCollectionTask("杭州");
        },
      },
    );

    expect(paused.status).toBe("paused");
    expect(paused.nextPage).toBe(2);
    expect(paused.processedPages).toBe(1);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.nextPage).toBe(2);
    expect(cancelled.processedPages).toBe(1);
  });

  it("checks session before resume and rejects unauthenticated states", async () => {
    await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async ({ page }) => successPage(page, 20, 99),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
        afterPage: async () => pauseYouzhaoCollectionTask("杭州"),
      },
    );

    const rejected = await resumeYouzhaoCollectionTask("杭州", {
      checkpointDir,
      sessionCheck: async () => "requires_login",
      collectPage: async () => successPage(2, 20, 99),
    });
    const accepted = await resumeYouzhaoCollectionTask("杭州", {
      checkpointDir,
      sessionCheck: async () => "authenticated",
      collectPage: async ({ page }) => successPage(page, 20, 99),
      importRows: async (rows) => ({
        inserted: rows.length,
        updated: 0,
        skippedDuplicate: 0,
        skippedInvalid: 0,
        skippedOther: 0,
        updateCandidate: 0,
        cleanMarkers: [],
      }),
    });

    expect(rejected.status).toBe("requires_login");
    expect(rejected.nextPage).toBe(2);
    expect(accepted.status).toBe("smoke_completed");
    expect(accepted.processedPages).toBe(2);
  });

  it("uses structured failed pages and injectable retry sleep", async () => {
    const sleepCalls: number[] = [];
    let attempts = 0;

    const result = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        sleep: async (ms) => {
          sleepCalls.push(ms);
        },
        collectPage: async () => {
          attempts += 1;
          return attempts < 3 ? failedPage("timeout") : successPage(1, 1, 1);
        },
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
      },
    );

    expect(sleepCalls).toEqual([1000, 3000]);
    expect(result.status).toBe("smoke_completed");
    expect(result.failedPages).toEqual([]);
  });

  it("records failed pages without raw responses and restart removes only the current city checkpoint", async () => {
    const failed = await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async () => failedPage("schema_changed"),
      },
    );
    await startYouzhaoCollectionTask(
      { city: "上海", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async () => successPage(1, 1, 1),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
      },
    );

    const hangzhouPath = getYouzhaoCheckpointPath("杭州", checkpointDir);
    const shanghaiPath = getYouzhaoCheckpointPath("上海", checkpointDir);
    const restarted = restartYouzhaoCollectionTask("杭州", {
      checkpointDir,
      confirmed: true,
    });

    expect(failed.failedPages).toEqual([{ page: 1, attempts: 1, status: "schema_changed" }]);
    expect(JSON.stringify(failed)).not.toContain("Synthetic Site");
    expect(existsSync(hangzhouPath)).toBe(false);
    expect(existsSync(shanghaiPath)).toBe(true);
    expect(restarted.status).toBe("idle");
  });

  it("current task responses do not include business rows or raw records", async () => {
    await startYouzhaoCollectionTask(
      { city: "杭州", mode: "smoke" },
      {
        checkpointDir,
        collectPage: async () => successPage(1, 1, 1),
        importRows: async (rows) => ({
          inserted: rows.length,
          updated: 0,
          skippedDuplicate: 0,
          skippedInvalid: 0,
          skippedOther: 0,
          updateCandidate: 0,
          cleanMarkers: [],
        }),
      },
    );

    const current = getYouzhaoCollectionTask();
    const serialized = JSON.stringify(current);

    expect(serialized).not.toContain("rows");
    expect(serialized).not.toContain("rawRows");
    expect(serialized).not.toContain("cleanMarkers");
    expect(serialized).not.toContain("Synthetic Site");
    expect(serialized).not.toContain("site-1:job-1");
  });
});

function successPage(page: number, count: number, total: number) {
  const rawRows = Array.from({ length: count }, (_, index) => rawRow(page, index + 1));
  const rows = rawRows.map((row, index) => previewRow(row, index + 1));
  return {
    status: "success" as const,
    total,
    rawRows,
    rows,
    filteredNonRecruiting: 0,
  };
}

function failedPage(status: "timeout" | "schema_changed") {
  return {
    status,
    total: null,
    rawRows: [],
    rows: [],
    filteredNonRecruiting: 0,
  };
}

function rawRow(page: number, index: number): RawImportRow {
  const jobId = `job-${page}-${index}`;
  return {
    rowIndex: index,
    source: "youzhao",
    originType: "web",
    rawText: "{}",
    raw: {
      siteId: "site-1",
      jobId,
      city: "杭州",
      businessLine: index % 2 === 0 ? "盒马" : "美团",
      合作站点名称: "Synthetic Site",
      站点地址: "Synthetic Road",
      站长电话: "19900000000",
      招聘状态: "招聘中",
    },
  };
}

function previewRow(row: RawImportRow, index: number): ImportPreviewRow {
  return {
    rowIndex: index,
    source: "youzhao",
    rawText: row.rawText,
    raw: row.raw,
    mapped: {
      source: "youzhao",
      originType: "web",
      sourceId: `site-1:${row.raw.jobId}`,
      siteName: "Synthetic Site",
      address: "Synthetic Road",
      syncAction: "create",
      syncStatus: "pending",
    },
    normalized: {},
    status: "valid",
    errors: [],
    warnings: [],
    mergeKey: `source_id:youzhao:site-1:${row.raw.jobId}`,
    currentHash: `hash-${row.raw.jobId}`,
    parseStatus: "parsed",
    targetLayer: index % 2 === 0 ? "商超点" : "美团点",
  };
}
