import { describe, expect, it } from "vitest";
import { mapPreviewRowToCleanMarker } from "./mapper";
import {
  previewManualPasteText,
  type ExistingMarkerFingerprint,
} from "./parser";

const syntheticPhone = ["199", "0000", "0000"].join("");

const validText = [
  "站点名称\t地址\t联系人\t电话\t薪资\t福利\t备注",
  `Alpha Site\tAlpha Road\tManager A\t${syntheticPhone}\tSynthetic salary\tSynthetic welfare\tSynthetic remark`,
].join("\n");

describe("manual paste parser", () => {
  it("parses key-value field text blocks", () => {
    const text = [
      "站点名称：Alpha Site",
      "地址：Alpha Road",
      "联系人：Manager A",
      `电话：${syntheticPhone}`,
      "备注：Synthetic remark",
      "",
      "site_name: Beta Site",
      "address: Beta Road",
    ].join("\n");

    const rows = previewManualPasteText(text);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.rowIndex).toBe(1);
    expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
    expect(rows[0]?.mapped.phone).toBe(syntheticPhone);
    expect(rows[1]?.rowIndex).toBe(7);
    expect(rows[1]?.mapped.siteName).toBe("Beta Site");
    expect(rows[0]?.mapped.source).toBe("manual_paste");
    expect(rows[0]?.mapped.originType).toBe("manual_paste");
  });

  it("parses TSV headers and maps Chinese aliases", () => {
    const rows = previewManualPasteText(validText);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
    expect(rows[0]?.mapped.address).toBe("Alpha Road");
    expect(rows[0]?.mapped.stationManager).toBe("Manager A");
    expect(rows[0]?.mapped.phone).toBe(syntheticPhone);
    expect(rows[0]?.status).toBe("valid");
  });

  it("skips empty rows", () => {
    const rows = previewManualPasteText(
      ["站点名称\t地址\t电话", "", `Alpha Site\tAlpha Road\t${syntheticPhone}`].join("\n"),
    );

    expect(rows).toHaveLength(1);
  });

  it("keeps TSV paste compatible with Task 002 behavior", () => {
    const text = ["站点名称\t地址\t电话", `Alpha Site\tAlpha Road\t${syntheticPhone}`].join("\n");

    const rows = previewManualPasteText(text);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowIndex).toBe(2);
    expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
    expect(rows[0]?.status).toBe("valid");
  });

  it("marks missing key fields as invalid", () => {
    const rows = previewManualPasteText(["站点名称\t地址\t电话", "\t\t12345"].join("\n"));

    expect(rows[0]?.status).toBe("invalid");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
  });

  it("marks same merge key and same hash as duplicate", () => {
    const first = previewManualPasteText(validText)[0];
    const existing = new Map<string, ExistingMarkerFingerprint>([
      [
        first?.mergeKey ?? "",
        {
          id: 1,
          currentHash: first?.currentHash ?? null,
        },
      ],
    ]);
    const rows = previewManualPasteText(validText, existing);

    expect(rows[0]?.status).toBe("duplicate");
  });

  it("marks same merge key and different hash as update candidate", () => {
    const first = previewManualPasteText(validText)[0];
    const existing = new Map<string, ExistingMarkerFingerprint>([
      [
        first?.mergeKey ?? "",
        {
          id: 1,
          currentHash: "different-hash",
        },
      ],
    ]);
    const rows = previewManualPasteText(validText, existing);

    expect(rows[0]?.status).toBe("update_candidate");
  });

  it("maps valid preview rows to importable clean markers", () => {
    const row = previewManualPasteText(validText)[0];
    const marker = row ? mapPreviewRowToCleanMarker(row) : null;

    expect(marker?.source).toBe("manual_paste");
    expect(marker?.syncAction).toBe("create");
    expect(marker?.syncStatus).toBe("pending");
    expect(marker?.manualOverride).toBe(true);
  });
});
