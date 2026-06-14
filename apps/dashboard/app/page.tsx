"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Database,
  Download,
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

interface YouzhaoOperationResult {
  status: string;
  authenticated?: boolean;
  diagnostics?: {
    requestMode?: string;
    httpStatus?: number;
    contentType?: string;
    finalStatus?: string;
  };
  total?: number | null;
  returned?: number;
  rawReturned?: number;
  filteredNonRecruiting?: number;
  rows?: ImportPreviewRow[];
  summary?: PreviewSummary;
  targetLayerCounts?: Record<string, number>;
  inserted?: number;
  updated?: number;
  skippedDuplicate?: number;
  skippedInvalid?: number;
  skippedOther?: number;
  updateCandidate?: number;
  cleanMarkers?: CleanMarker[];
  error?: string;
  message?: string;
}

interface YouzhaoExportGroup {
  targetLayer: string;
  rowCount: number;
  files: string[];
}

interface YouzhaoExportResult {
  city: string;
  totalRows: number;
  groups: YouzhaoExportGroup[];
  error?: string;
}

interface YouzhaoTaskState {
  city: string;
  mode: "smoke" | "full";
  status: string;
  currentPage: number;
  nextPage: number;
  pageSize: number;
  maxPages?: number;
  maxItems?: number;
  processedPages: number;
  processedItems: number;
  totalFromApi: number | null;
  counts: {
    imported: number;
    duplicate: number;
    update_candidate: number;
    invalid: number;
    filteredNonRecruiting: number;
  };
  targetLayerCounts: Record<string, number>;
  failedPages: Array<{ page: number; attempts: number; status: string }>;
  lastErrorStatus?: string;
  error?: string;
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
  | "youzhao-open"
  | "youzhao-check"
  | "youzhao-probe"
  | "youzhao-preview"
  | "youzhao-import"
  | "youzhao-export"
  | "youzhao-task-start"
  | "youzhao-task-pause"
  | "youzhao-task-resume"
  | "youzhao-task-cancel"
  | "youzhao-task-restart"
  | "clean"
  | "export"
  | null;

const emptySummary: PreviewSummary = {
  valid: 0,
  invalid: 0,
  duplicate: 0,
  update_candidate: 0,
};

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

  const [youzhaoCity, setYouzhaoCity] = useState("");
  const [youzhaoPage, setYouzhaoPage] = useState("1");
  const [youzhaoPageSize, setYouzhaoPageSize] = useState("20");
  const [youzhaoLimit, setYouzhaoLimit] = useState("50");
  const [youzhaoSessionStatus, setYouzhaoSessionStatus] = useState("未检查");
  const [youzhaoPreviewRows, setYouzhaoPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [youzhaoSummary, setYouzhaoSummary] = useState<PreviewSummary>(emptySummary);
  const [youzhaoResult, setYouzhaoResult] = useState<YouzhaoOperationResult | null>(null);
  const [youzhaoErrorMsg, setYouzhaoErrorMsg] = useState<string | null>(null);
  const [youzhaoExportResult, setYouzhaoExportResult] =
    useState<YouzhaoExportResult | null>(null);
  const [youzhaoExportErrorMsg, setYouzhaoExportErrorMsg] = useState<string | null>(null);
  const [youzhaoTask, setYouzhaoTask] = useState<YouzhaoTaskState | null>(null);

  const [cleanMarkers, setCleanMarkers] = useState<CleanMarker[]>([]);
  const [managementStats, setManagementStats] =
    useState<CleanMarkerManagementStatistics | null>(null);
  const [dingmapExportResult, setDingmapExportResult] = useState<DingmapExportResult | null>(
    null,
  );
  const [loading, setLoading] = useState<LoadingState>(null);
  const [pasteErrorMsg, setPasteErrorMsg] = useState<string | null>(null);
  const [excelErrorMsg, setExcelErrorMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);

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
  const youzhaoImportableCount = useMemo(
    () =>
      youzhaoPreviewRows.filter((row) => row.status === "valid" || row.status === "update_candidate")
        .length,
    [youzhaoPreviewRows],
  );
  const hasYouzhaoCleanData = useMemo(
    () => cleanMarkers.some((marker) => marker.source === "youzhao" && marker.originType === "web"),
    [cleanMarkers],
  );

  const stats = [
    {
      label: "待新增",
      value: String(pasteSummary.valid + excelSummary.valid + youzhaoSummary.valid),
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "待更新",
      value: String(
        pasteSummary.update_candidate + excelSummary.update_candidate + youzhaoSummary.update_candidate,
      ),
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      label: "重复",
      value: String(pasteSummary.duplicate + excelSummary.duplicate + youzhaoSummary.duplicate),
      tone: "border-slate-200 bg-slate-50 text-slate-700",
    },
    {
      label: "无效",
      value: String(pasteSummary.invalid + excelSummary.invalid + youzhaoSummary.invalid),
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
    void loadYouzhaoTask();
  }, []);

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

  function buildYouzhaoParams() {
    return {
      city: youzhaoCity,
      page: Number(youzhaoPage),
      pageSize: Number(youzhaoPageSize),
      limit: Number(youzhaoLimit),
    };
  }

  async function handleYouzhaoOpen() {
    setYouzhaoErrorMsg(null);
    setLoading("youzhao-open");
    try {
      const response = await fetch("/api/youzhao/session/open", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json()) as YouzhaoOperationResult;
      if (!response.ok) {
        throw new Error(data.error ?? "打开优招登录窗口失败。");
      }
      setYouzhaoSessionStatus(data.status);
      setYouzhaoResult(data);
    } catch (error) {
      setYouzhaoErrorMsg(error instanceof Error ? error.message : "打开优招登录窗口失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handleYouzhaoCheck() {
    setYouzhaoErrorMsg(null);
    setYouzhaoSessionStatus("checking...");
    setLoading("youzhao-check");
    try {
      const response = await fetch("/api/youzhao/session/check", {
        cache: "no-store",
      });
      const data = (await response.json()) as YouzhaoOperationResult;
      setYouzhaoSessionStatus(data.status);
      setYouzhaoResult(data);
      if (!response.ok || data.status !== "authenticated") {
        setYouzhaoErrorMsg(formatYouzhaoFailure("Login status check failed", response, data, "session-check"));
      }
    } catch (error) {
      setYouzhaoSessionStatus("failed");
      setYouzhaoErrorMsg(error instanceof Error ? error.message : "检查优招登录状态失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handleYouzhaoProbe() {
    await requestYouzhaoCollection("/api/youzhao/probe", "youzhao-probe");
  }

  async function handleYouzhaoPreview() {
    const data = await requestYouzhaoCollection("/api/youzhao/preview", "youzhao-preview");
    if (data?.rows && data.summary) {
      setYouzhaoPreviewRows(data.rows);
      setYouzhaoSummary(data.summary);
    }
  }

  async function handleYouzhaoImport() {
    const data = await requestYouzhaoCollection("/api/youzhao/import", "youzhao-import");
    if (data?.cleanMarkers) {
      setCleanMarkers(data.cleanMarkers);
      setYouzhaoPreviewRows([]);
      setYouzhaoSummary(emptySummary);
      void loadCleanMarkers();
    }
  }

  async function handleYouzhaoExport(partial = false) {
    setYouzhaoExportErrorMsg(null);
    setYouzhaoExportResult(null);
    setLoading("youzhao-export");
    try {
      const response = await fetch("/api/youzhao/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial ? { city: youzhaoCity, partial: true } : { city: youzhaoCity }),
      });
      const data = (await response.json()) as YouzhaoExportResult;
      if (!response.ok) {
        throw new Error(data.error ?? "优招钉图 Excel 导出失败。");
      }
      setYouzhaoExportResult(data);
    } catch (error) {
      setYouzhaoExportErrorMsg(error instanceof Error ? error.message : "优招钉图 Excel 导出失败。");
    } finally {
      setLoading(null);
    }
  }

  async function loadYouzhaoTask() {
    try {
      const response = await fetch("/api/youzhao/tasks/current", { cache: "no-store" });
      const data = (await response.json()) as YouzhaoTaskState;
      if (response.ok) {
        setYouzhaoTask(data);
      }
    } catch {
      // Keep the normal dashboard usable when no task state is available.
    }
  }

  async function handleYouzhaoTaskSmokeStart() {
    await requestYouzhaoTask("/api/youzhao/tasks/start", "youzhao-task-start", {
      city: youzhaoCity,
      mode: "smoke",
    });
  }

  async function handleYouzhaoTaskFullStart() {
    const city = youzhaoCity.trim();
    const confirmedTotal = youzhaoResult?.total ?? youzhaoTask?.totalFromApi;
    if (!city) {
      setYouzhaoErrorMsg("请先选择一个城市。");
      return;
    }
    if (!Number.isFinite(confirmedTotal ?? NaN)) {
      setYouzhaoErrorMsg("请先探测接口，确认当前城市 API 总数后再启动 full。");
      return;
    }
    const confirmed = window.confirm(
      `确认启动 full：城市 ${city}，API 总数 ${confirmedTotal}。full 会采集当前城市全部招聘中岗位。`,
    );
    if (!confirmed) {
      return;
    }
    await requestYouzhaoTask("/api/youzhao/tasks/start", "youzhao-task-start", {
      city,
      mode: "full",
      confirmed: true,
      confirmedTotal,
      pageSize: Number(youzhaoPageSize),
    });
  }

  async function handleYouzhaoTaskPause() {
    await requestYouzhaoTask("/api/youzhao/tasks/pause", "youzhao-task-pause", { city: youzhaoCity });
  }

  async function handleYouzhaoTaskResume() {
    await requestYouzhaoTask("/api/youzhao/tasks/resume", "youzhao-task-resume", { city: youzhaoCity });
  }

  async function handleYouzhaoTaskCancel() {
    await requestYouzhaoTask("/api/youzhao/tasks/cancel", "youzhao-task-cancel", { city: youzhaoCity });
  }

  async function handleYouzhaoTaskRestart() {
    const city = youzhaoCity.trim();
    if (!city) {
      setYouzhaoErrorMsg("请先选择一个城市。");
      return;
    }
    const confirmed = window.confirm(`确认重启任务：城市 ${city}。仅删除当前城市 checkpoint，不删除数据库数据。`);
    if (!confirmed) {
      return;
    }
    await requestYouzhaoTask("/api/youzhao/tasks/restart", "youzhao-task-restart", {
      city,
      confirmed: true,
    });
  }

  async function requestYouzhaoTask(
    endpoint: string,
    loadingState: Exclude<LoadingState, null>,
    body: Record<string, unknown>,
  ): Promise<YouzhaoTaskState | null> {
    setYouzhaoErrorMsg(null);
    setLoading(loadingState);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as YouzhaoTaskState;
      setYouzhaoTask(data);
      if (!response.ok && data.status !== "count_mismatch") {
        throw new Error(data.error ?? data.lastErrorStatus ?? `优招任务失败：${data.status}`);
      }
      if (["smoke_completed", "completed", "count_mismatch", "paused", "cancelled"].includes(data.status)) {
        void loadCleanMarkers();
      }
      return data;
    } catch (error) {
      setYouzhaoErrorMsg(error instanceof Error ? error.message : "优招任务失败。");
      return null;
    } finally {
      setLoading(null);
    }
  }

  async function requestYouzhaoCollection(
    endpoint: string,
    loadingState: Exclude<LoadingState, null>,
  ): Promise<YouzhaoOperationResult | null> {
    setYouzhaoErrorMsg(null);
    setLoading(loadingState);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildYouzhaoParams()),
      });
      const data = (await response.json()) as YouzhaoOperationResult;
      if (!response.ok) {
        setYouzhaoResult(data);
        throw new Error(formatYouzhaoFailure("Youzhao collection failed", response, data, stageForYouzhaoLoading(loadingState)));
      }
      setYouzhaoResult(data);
      return data;
    } catch (error) {
      setYouzhaoErrorMsg(error instanceof Error ? error.message : "优招采集失败。");
      return null;
    } finally {
      setLoading(null);
    }
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
    } catch (error) {
      setExportErrorMsg(error instanceof Error ? error.message : "导出钉图模板失败。");
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

        <YouzhaoPanel
          city={youzhaoCity}
          errorMsg={youzhaoErrorMsg}
          exportErrorMsg={youzhaoExportErrorMsg}
          exportResult={youzhaoExportResult}
          hasCleanData={hasYouzhaoCleanData}
          importableCount={youzhaoImportableCount}
          limit={youzhaoLimit}
          loading={loading}
          onCheck={handleYouzhaoCheck}
          onCityChange={setYouzhaoCity}
          onExport={handleYouzhaoExport}
          onImport={handleYouzhaoImport}
          onLimitChange={setYouzhaoLimit}
          onOpen={handleYouzhaoOpen}
          onPageChange={setYouzhaoPage}
          onPageSizeChange={setYouzhaoPageSize}
          onPreview={handleYouzhaoPreview}
          onProbe={handleYouzhaoProbe}
          onTaskCancel={handleYouzhaoTaskCancel}
          onTaskFullStart={handleYouzhaoTaskFullStart}
          onTaskPause={handleYouzhaoTaskPause}
          onTaskRestart={handleYouzhaoTaskRestart}
          onTaskResume={handleYouzhaoTaskResume}
          onTaskSmokeStart={handleYouzhaoTaskSmokeStart}
          page={youzhaoPage}
          pageSize={youzhaoPageSize}
          result={youzhaoResult}
          rows={youzhaoPreviewRows}
          sessionStatus={youzhaoSessionStatus}
          summary={youzhaoSummary}
          task={youzhaoTask}
        />

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

function formatYouzhaoFailure(
  prefix: string,
  response: Response,
  data: YouzhaoOperationResult,
  stage: string,
): string {
  const diagnostics = data.diagnostics;
  const status = data.status ?? diagnostics?.finalStatus ?? "failed";
  const statusDescription = describeYouzhaoStatus(status);
  const lines = [
    `${prefix}: ${status}${statusDescription ? ` (${statusDescription})` : ""}`,
    `HTTP status: ${diagnostics?.httpStatus ?? response.status}`,
    `Request mode: ${diagnostics?.requestMode ?? "unknown"}`,
    `Stage: ${stage}`,
  ];
  if (diagnostics?.contentType) {
    lines.push(`Content-Type: ${diagnostics.contentType}`);
  }
  if (data.message) {
    lines.push(`Message: ${data.message}`);
  }
  if (data.error && data.error !== data.message) {
    lines.push(`Error: ${data.error}`);
  }
  return lines.join("\n");
}

function describeYouzhaoStatus(status: string): string {
  if (status === "requires_login") {
    return "未登录";
  }
  if (status === "auth_mechanism_unknown") {
    return "已登录，但接口认证机制尚未识别";
  }
  if (status === "auth_failed") {
    return "接口认证失败";
  }
  if (status === "forbidden") {
    return "权限不足";
  }
  if (status === "schema_changed") {
    return "接口结构变化";
  }
  return "";
}

function stageForYouzhaoLoading(loadingState: Exclude<LoadingState, null>): string {
  if (loadingState === "youzhao-probe") {
    return "probe";
  }
  if (loadingState === "youzhao-preview") {
    return "preview";
  }
  if (loadingState === "youzhao-import") {
    return "import";
  }
  return loadingState;
}

function YouzhaoPanel({
  city,
  errorMsg,
  exportErrorMsg,
  exportResult,
  hasCleanData,
  importableCount,
  limit,
  loading,
  onCheck,
  onCityChange,
  onExport,
  onImport,
  onLimitChange,
  onOpen,
  onPageChange,
  onPageSizeChange,
  onPreview,
  onProbe,
  onTaskCancel,
  onTaskFullStart,
  onTaskPause,
  onTaskRestart,
  onTaskResume,
  onTaskSmokeStart,
  page,
  pageSize,
  result,
  rows,
  sessionStatus,
  summary,
  task,
}: {
  city: string;
  errorMsg: string | null;
  exportErrorMsg: string | null;
  exportResult: YouzhaoExportResult | null;
  hasCleanData: boolean;
  importableCount: number;
  limit: string;
  loading: LoadingState;
  onCheck: () => void;
  onCityChange: (value: string) => void;
  onExport: (partial?: boolean) => void;
  onImport: () => void;
  onLimitChange: (value: string) => void;
  onOpen: () => void;
  onPageChange: (value: string) => void;
  onPageSizeChange: (value: string) => void;
  onPreview: () => void;
  onProbe: () => void;
  onTaskCancel: () => void;
  onTaskFullStart: () => void;
  onTaskPause: () => void;
  onTaskRestart: () => void;
  onTaskResume: () => void;
  onTaskSmokeStart: () => void;
  page: string;
  pageSize: string;
  result: YouzhaoOperationResult | null;
  rows: ImportPreviewRow[];
  sessionStatus: string;
  summary: PreviewSummary;
  task: YouzhaoTaskState | null;
}) {
  const targetLayerCounts = result?.targetLayerCounts ?? {};

  return (
    <section className="min-w-0 rounded-card border border-line bg-panel p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">优招采集</h2>
          <p className="mt-1 text-sm text-textSubtle">youzhao / web</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading === "youzhao-open"}
            onClick={onOpen}
            type="button"
          >
            {loading === "youzhao-open" ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="h-4 w-4" />
            )}
            <span>打开优招登录</span>
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading === "youzhao-check"}
            onClick={onCheck}
            type="button"
          >
            {loading === "youzhao-check" ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
            )}
            <span>检查登录状态</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="text-textSubtle">城市</span>
          <input
            className="h-10 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400"
            onChange={(event) => onCityChange(event.target.value)}
            placeholder="上海"
            value={city}
          />
        </label>
        <NumberField label="起始页" max={9999} min={1} onChange={onPageChange} value={page} />
        <NumberField label="每页数量" max={50} min={1} onChange={onPageSizeChange} value={pageSize} />
        <NumberField label="采集数量" max={100} min={20} onChange={onLimitChange} value={limit} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading === "youzhao-probe"}
          onClick={onProbe}
          type="button"
        >
          {loading === "youzhao-probe" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Database aria-hidden="true" className="h-4 w-4" />
          )}
          <span>探测接口</span>
        </button>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading === "youzhao-preview"}
          onClick={onPreview}
          type="button"
        >
          {loading === "youzhao-preview" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
          )}
          <span>生成预览</span>
        </button>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={loading === "youzhao-import" || importableCount === 0}
          onClick={onImport}
          type="button"
        >
          {loading === "youzhao-import" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="h-4 w-4" />
          )}
          <span>导入 Clean Table</span>
        </button>
      </div>

      {errorMsg ? <ErrorBox message={errorMsg} /> : null}

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ResultPill label="登录状态" value={sessionStatus} tone="text-slate-800" />
        <ResultPill label="请求条数" value={result?.rawReturned ?? result?.returned ?? 0} tone="text-slate-800" />
        <ResultPill label="招聘中" value={(result?.rawReturned ?? 0) - (result?.filteredNonRecruiting ?? 0)} tone="text-emerald-700" />
        <ResultPill label="过滤" value={result?.filteredNonRecruiting ?? 0} tone="text-slate-600" />
        <ResultPill label="可导入" value={summary.valid} tone="text-emerald-700" />
        <ResultPill label="重复" value={summary.duplicate} tone="text-slate-600" />
        <ResultPill label="待更新" value={summary.update_candidate} tone="text-blue-700" />
        <ResultPill label="无效" value={summary.invalid} tone="text-red-700" />
      </div>

      {Object.keys(targetLayerCounts).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {Object.entries(targetLayerCounts).map(([layer, count]) => (
            <ResultPill key={layer} label={layer} value={count} tone="text-slate-800" />
          ))}
        </div>
      ) : null}

      <section className="mt-4 rounded-card border border-line bg-white p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">单城市采集任务</h3>
            <p className="mt-1 text-sm text-textSubtle">
              smoke 固定最多 2 页 / 40 条；暂停或取消将在当前页处理完成后生效
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={loading === "youzhao-task-start" || !city.trim()}
              onClick={onTaskSmokeStart}
              type="button"
            >
              {loading === "youzhao-task-start" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="h-4 w-4" />
              )}
              <span>启动 smoke</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-task-start" || !city.trim()}
              onClick={onTaskFullStart}
              type="button"
            >
              <Play aria-hidden="true" className="h-4 w-4" />
              <span>启动 full</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-task-pause" || !city.trim()}
              onClick={onTaskPause}
              type="button"
            >
              <span>暂停任务</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-task-resume" || !city.trim()}
              onClick={onTaskResume}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              <span>继续任务</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-task-cancel" || !city.trim()}
              onClick={onTaskCancel}
              type="button"
            >
              <XCircle aria-hidden="true" className="h-4 w-4" />
              <span>取消任务</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-task-restart" || !city.trim()}
              onClick={onTaskRestart}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              <span>重启任务</span>
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <ResultPill label="任务状态" value={task?.status ?? "idle"} tone="text-slate-800" />
          <ResultPill label="模式" value={task?.mode ?? "smoke"} tone="text-slate-800" />
          <ResultPill label="已处理页" value={task?.processedPages ?? 0} tone="text-blue-700" />
          <ResultPill label="已处理条" value={task?.processedItems ?? 0} tone="text-emerald-700" />
          <ResultPill label="新增" value={task?.counts.imported ?? 0} tone="text-emerald-700" />
          <ResultPill label="重复" value={task?.counts.duplicate ?? 0} tone="text-slate-600" />
          <ResultPill label="待更新" value={task?.counts.update_candidate ?? 0} tone="text-blue-700" />
          <ResultPill label="无效" value={task?.counts.invalid ?? 0} tone="text-red-700" />
        </div>
        {task && Object.keys(task.targetLayerCounts).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {Object.entries(task.targetLayerCounts).map(([layer, count]) => (
              <ResultPill key={layer} label={layer} value={count} tone="text-slate-800" />
            ))}
          </div>
        ) : null}
      </section>

      {typeof result?.inserted === "number" ? (
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-5">
          <ResultPill label="新增" value={result.inserted} tone="text-emerald-700" />
          <ResultPill label="更新" value={result.updated ?? 0} tone="text-blue-700" />
          <ResultPill label="重复" value={result.skippedDuplicate ?? 0} tone="text-slate-600" />
          <ResultPill label="无效" value={result.skippedInvalid ?? 0} tone="text-red-700" />
          <ResultPill label="跳过" value={result.skippedOther ?? 0} tone="text-slate-600" />
        </div>
      ) : null}

      <section className="mt-4 rounded-card border border-line bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">导出钉图 Excel</h3>
            <p className="mt-1 text-sm text-textSubtle">
              当前城市：{city.trim() || "未选择"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading === "youzhao-export" || !city.trim() || !hasCleanData}
              onClick={() => onExport(true)}
              type="button"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              <span>部分数据导出</span>
            </button>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              disabled={loading === "youzhao-export" || !city.trim() || !hasCleanData}
              onClick={() => onExport()}
              type="button"
            >
              {loading === "youzhao-export" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="h-4 w-4" />
              )}
              <span>导出钉图 Excel</span>
            </button>
          </div>
        </div>

        {exportErrorMsg ? <ErrorBox message={exportErrorMsg} /> : null}

        {exportResult ? (
          <div className="mt-3 grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <ResultPill label="当前城市" value={exportResult.city} tone="text-slate-800" />
              <ResultPill label="导出总数" value={exportResult.totalRows} tone="text-emerald-700" />
              <ResultPill
                label="生成文件"
                value={exportResult.groups.reduce((total, group) => total + group.files.length, 0)}
                tone="text-blue-700"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-tableHead text-textSubtle">
                  <tr>
                    {["目标钉图图层", "条数", "生成文件", "下载"].map((column) => (
                      <th key={column} className="px-3 py-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportResult.groups.map((group) => (
                    <tr key={group.targetLayer} className="border-t border-line">
                      <td className="px-3 py-2">{group.targetLayer}</td>
                      <td className="px-3 py-2">{group.rowCount}</td>
                      <td className="px-3 py-2">{group.files.length}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {group.files.map((file) => (
                            <a
                              key={file}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-white px-2 text-xs font-medium hover:bg-tableHead"
                              download={file}
                              href={`/api/dingmap/download/${encodeURIComponent(file)}`}
                            >
                              <Download aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>下载</span>
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <PreviewTable rows={rows} />
    </section>
  );
}

function NumberField({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-textSubtle">{label}</span>
      <input
        className="h-10 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  );
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
  const showDingmapPreview = rows.some((row) => row.source === "youzhao");

  return (
    <section className="mt-4 min-w-0 overflow-hidden rounded-card border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold">识别预览</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1580px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {[
                "行号",
                "来源",
                "合作站点名称",
                "站点地址",
                "岗位名称",
                "站长姓名",
                "站长电话",
                "薪资方案",
                "新人政策",
                "结算规则",
                "原始业务线",
                "目标钉图图层",
                "sourceId",
                "preview 状态",
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
                <td className="px-4 py-5 text-textWeak" colSpan={15}>
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
                  <td className="px-4 py-3">{row.mapped.jobTitle || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.stationManager || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.phone || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.salary || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.welfare || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.remark || "-"}</td>
                  <td className="px-4 py-3">{row.raw.businessLine || row.raw["业务线"] || "-"}</td>
                  <td className="px-4 py-3">{row.targetLayer || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.sourceId || "-"}</td>
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
      {showDingmapPreview ? <DingmapSevenColumnPreview rows={rows} /> : null}
    </section>
  );
}

function DingmapSevenColumnPreview({ rows }: { rows: ImportPreviewRow[] }) {
  const youzhaoRows = rows.filter((row) => row.source === "youzhao");

  return (
    <div className="border-t border-line">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">钉图七列预览</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {["标记名称", "详细地址", "经度", "纬度", "备注", "字段一", "字段二"].map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {youzhaoRows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-textWeak" colSpan={7}>
                  暂无预览
                </td>
              </tr>
            ) : (
              youzhaoRows.map((row) => (
                <tr key={`dingmap-${row.rowIndex}-${row.mergeKey ?? "none"}`} className="border-t border-line">
                  <td className="px-4 py-3">{row.mapped.siteName || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.address || "-"}</td>
                  <td className="px-4 py-3">{row.mapped.longitude ?? ""}</td>
                  <td className="px-4 py-3">{row.mapped.latitude ?? ""}</td>
                  <td className="whitespace-pre-line px-4 py-3">{row.dingmapRemark || "-"}</td>
                  <td className="px-4 py-3">{row.dingmapFieldOne || "-"}</td>
                  <td className="px-4 py-3">{row.dingmapFieldTwo || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <div className="mt-3 whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
