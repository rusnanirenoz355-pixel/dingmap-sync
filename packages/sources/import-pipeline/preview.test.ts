import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  buildMergeKey,
  summarizePreviewRows,
  type ExistingMarkerFingerprint,
  type RawImportRow,
} from "./preview";

const syntheticPhone = ["199", "0000", "0000"].join("");

function rawRow(raw: Record<string, string>): RawImportRow {
  return {
    rowIndex: 2,
    source: "manual_paste",
    originType: "manual_paste",
    rawText: Object.values(raw).join("\t"),
    raw,
  };
}

function youzhaoRow(raw: Record<string, string>): RawImportRow {
  return {
    rowIndex: 1,
    source: "youzhao",
    originType: "web",
    rawText: JSON.stringify(raw),
    raw,
  };
}

describe("shared import preview pipeline", () => {
  it("maps aliases and marks a new row as valid", () => {
    const rows = buildImportPreview([
      rawRow({
        站点名称: "Alpha Site",
        地址: "Alpha Road",
        联系人: "Manager A",
        电话: syntheticPhone,
        备注: "Synthetic remark",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
    expect(rows[0]?.mapped.address).toBe("Alpha Road");
    expect(rows[0]?.mapped.stationManager).toBe("Manager A");
    expect(rows[0]?.mapped.phone).toBe(syntheticPhone);
    expect(rows[0]?.mapped.source).toBe("manual_paste");
    expect(rows[0]?.mapped.originType).toBe("manual_paste");
    expect(rows[0]?.status).toBe("valid");
  });

  it("keeps unknown columns in raw and reports invalid missing key fields", () => {
    const rows = buildImportPreview([
      rawRow({
        未识别字段: "Keep me",
        电话: "not-a-phone",
      }),
    ]);

    expect(rows[0]?.raw["未识别字段"]).toBe("Keep me");
    expect(rows[0]?.status).toBe("invalid");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
  });

  it("marks duplicate and update candidates from existing fingerprints", () => {
    const first = buildImportPreview([
      rawRow({
        站点名称: "Alpha Site",
        地址: "Alpha Road",
        电话: syntheticPhone,
      }),
    ])[0];
    const existing = new Map<string, ExistingMarkerFingerprint>([
      [
        first?.mergeKey ?? "",
        {
          id: 10,
          currentHash: first?.currentHash ?? null,
        },
      ],
    ]);
    const duplicate = buildImportPreview(
      [
        rawRow({
          站点名称: "Alpha Site",
          地址: "Alpha Road",
          电话: syntheticPhone,
        }),
      ],
      existing,
    );
    existing.set(first?.mergeKey ?? "", { id: 10, currentHash: "different-hash" });
    const update = buildImportPreview(
      [
        rawRow({
          站点名称: "Alpha Site",
          地址: "Alpha Road",
          电话: syntheticPhone,
          备注: "Changed remark",
        }),
      ],
      existing,
    );

    expect(duplicate[0]?.status).toBe("duplicate");
    expect(update[0]?.status).toBe("update_candidate");
  });

  it("summarizes preview statuses", () => {
    const rows = buildImportPreview([
      rawRow({ 站点名称: "Alpha Site", 地址: "Alpha Road", 电话: syntheticPhone }),
      rawRow({ 电话: "bad-phone" }),
    ]);

    expect(summarizePreviewRows(rows)).toMatchObject({ valid: 1, invalid: 1 });
  });

  it("builds merge keys from phone/address, site/address, or site/phone", () => {
    expect(buildMergeKey({ siteName: "Alpha Site", address: "Alpha Road" })).toContain(
      "site_address",
    );
    expect(buildMergeKey({ siteName: "Alpha Site", phone: syntheticPhone })).toContain(
      "site_phone",
    );
    expect(buildMergeKey({ address: "Alpha Road", phone: syntheticPhone })).toContain(
      "phone_address",
    );
  });

  it("accepts youzhao web rows and dedupes by stable source id", () => {
    const rows = buildImportPreview([
      youzhaoRow({
        siteId: "site-1",
        jobId: "job-a",
        合作站点名称: "Synthetic Site",
        站点地址: "",
        站长姓名: "Manager A",
        站长电话: syntheticPhone,
        岗位名称: "Rider",
        薪资方案: "Synthetic salary",
        新人政策: "Synthetic welfare",
        结算规则: "Synthetic settlement",
        业务线: "美团",
        招聘状态: "招聘中",
        targetLayer: "美团点",
        dingmapFieldOne: `Manager A ${syntheticPhone}`,
        dingmapFieldTwo: "Synthetic settlement",
      }),
    ]);

    expect(rows[0]).toMatchObject({
      source: "youzhao",
      status: "valid",
      mergeKey: "source_id:youzhao:site-1:job-a",
      targetLayer: "美团点",
      dingmapFieldOne: `Manager A ${syntheticPhone}`,
      dingmapFieldTwo: "Synthetic settlement",
    });
    expect(rows[0]?.mapped).toMatchObject({
      source: "youzhao",
      originType: "web",
      sourceId: "site-1:job-a",
      siteName: "Synthetic Site",
      address: "",
      longitude: null,
      latitude: null,
      jobTitle: "Rider",
      salary: "Synthetic salary",
      welfare: "Synthetic welfare",
      remark: "Synthetic settlement",
    });
    expect(rows[0]?.warnings).toContain("地址为空，导入后可能需要人工补齐定位信息。");
  });

  it("does not merge two youzhao jobs from the same site and address", () => {
    const rows = buildImportPreview([
      youzhaoRow({
        siteId: "site-1",
        jobId: "job-a",
        合作站点名称: "Synthetic Site",
        站点地址: "Synthetic Road",
        岗位名称: "Job A",
        招聘状态: "招聘中",
      }),
      youzhaoRow({
        siteId: "site-1",
        jobId: "job-b",
        合作站点名称: "Synthetic Site",
        站点地址: "Synthetic Road",
        岗位名称: "Job B",
        招聘状态: "招聘中",
      }),
    ]);

    expect(rows.map((row) => row.mergeKey)).toEqual([
      "source_id:youzhao:site-1:job-a",
      "source_id:youzhao:site-1:job-b",
    ]);
    expect(rows.every((row) => row.status === "valid")).toBe(true);
  });

  it("marks youzhao rows without job id invalid instead of inventing source id", () => {
    const rows = buildImportPreview([
      youzhaoRow({
        siteId: "site-1",
        合作站点名称: "Synthetic Site",
        站点地址: "Synthetic Road",
        招聘状态: "招聘中",
      }),
    ]);

    expect(rows[0]?.status).toBe("invalid");
    expect(rows[0]?.mergeKey).toBeNull();
    expect(rows[0]?.errors).toContain("优招记录缺少 jobId，不能伪造 sourceId。");
  });
});
