import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { ImportPreviewRow } from "@dingmap-sync/shared";
import { filterExportableMarkers } from "./dingmap-export";
import { importCleanMarkers, listCleanMarkers } from "./import-clean-markers";
import type { RawImportRow } from "../sources/import-pipeline";

const databasePath = join(process.cwd(), "data", "test-import-clean-markers.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

function rawRow(
  raw: Record<string, string>,
  source: RawImportRow["source"] = "manual_paste",
  originType: RawImportRow["originType"] = source === "youzhao" ? "web" : source,
): RawImportRow {
  return {
    rowIndex: 2,
    source,
    originType,
    rawText: Object.values(raw).join("\t"),
    raw,
  };
}

function validManualRow(remark = "Synthetic remark"): RawImportRow {
  return rawRow({
    站点名称: "Alpha Site",
    地址: "Alpha Road",
    联系人: "Manager A",
    电话: syntheticPhone,
    备注: remark,
  });
}

describe("shared clean marker import database service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(schemaSql);
    database.close();
  });

  it("inserts valid manual paste rows into raw records and clean markers", () => {
    const result = importCleanMarkers([validManualRow()]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.cleanMarkers).toHaveLength(1);
    expect(result.cleanMarkers[0]).toMatchObject({
      source: "manual_paste",
      originType: "manual_paste",
      siteName: "Alpha Site",
      address: "Alpha Road",
      phone: syntheticPhone,
      syncAction: "create",
      syncStatus: "pending",
    });

    const database = new DatabaseSync(databasePath);
    const rawRecords = database
      .prepare("SELECT source, raw_title, raw_address, raw_phone FROM raw_records")
      .all();
    database.close();

    expect(rawRecords).toHaveLength(1);
    expect(rawRecords[0]).toMatchObject({
      source: "manual_paste",
      raw_title: "Alpha Site",
      raw_address: "Alpha Road",
      raw_phone: syntheticPhone,
    });
  });

  it("skips duplicate rows without inserting another clean marker", () => {
    importCleanMarkers([validManualRow()]);
    const result = importCleanMarkers([validManualRow()]);

    expect(result.inserted).toBe(0);
    expect(result.skippedDuplicate).toBe(1);
    expect(result.cleanMarkers).toHaveLength(1);
  });

  it("updates update candidates by merge key", () => {
    importCleanMarkers([validManualRow()]);
    const result = importCleanMarkers([validManualRow("Changed synthetic remark")]);

    expect(result.updated).toBe(1);
    expect(result.updateCandidate).toBe(1);
    expect(result.cleanMarkers).toHaveLength(1);
    expect(result.cleanMarkers[0]?.remark).toBe("Changed synthetic remark");
    expect(result.cleanMarkers[0]?.syncAction).toBe("update");
  });

  it("can skip update candidates without mutating existing clean markers", () => {
    importCleanMarkers([validManualRow()]);
    const result = importCleanMarkers(
      [validManualRow("Changed synthetic remark")],
      { updateCandidates: "skip" },
    );

    expect(result.updated).toBe(0);
    expect(result.updateCandidate).toBe(1);
    expect(result.skippedOther).toBe(0);
    expect(result.cleanMarkers).toHaveLength(1);
    expect(result.cleanMarkers[0]?.remark).toBe("Synthetic remark");
    expect(result.cleanMarkers[0]?.syncAction).toBe("create");
  });

  it("revalidates raw rows and ignores forged client status", () => {
    const forged = {
      rowIndex: 3,
      source: "manual_paste",
      rawText: "电话\tbad-phone",
      raw: {
        电话: "bad-phone",
      },
      mapped: {
        siteName: "Forged Site",
        address: "Forged Road",
      },
      status: "valid",
      errors: [],
      warnings: [],
    } as ImportPreviewRow;

    const result = importCleanMarkers([forged]);

    expect(result.inserted).toBe(0);
    expect(result.skippedInvalid).toBe(1);
    expect(result.cleanMarkers).toHaveLength(0);
  });

  it("inserts excel raw rows with excel source and origin type", () => {
    const result = importCleanMarkers([
      rawRow(
        {
          站点名称: "Excel Site",
          地址: "Excel Road",
          电话: syntheticPhone,
        },
        "excel",
      ),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.cleanMarkers[0]).toMatchObject({
      source: "excel",
      originType: "excel",
      siteName: "Excel Site",
      address: "Excel Road",
      syncAction: "create",
      syncStatus: "pending",
    });
  });

  it("inserts youzhao web rows with source id while preserving manual and excel behavior", () => {
    const result = importCleanMarkers([
      rawRow(
        {
          siteId: "site-1",
          jobId: "job-a",
          合作站点名称: "Synthetic Site",
          站点地址: "Synthetic Road",
          站长电话: syntheticPhone,
          岗位名称: "Synthetic Job",
          招聘状态: "招聘中",
        },
        "youzhao",
        "web",
      ),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.cleanMarkers[0]).toMatchObject({
      source: "youzhao",
      originType: "web",
      sourceId: "site-1:job-a",
      siteName: "Synthetic Site",
      address: "Synthetic Road",
      longitude: null,
      latitude: null,
      syncAction: "create",
      syncStatus: "pending",
    });
  });

  it("revalidates youzhao source id from raw job fields and ignores forged client status", () => {
    const forged = {
      rowIndex: 3,
      source: "youzhao",
      rawText: "{}",
      raw: {
        合作站点名称: "Forged Site",
        站点地址: "Forged Road",
        招聘状态: "招聘中",
      },
      mapped: {
        source: "youzhao",
        originType: "web",
        sourceId: "forged-source-id",
        siteName: "Forged Site",
        address: "Forged Road",
      },
      status: "valid",
      errors: [],
      warnings: [],
      mergeKey: "source_id:youzhao:forged-source-id",
      currentHash: "forged-hash",
    } as ImportPreviewRow;

    const result = importCleanMarkers([forged]);

    expect(result.inserted).toBe(0);
    expect(result.skippedInvalid).toBe(1);
    expect(result.cleanMarkers).toHaveLength(0);
  });

  it("keeps inserted rows eligible for DingMap template export", () => {
    importCleanMarkers([validManualRow()]);

    const exportable = filterExportableMarkers(listCleanMarkers());

    expect(exportable).toHaveLength(1);
  });

  it("excludes soft-deleted rows from default Clean Table lists", () => {
    importCleanMarkers([validManualRow()]);
    const database = new DatabaseSync(databasePath);
    database.prepare("UPDATE clean_markers SET deleted_at = datetime('now')").run();
    database.close();

    expect(listCleanMarkers()).toHaveLength(0);
  });
});
