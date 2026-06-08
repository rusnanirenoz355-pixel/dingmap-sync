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
});
