"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ListChecks,
  Loader2,
  MapPinned,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  Table2,
  Upload,
  XCircle,
} from "lucide-react";
import type { CleanMarker, ImportPreviewRow, ImportPreviewStatus } from "@dingmap-sync/shared";

const navItems = ["数据源", "Raw 数据", "Clean 数据", "同步计划", "导入", "日志", "设置"];

const sources = [
  { name: "优招", type: "网页来源插件", status: "预留", icon: Database },
  { name: "捷聘", type: "网页来源插件", status: "预留", icon: Database },
  { name: "钉图", type: "目标地图", status: "可导出", icon: MapPinned },
  { name: "字段文本 / TSV", type: "manual_paste", status: "可导入", icon: ClipboardPaste },
  { name: "Excel 导入", type: ".xlsx", status: "可导入", icon: FileSpreadsheet },
];

const statusLabels: Record<ImportPreviewStatus, string> = {
  valid: "可导入",
  invalid: "无效",
  duplicate: "重复",
  update_candidate: "待更新",
};

const statusClasses: Record<ImportPreviewStatus, string> = {
  valid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  invalid: "border-red-200 bg-red-50 text-red-700",
  duplicate: "border-slate-200 bg-slate-50 text-slate-600",
  update_candidate: "border-blue-200 bg-blue-50 text-blue-700",
};

interface PreviewSummary {
  valid: number;
  invalid: number;
  duplicate: number;
  update_candidate: number;
}

interface PreviewResponse {
  rows: ImportPreviewRow[];
  rawRows?: unknown[];
  summary: PreviewSummary;
  filename?: string;
  sheetNames?: string[];
  selectedSheetName?: string;
  error?: string;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  skippedOther: number;
  updateCandidate: number;
  cleanMarkers: CleanMarker[];
}

interface DingmapExportResult {
  filename: string;
  downloadUrl: string;
  exportedCount: number;
  skippedCount: number;
}

type DingmapUploadStatus =
  | "pending"
  | "opening_dingmap"
  | "requires_login"
  | "uploading"
  | "confirming"
  | "success"
  | "failed"
  | "blocked"
  | "timeout"
  | "unknown";

interface DingmapUploadJob {
  id: string;
  status: DingmapUploadStatus;
  filename: string;
  message: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  screenshotPath?: string;
  submitted?: boolean;
}

interface DingmapExportFileOption {
  filename: string;
  mtimeMs: number;
}

interface DingmapUploadStatusResponse {
  job: DingmapUploadJob | null;
  recentExports: DingmapExportFileOption[];
}

interface CleanMarkerManagementStatistics {
  activeCount: number;
  anomalyCount: number;
  deletedCount: number;
}

interface CleanMarkerManagementResponse {
  statistics: CleanMarkerManagementStatistics;
}

type LoadingState =
  | "paste-preview"
  | "paste-import"
  | "excel-preview"
  | "excel-import"
  | "clean"
  | "export"
  | "upload"
  | null;

const emptySummary: PreviewSummary = {
  valid: 0,
  invalid: 0,
  duplicate: 0,
  update_candidate: 0,
};

const uploadStatusLabels: Record<DingmapUploadStatus, string> = {
  pending: "等待上传",
  opening_dingmap: "正在打开钉图",
  requires_login: "需要手动登录",
  uploading: "正在上传文件",
  confirming: "正在确认导入",
  success: "上传成功",
  failed: "上传失败",
  blocked: "自动化受阻",
  timeout: "上传超时",
  unknown: "已提交，结果待人工确认",
};

const uploadActiveStatuses = new Set<DingmapUploadStatus>([
  "pending",
  "opening_dingmap",
  "uploading",
  "confirming",
]);

export default function DashboardPage() {
  const [pasteText, setPasteText] = useState("");
  const [pastePreviewRows, setPastePreviewRows] = useState<ImportPreviewRow[]>([]);
  const [pasteSummary, setPasteSummary] = useState<PreviewSummary>(emptySummary);
  const [pasteImportResult, setPasteImportResult] = useState<ImportResult | null>(null);

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelFilename, setExcelFilename] = useState("");
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([]);
  const [excelSelectedSheetName, setExcelSelectedSheetName] = useState("");
  const [excelRawRows, setExcelRawRows] = useState<unknown[]>([]);
  const [excelPreviewRows, setExcelPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [excelSummary, setExcelSummary] = useState<PreviewSummary>(emptySummary);
  const [excelImportResult, setExcelImportResult] = useState<ImportResult | null>(null);

  const [cleanMarkers, setCleanMarkers] = useState<CleanMarker[]>([]);
  const [managementStats, setManagementStats] =
    useState<CleanMarkerManagementStatistics | null>(null);
  const [dingmapExportResult, setDingmapExportResult] = useState<DingmapExportResult | null>(
    null,
  );
  const [uploadJob, setUploadJob] = useState<DingmapUploadJob | null>(null);
  const [recentExports, setRecentExports] = useState<DingmapExportFileOption[]>([]);
  const [selectedUploadFilename, setSelectedUploadFilename] = useState("");
  const [loading, setLoading] = useState<LoadingState>(null);
  const [pasteErrorMsg, setPasteErrorMsg] = useState<string | null>(null);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const pasteImportableCount = useMemo(
    () =>
      pastePreviewRows.filter((row) => row.status === "valid" || row.status === "update_candidate")
        .length,
    [pastePreviewRows],
  );
  const excelImportableCount = useMemo(
    () =>
      excelPreviewRows.filter((row) => row.status === "valid" || row.status === "update_candidate")
        .length,
    [excelPreviewRows],
  );

  const stats = [
    {
      label: "待新增",
      value: String(pasteSummary.valid + excelSummary.valid),
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "待更新",
      value: String(pasteSummary.update_candidate + excelSummary.update_candidate),
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      label: "重复",
      value: String(pasteSummary.duplicate + excelSummary.duplicate),
      tone: "border-slate-200 bg-slate-50 text-slate-700",
    },
    {
      label: "无效",
      value: String(pasteSummary.invalid + excelSummary.invalid),
      tone: "border-red-200 bg-red-50 text-red-700",
    },
    {
      label: "Clean Table",
      value: String(managementStats?.activeCount ?? cleanMarkers.length),
      tone: "border-slate-200 bg-white text-slate-800",
    },
  ];

  useEffect(() => {
    void loadCleanMarkers();
    void loadUploadStatus();
  }, []);

  useEffect(() => {
    if (!uploadJob || !uploadActiveStatuses.has(uploadJob.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadUploadStatus();
    }, 1500);

    return () => window.clearInterval(timer);
  }, [uploadJob?.id, uploadJob?.status]);

  async function loadCleanMarkers() {
    setLoading("clean");
    try {
      const [response, managementResponse] = await Promise.all([
        fetch("/api/clean-markers", { cache: "no-store" }),
        fetch("/api/clean-markers/manage?pageSize=1", { cache: "no-store" }),
      ]);
      const data = (await response.json()) as { cleanMarkers: CleanMarker[] };
      const managementData = (await managementResponse.json()) as CleanMarkerManagementResponse;
      setCleanMarkers(data.cleanMarkers);
      setManagementStats(managementData.statistics);
    } catch {
      setPasteErrorMsg("Clean Table 读取失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handlePastePreview() {
    setPasteErrorMsg(null);
    setPasteImportResult(null);
    setLoading("paste-preview");
    try {
      const response = await fetch("/api/manual-paste/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "生成预览失败。");
      }
      setPastePreviewRows(data.rows);
      setPasteSummary(data.summary);
    } catch (error) {
      setPasteErrorMsg(error instanceof Error ? error.message : "生成预览失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handlePasteImport() {
    setPasteErrorMsg(null);
    setLoading("paste-import");
    try {
      const response = await fetch("/api/manual-paste/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: pastePreviewRows }),
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "导入 Clean Table 失败。");
      }
      setPasteImportResult(data);
      setCleanMarkers(data.cleanMarkers);
      setPastePreviewRows([]);
      setPasteSummary(emptySummary);
      setPasteText("");
    } catch (error) {
      setPasteErrorMsg(error instanceof Error ? error.message : "导入 Clean Table 失败。");
    } finally {
      setLoading(null);
    }
  }

  function handlePasteClear() {
    setPasteText("");
    setPastePreviewRows([]);
    setPasteSummary(emptySummary);
    setPasteImportResult(null);
    setPasteErrorMsg(null);
  }

  function handleExcelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setExcelFile(file);
    setExcelFilename(file?.name ?? "");
    setExcelSheetNames([]);
    setExcelSelectedSheetName("");
    setExcelRawRows([]);
    setExcelPreviewRows([]);
    setExcelSummary(emptySummary);
    setExcelImportResult(null);
    setExcelErrorMsg(null);
  }

  async function handleExcelPreview() {
    if (!excelFile) {
      setExcelErrorMsg("请选择 .xlsx 文件。");
      return;
    }

    setExcelErrorMsg(null);
    setExcelImportResult(null);
    setLoading("excel-preview");
    try {
      const formData = new FormData();
      formData.set("file", excelFile);
      if (excelSelectedSheetName) {
        formData.set("sheetName", excelSelectedSheetName);
      }

      const response = await fetch("/api/excel/preview", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as PreviewResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Excel 预览失败。");
      }

      setExcelFilename(data.filename ?? excelFile.name);
      setExcelSheetNames(data.sheetNames ?? []);
      setExcelSelectedSheetName(data.selectedSheetName ?? "");
      setExcelRawRows(data.rawRows ?? []);
      setExcelPreviewRows(data.rows);
      setExcelSummary(data.summary);
    } catch (error) {
      setExcelErrorMsg(error instanceof Error ? error.message : "Excel 预览失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handleExcelImport() {
    setExcelErrorMsg(null);
    setLoading("excel-import");
    try {
      const response = await fetch("/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: excelRawRows }),
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Excel 导入 Clean Table 失败。");
      }

      setExcelImportResult(data);
      setCleanMarkers(data.cleanMarkers);
      setExcelRawRows([]);
      setExcelPreviewRows([]);
      setExcelSummary(emptySummary);
      setExcelFile(null);
      setExcelFilename("");
      setExcelSheetNames([]);
      setExcelSelectedSheetName("");
    } catch (error) {
      setExcelErrorMsg(error instanceof Error ? error.message : "Excel 导入 Clean Table 失败。");
    } finally {
      setLoading(null);
    }
  }

  function handleExcelClear() {
    setExcelFile(null);
    setExcelFilename("");
    setExcelSheetNames([]);
    setExcelSelectedSheetName("");
    setExcelRawRows([]);
    setExcelPreviewRows([]);
    setExcelSummary(emptySummary);
    setExcelImportResult(null);
    setExcelErrorMsg(null);
  }

  async function handleDingmapExport() {
    setExportErrorMsg(null);
    setDingmapExportResult(null);
    setLoading("export");
    try {
      const response = await fetch("/api/dingmap/export", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as DingmapExportResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "导出钉图模板失败。");
      }

      setDingmapExportResult(data);
      setSelectedUploadFilename(data.filename);
      await loadUploadStatus(data.filename);
    } catch (error) {
      setExportErrorMsg(error instanceof Error ? error.message : "导出钉图模板失败。");
    } finally {
      setLoading(null);
    }
  }

  async function loadUploadStatus(preferredFilename?: string) {
    try {
      const response = await fetch("/api/dingmap/upload/status", { cache: "no-store" });
      const data = (await response.json()) as DingmapUploadStatusResponse;

      setUploadJob(data.job);
      setRecentExports(data.recentExports);
      setSelectedUploadFilename((current) => {
        if (preferredFilename) {
          return preferredFilename;
        }

        if (data.job?.filename) {
          return data.job.filename;
        }

        if (current && data.recentExports.some((file) => file.filename === current)) {
          return current;
        }

        return data.recentExports[0]?.filename ?? "";
      });
    } catch {
      setUploadErrorMsg("读取钉图上传状态失败。");
    }
  }

  async function handleDingmapUpload() {
    setUploadErrorMsg(null);
    setLoading("upload");
    try {
      const response = await fetch("/api/dingmap/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedUploadFilename || undefined }),
      });
      const data = (await response.json()) as { job?: DingmapUploadJob; error?: string };
      if (!response.ok || !data.job) {
        throw new Error(data.error ?? "创建钉图上传任务失败。");
      }

      setUploadJob(data.job);
      await loadUploadStatus(data.job.filename);
    } catch (error) {
      setUploadErrorMsg(error instanceof Error ? error.message : "创建钉图上传任务失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handleDingmapUploadContinue() {
    setUploadErrorMsg(null);
    setLoading("upload");
    try {
      const response = await fetch("/api/dingmap/upload/continue", {
        method: "POST",
      });
      const data = (await response.json()) as { job?: DingmapUploadJob; error?: string };
      if (!response.ok || !data.job) {
        throw new Error(data.error ?? "继续钉图上传任务失败。");
      }

      setUploadJob(data.job);
    } catch (error) {
      setUploadErrorMsg(error instanceof Error ? error.message : "继续钉图上传任务失败。");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-page text-textMain">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MapPinned aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="truncate text-base font-semibold">DingMap Sync</span>
          </div>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
            {navItems.map((item) => (
              <button
                key={item}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-textSubtle hover:bg-tableHead hover:text-textMain"
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
          <button
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            type="button"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>执行同步</span>
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <button
              key={item}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-textSubtle hover:bg-tableHead hover:text-textMain"
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid min-w-0 max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <section className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={`rounded-card border p-4 shadow-sm ${stat.tone}`}
            >
              <p className="text-sm font-medium">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold leading-none">{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-panel p-4 shadow-sm">
          <div className="flex min-w-0 flex-wrap gap-2 text-sm">
            <ResultPill
              label="有效"
              value={managementStats?.activeCount ?? cleanMarkers.length}
              tone="text-slate-800"
            />
            <ResultPill
              label="异常"
              value={managementStats?.anomalyCount ?? 0}
              tone="text-amber-700"
            />
            <ResultPill
              label="已删除"
              value={managementStats?.deletedCount ?? 0}
              tone="text-slate-600"
            />
          </div>
          <a
            className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800"
            href="/data-management"
          >
            <Settings2 aria-hidden="true" className="h-4 w-4" />
            <span>管理已导入数据</span>
          </a>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {sources.map((source) => {
              const Icon = source.icon;
              return (
                <article
                  key={source.name}
                  className="rounded-card border border-line bg-panel p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-tableHead">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{source.name}</h2>
                        <p className="mt-1 truncate text-sm text-textSubtle">{source.type}</p>
                      </div>
                    </div>
                    <span className="whitespace-nowrap rounded-md border border-line px-2 py-1 text-xs text-textSubtle">
                      {source.status}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="grid min-w-0 gap-4">
            <ImportPanel
              errorMsg={pasteErrorMsg}
              importResult={pasteImportResult}
              importableCount={pasteImportableCount}
              loadingImport={loading === "paste-import"}
              loadingPreview={loading === "paste-preview"}
              onClear={handlePasteClear}
              onImport={handlePasteImport}
              onPreview={handlePastePreview}
              rows={pastePreviewRows}
              subtitle="manual_paste"
              title="字段文本 / TSV 导入"
            >
              <textarea
                className="h-40 w-full resize-none rounded-md border border-line bg-white p-3 text-sm outline-none placeholder:text-textWeak focus:border-zinc-400"
                onChange={(event) => setPasteText(event.target.value)}
                placeholder={"站点名称\t地址\t联系人\t电话\t薪资\t福利\t备注\nAlpha Site\tAlpha Road\tManager A\t..."}
                value={pasteText}
              />
            </ImportPanel>

            <ImportPanel
              errorMsg={excelErrorMsg}
              importResult={excelImportResult}
              importableCount={excelImportableCount}
              loadingImport={loading === "excel-import"}
              loadingPreview={loading === "excel-preview"}
              onClear={handleExcelClear}
              onImport={handleExcelImport}
              onPreview={handleExcelPreview}
              rows={excelPreviewRows}
              subtitle="excel"
              title="Excel 导入"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex min-h-24 cursor-pointer flex-col justify-center rounded-md border border-dashed border-line bg-white px-4 py-3 text-sm hover:bg-tableHead">
                  <span className="font-medium">选择 .xlsx 文件</span>
                  <span className="mt-1 text-textSubtle">{excelFilename || "未选择文件"}</span>
                  <input
                    accept=".xlsx"
                    className="sr-only"
                    onChange={handleExcelFileChange}
                    type="file"
                  />
                </label>
                {excelSheetNames.length > 0 ? (
                  <label className="flex min-w-52 flex-col gap-2 text-sm">
                    <span className="text-textSubtle">Sheet</span>
                    <select
                      className="h-10 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400"
                      onChange={(event) => setExcelSelectedSheetName(event.target.value)}
                      value={excelSelectedSheetName}
                    >
                      {excelSheetNames.map((sheetName) => (
                        <option key={sheetName} value={sheetName}>
                          {sheetName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </ImportPanel>
          </section>
        </section>

        <section className="min-w-0 rounded-card border border-line bg-panel p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">钉图模板导出</h2>
              <p className="mt-1 text-sm text-textSubtle">Clean Table to Sheet1</p>
            </div>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={loading === "export"}
              onClick={handleDingmapExport}
              type="button"
            >
              {loading === "export" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="h-4 w-4" />
              )}
              <span>导出钉图模板</span>
            </button>
          </div>

          {exportErrorMsg ? <ErrorBox message={exportErrorMsg} /> : null}

          {dingmapExportResult ? (
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-[1.2fr_0.5fr_0.5fr_auto]">
              <ResultPill label="文件" value={dingmapExportResult.filename} tone="text-slate-800" />
              <ResultPill
                label="导出"
                value={dingmapExportResult.exportedCount}
                tone="text-emerald-700"
              />
              <ResultPill
                label="跳过"
                value={dingmapExportResult.skippedCount}
                tone="text-slate-600"
              />
              <a
                className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-3 font-medium hover:bg-tableHead"
                download={dingmapExportResult.filename}
                href={dingmapExportResult.downloadUrl}
              >
                下载文件
              </a>
            </div>
          ) : null}

          <div className="mt-4 grid min-w-0 gap-3 border-t border-line pt-4 lg:grid-cols-[1fr_auto]">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-medium">上传文件</span>
                <select
                  className="h-10 min-w-0 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-tableHead"
                  disabled={recentExports.length === 0}
                  onChange={(event) => setSelectedUploadFilename(event.target.value)}
                  value={selectedUploadFilename}
                >
                  {recentExports.length === 0 ? (
                    <option value="">暂无导出文件</option>
                  ) : (
                    recentExports.map((file) => (
                      <option key={file.filename} value={file.filename}>
                        {file.filename}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
                href="https://dm.dingmap.com/home"
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                <span>打开钉图</span>
              </a>
            </div>

            <div className="flex flex-wrap items-end gap-2 lg:justify-end">
              {uploadJob?.status === "requires_login" ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  disabled={loading === "upload"}
                  onClick={handleDingmapUploadContinue}
                  type="button"
                >
                  {loading === "upload" ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span>继续上传</span>
                </button>
              ) : null}
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                disabled={
                  loading === "upload" ||
                  recentExports.length === 0 ||
                  Boolean(uploadJob && uploadActiveStatuses.has(uploadJob.status))
                }
                onClick={handleDingmapUpload}
                type="button"
              >
                {loading === "upload" ||
                Boolean(uploadJob && uploadActiveStatuses.has(uploadJob.status)) ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload aria-hidden="true" className="h-4 w-4" />
                )}
                <span>自动上传到钉图</span>
              </button>
            </div>
          </div>

          {uploadErrorMsg ? <ErrorBox message={uploadErrorMsg} /> : null}
          {uploadJob ? <DingmapUploadStatusPanel job={uploadJob} /> : null}
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-2">
          <PlaceholderTable
            columns={["来源", "标题", "地址", "解析状态", "抓取时间"]}
            icon={Table2}
            title="Raw Table"
          />
          <CleanMarkerTable cleanMarkers={cleanMarkers} loading={loading === "clean"} />
          <PlaceholderTable
            columns={["动作", "原因", "Before Hash", "After Hash", "状态"]}
            icon={ListChecks}
            title="Sync Plan"
          />
          <PlaceholderTable
            columns={["Run ID", "来源", "动作", "结果", "截图"]}
            icon={RefreshCw}
            title="Sync Logs"
          />
        </section>

        <section className="grid min-w-0 gap-3 sm:grid-cols-3">
          <StatusPill icon={CheckCircle2} label="成功" className="text-emerald-700" />
          <StatusPill icon={AlertTriangle} label="待确认" className="text-amber-700" />
          <StatusPill icon={XCircle} label="失败" className="text-red-700" />
        </section>
      </div>
    </main>
  );
}

function DingmapUploadStatusPanel({ job }: { job: DingmapUploadJob }) {
  return (
    <div className="mt-3 rounded-md border border-line bg-tableHead px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${getUploadStatusClass(
            job.status,
          )}`}
        >
          {uploadStatusLabels[job.status]}
        </span>
        <span className="min-w-0 truncate text-textSubtle">{job.filename}</span>
      </div>
      <p className="mt-2 text-textSubtle">{job.message}</p>
      {job.screenshotPath ? (
        <p className="mt-2 break-all text-textWeak">截图：{job.screenshotPath}</p>
      ) : null}
    </div>
  );
}

function getUploadStatusClass(status: DingmapUploadStatus): string {
  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "unknown" || status === "requires_login") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "failed" || status === "blocked" || status === "timeout") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function ImportPanel({
  children,
  errorMsg,
  importResult,
  importableCount,
  loadingImport,
  loadingPreview,
  onClear,
  onImport,
  onPreview,
  rows,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  errorMsg: string | null;
  importResult: ImportResult | null;
  importableCount: number;
  loadingImport: boolean;
  loadingPreview: boolean;
  onClear: () => void;
  onImport: () => void;
  onPreview: () => void;
  rows: ImportPreviewRow[];
  subtitle: string;
  title: string;
}) {
  return (
    <section className="min-w-0 rounded-card border border-line bg-panel p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-textSubtle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
            onClick={onClear}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            <span>清空</span>
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loadingPreview}
            onClick={onPreview}
            type="button"
          >
            {loadingPreview ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
            )}
            <span>生成预览</span>
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={loadingImport || importableCount === 0}
            onClick={onImport}
            type="button"
          >
            {loadingImport ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Upload aria-hidden="true" className="h-4 w-4" />
            )}
            <span>导入 Clean Table</span>
          </button>
        </div>
      </div>

      <div className="mt-4">{children}</div>

      {errorMsg ? <ErrorBox message={errorMsg} /> : null}

      {importResult ? (
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
          <ResultPill label="新增" value={importResult.inserted} tone="text-emerald-700" />
          <ResultPill label="更新" value={importResult.updated} tone="text-blue-700" />
          <ResultPill
            label="重复"
            value={importResult.skippedDuplicate}
            tone="text-slate-600"
          />
          <ResultPill label="无效" value={importResult.skippedInvalid} tone="text-red-700" />
          <ResultPill label="待更新" value={importResult.updateCandidate} tone="text-blue-700" />
        </div>
      ) : null}

      <PreviewTable rows={rows} />
    </section>
  );
}

function PreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  return (
    <section className="mt-4 min-w-0 overflow-hidden rounded-card border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold">识别预览</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {[
                "行号",
                "来源",
                "站点名称",
                "地址",
                "联系人",
                "电话",
                "薪资",
                "福利",
                "备注",
                "状态",
                "错误 / 警告",
              ].map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-textWeak" colSpan={11}>
                  暂无预览
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.source}-${row.rowIndex}-${row.mergeKey ?? "none"}`} className="border-t border-line">
                  <td className="px-4 py-3 text-textSubtle">{row.rowIndex}</td>
                  <td className="px-4 py-3 text-textSubtle">{row.source}</td>
                  <td className="px-4 py-3">{row.mapped.siteName || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.address || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.stationManager || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.phone || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.salary || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.welfare || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.remark || "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-textSubtle">
                    {[...row.errors, ...row.warnings].join("；") || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CleanMarkerTable({
  cleanMarkers,
  loading,
}: {
  cleanMarkers: CleanMarker[];
  loading: boolean;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-card border border-line bg-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
        <h2 className="text-base font-semibold">Clean Table</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {["站点名称", "地址", "联系人", "电话", "同步动作", "同步状态", "更新时间"].map(
                (column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {cleanMarkers.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-textWeak" colSpan={7}>
                  {loading ? "读取中" : "暂无数据"}
                </td>
              </tr>
            ) : (
              cleanMarkers.map((marker) => (
                <tr key={marker.id ?? marker.mergeKey ?? marker.siteName} className="border-t border-line">
                  <td className="px-4 py-3">{marker.siteName || "-"}</td>
                  <td className="px-4 py-3">{marker.address || "-"}</td>
                  <td className="px-4 py-3">{marker.stationManager || "-"}</td>
                  <td className="px-4 py-3">{marker.phone || "-"}</td>
                  <td className="px-4 py-3">{marker.syncAction}</td>
                  <td className="px-4 py-3">{marker.syncStatus}</td>
                  <td className="px-4 py-3 text-textSubtle">{marker.updatedAt || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlaceholderTable({
  columns,
  icon: Icon,
  title,
}: {
  columns: string[];
  icon: typeof Table2;
  title: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-card border border-line bg-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-5 text-textWeak" colSpan={columns.length}>
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: ImportPreviewStatus }) {
  return (
    <span className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function ResultPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-line bg-tableHead px-3 py-2">
      <span className="text-textSubtle">{label}</span>
      <span className={`ml-2 font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-card border border-line bg-panel px-4 py-3 text-sm shadow-sm">
      <Icon aria-hidden="true" className={`h-4 w-4 ${className}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
