import { describe, expect, it } from "vitest";
import {
  formatYouzhaoContactField,
  formatYouzhaoDingmapRemark,
  mapBusinessLineToDingmapLayer,
  mapYouzhaoJobsToRawRows,
} from "./mapper";

const syntheticPhone = ["199", "0000", "0000"].join("");

describe("youzhao mapper", () => {
  it("maps one job to one RawImportRow without creating CleanMarker records", () => {
    const result = mapYouzhaoJobsToRawRows(
      [
        {
          id: "job-a",
          station_id: "site-1",
          site_name: "Synthetic Site",
          site_address: "Synthetic Road",
          station_master_name: "Manager A",
          station_master_phone: syntheticPhone,
          position_name: "Synthetic Job",
          salary_plan: "Synthetic salary",
          extra_policy: "Synthetic welfare",
          settlement_rule: "Synthetic settlement",
          business_line: "美团",
          recruitment_status: "1",
        },
      ],
      { city: "上海" },
    );

    expect(result.filteredNonRecruiting).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      rowIndex: 1,
      source: "youzhao",
      originType: "web",
      raw: {
        city: "上海",
        siteId: "site-1",
        jobId: "job-a",
        合作站点名称: "Synthetic Site",
        站点地址: "Synthetic Road",
        站长姓名: "Manager A",
        站长电话: syntheticPhone,
        岗位名称: "Synthetic Job",
        薪资方案: "Synthetic salary",
        新人政策: "Synthetic welfare",
        结算规则: "Synthetic settlement",
        业务线: "美团",
        招聘状态: "招聘中",
        targetLayer: "美团点",
        dingmapFieldOne: `Manager A ${syntheticPhone}`,
        dingmapFieldTwo: "Synthetic settlement",
      },
    });
    expect(result.rows[0]).not.toHaveProperty("siteName");
  });

  it("keeps two jobs from the same site as two raw rows", () => {
    const result = mapYouzhaoJobsToRawRows(
      [
        {
          id: "job-a",
          station_id: "site-1",
          site_name: "Synthetic Site",
          site_address: "Synthetic Road",
          position_name: "Job A",
          recruitment_status: "招聘中",
        },
        {
          id: "job-b",
          station_id: "site-1",
          site_name: "Synthetic Site",
          site_address: "Synthetic Road",
          position_name: "Job B",
          recruitment_status: "招聘中",
        },
      ],
      { city: "上海" },
    );

    expect(result.rows.map((row) => row.raw.jobId)).toEqual(["job-a", "job-b"]);
  });

  it("filters non recruiting jobs and records the filtered count", () => {
    const result = mapYouzhaoJobsToRawRows(
      [
        {
          id: "job-a",
          site_name: "Synthetic Site",
          recruitment_status: "招聘中",
        },
        {
          id: "job-b",
          site_name: "Synthetic Site",
          recruitment_status: "停止",
        },
      ],
      { city: "上海" },
    );

    expect(result.rows).toHaveLength(1);
    expect(result.filteredNonRecruiting).toBe(1);
  });

  it("formats DingMap helper fields without undefined titles or tight name-phone concatenation", () => {
    expect(formatYouzhaoContactField("Manager A", syntheticPhone)).toBe(`Manager A ${syntheticPhone}`);
    expect(formatYouzhaoContactField("Manager A", "")).toBe("Manager A");
    expect(formatYouzhaoContactField("", syntheticPhone)).toBe(syntheticPhone);
    expect(formatYouzhaoContactField("", "")).toBe("");

    expect(
      formatYouzhaoDingmapRemark({
        jobTitle: "Synthetic Job",
        salary: "Synthetic salary",
        welfare: "Synthetic welfare",
      }),
    ).toBe("【岗位名称】\nSynthetic Job\n\n【薪资方案】\nSynthetic salary\n\n【新人政策】\nSynthetic welfare");
    expect(formatYouzhaoDingmapRemark({ jobTitle: "", salary: "", welfare: "" })).toBe("");
  });

  it("maps business lines to fixed DingMap layers", () => {
    expect(mapBusinessLineToDingmapLayer("美团")).toBe("美团点");
    expect(mapBusinessLineToDingmapLayer("淘宝专送")).toBe("淘宝点");
    expect(mapBusinessLineToDingmapLayer(" 淘宝   UB ")).toBe("淘宝点");
    expect(mapBusinessLineToDingmapLayer("淘宝ub")).toBe("淘宝点");
    expect(mapBusinessLineToDingmapLayer("小象配送")).toBe("买菜点");
    expect(mapBusinessLineToDingmapLayer("叮咚")).toBe("买菜点");
    expect(mapBusinessLineToDingmapLayer("分拣员")).toBe("其他点");
    expect(mapBusinessLineToDingmapLayer("盒马")).toBe("商超点");
  });
});
