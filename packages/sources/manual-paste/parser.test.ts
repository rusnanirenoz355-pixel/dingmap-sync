import { describe, expect, it } from "vitest";
import { mapPreviewRowToCleanMarker } from "./mapper";
import {
  previewManualPasteText,
  type ExistingMarkerFingerprint,
} from "./parser";

const validText = [
  "站点名称\t地址\t联系人\t电话\t薪资\t福利\t备注",
  "测试站点\t测试地址\t测试联系人\t19900000000\t测试薪资\t测试福利\t测试备注",
].join("\n");

describe("manual paste parser", () => {
  it("parses TSV headers and maps Chinese aliases", () => {
    const rows = previewManualPasteText(validText);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mapped.siteName).toBe("测试站点");
    expect(rows[0]?.mapped.address).toBe("测试地址");
    expect(rows[0]?.mapped.stationManager).toBe("测试联系人");
    expect(rows[0]?.mapped.phone).toBe("19900000000");
    expect(rows[0]?.status).toBe("valid");
  });

  it("skips empty rows", () => {
    const rows = previewManualPasteText(["站点名称\t地址\t电话", "", "测试站点\t测试地址\t19900000000"].join("\n"));

    expect(rows).toHaveLength(1);
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
