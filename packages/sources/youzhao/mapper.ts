import { normalizeText } from "../../normalizer/normalize-text";
import type { RawImportRow } from "../import-pipeline";

export type DingmapTargetLayer = "美团点" | "淘宝点" | "买菜点" | "其他点" | "商超点";

export interface YouzhaoRawRow {
  id?: unknown;
  job_id?: unknown;
  position_id?: unknown;
  station_id?: unknown;
  site_id?: unknown;
  site_name?: unknown;
  site_address?: unknown;
  station_master_name?: unknown;
  station_master_phone?: unknown;
  position_name?: unknown;
  salary_plan?: unknown;
  extra_policy?: unknown;
  settlement_rule?: unknown;
  business_line?: unknown;
  recruitment_status?: unknown;
  status?: unknown;
}

export interface YouzhaoMapOptions {
  city: string;
}

export interface YouzhaoMapResult {
  rows: RawImportRow[];
  filteredNonRecruiting: number;
}

export function mapYouzhaoJobsToRawRows(
  jobs: YouzhaoRawRow[],
  options: YouzhaoMapOptions,
): YouzhaoMapResult {
  const rows: RawImportRow[] = [];
  let filteredNonRecruiting = 0;

  jobs.forEach((job, index) => {
    const recruitmentStatus = normalizeRecruitmentStatus(job.recruitment_status ?? job.status);
    if (recruitmentStatus !== "招聘中") {
      filteredNonRecruiting += 1;
      return;
    }

    rows.push(mapYouzhaoJobToRawRow(job, {
      city: options.city,
      rowIndex: index + 1,
      recruitmentStatus,
    }));
  });

  return { rows, filteredNonRecruiting };
}

export function mapYouzhaoJobToRawRow(
  job: YouzhaoRawRow,
  options: YouzhaoMapOptions & { rowIndex: number; recruitmentStatus?: string },
): RawImportRow {
  const siteId = toText(job.station_id ?? job.site_id);
  const jobId = toText(job.id ?? job.job_id ?? job.position_id);
  const siteName = toText(job.site_name);
  const address = toText(job.site_address);
  const stationManager = toText(job.station_master_name);
  const phone = toText(job.station_master_phone);
  const jobTitle = toText(job.position_name);
  const salary = toText(job.salary_plan);
  const welfare = toText(job.extra_policy);
  const settlementRule = toText(job.settlement_rule);
  const businessLine = toText(job.business_line);
  const targetLayer = mapBusinessLineToDingmapLayer(businessLine);

  const raw: Record<string, string> = {
    city: normalizeText(options.city),
    businessLine,
    recruitmentStatus: options.recruitmentStatus ?? normalizeRecruitmentStatus(job.recruitment_status ?? job.status),
    siteId,
    jobId,
    合作站点名称: siteName,
    站点地址: address,
    站长姓名: stationManager,
    站长电话: phone,
    岗位名称: jobTitle,
    薪资方案: salary,
    新人政策: welfare,
    结算规则: settlementRule,
    业务线: businessLine,
    招聘状态: options.recruitmentStatus ?? normalizeRecruitmentStatus(job.recruitment_status ?? job.status),
    targetLayer,
    dingmapRemark: formatYouzhaoDingmapRemark({ jobTitle, salary, welfare }),
    dingmapFieldOne: formatYouzhaoContactField(stationManager, phone),
    dingmapFieldTwo: settlementRule,
  };

  return {
    rowIndex: options.rowIndex,
    source: "youzhao",
    originType: "web",
    rawText: JSON.stringify(raw),
    raw,
  };
}

export function mapBusinessLineToDingmapLayer(value: unknown): DingmapTargetLayer {
  const normalized = normalizeBusinessLine(value);
  if (normalized.includes("美团")) {
    return "美团点";
  }
  if (normalized.includes("淘宝专送") || normalized.includes("淘宝ub")) {
    return "淘宝点";
  }
  if (normalized.includes("小象配送") || normalized.includes("叮咚")) {
    return "买菜点";
  }
  if (normalized.includes("分拣员")) {
    return "其他点";
  }
  return "商超点";
}

export function formatYouzhaoContactField(name: unknown, phone: unknown): string {
  return [normalizeText(name), normalizeText(phone)].filter(Boolean).join(" ");
}

export function formatYouzhaoDingmapRemark(input: {
  jobTitle?: unknown;
  salary?: unknown;
  welfare?: unknown;
}): string {
  const sections = [
    ["岗位名称", normalizeText(input.jobTitle)],
    ["薪资方案", normalizeText(input.salary)],
    ["新人政策", normalizeText(input.welfare)],
  ].filter((section): section is [string, string] => Boolean(section[1]));

  return sections.map(([title, value]) => `【${title}】\n${value}`).join("\n\n");
}

export function normalizeRecruitmentStatus(value: unknown): string {
  const normalized = normalizeText(value).replace(/\s+/g, "").toLowerCase();
  return normalized === "1" || normalized === "招聘中" ? "招聘中" : normalizeText(value);
}

function normalizeBusinessLine(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "").toLowerCase();
}

function toText(value: unknown): string {
  return normalizeText(value);
}
