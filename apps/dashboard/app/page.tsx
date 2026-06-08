"use client";

import { useEffect, useMemo, useState } from "react";
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
  Table2,
  Upload,
  XCircle,
} from "lucide-react";
import type { CleanMarker, ImportPreviewRow, ImportPreviewStatus } from "@dingmap-sync/shared";

const navItems = ["数据源", "Raw 数据", "Clean 数据", "同步计划", "粘贴导入", "日志", "设置"];

const sources = [
  { name: "优招", type: "网页来源插件", status: "预留", icon: Database },
  { name: "捷聘", type: "网页来源插件", status: "预留", icon: Database },
  { name: "钉图", type: "目标地图", status: "导出优先", icon: MapPinned },
  { name: "手动粘贴", type: "manual_paste", status: "可导入", icon: ClipboardPaste },
  { name: "Excel 导入", type: "表格文本", status: "TSV", icon: FileSpreadsheet },
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
  summary: PreviewSummary;
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

const emptySummary: PreviewSummary = {
  valid: 0,
  invalid: 0,
  duplicate: 0,
  update_candidate: 0,
};

export default function DashboardPage() {
  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [summary, setSummary] = useState<PreviewSummary>(emptySummary);
  const [cleanMarkers, setCleanMarkers] = useState<CleanMarker[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dingmapExportResult, setDingmapExportResult] = useState<DingmapExportResult | null>(
    null,
  );
  const [loading, setLoading] = useState<"preview" | "import" | "clean" | "export" | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportErrorMsg, setExportErrorMsg] = useState<string | null>(null);

  const importableCount = useMemo(
    () => previewRows.filter((row) => row.status === "valid" || row.status === "update_candidate").length,
    [previewRows],
  );

  const stats = [
    {
      label: "待新增",
      value: String(summary.valid),
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "待更新",
      value: String(summary.update_candidate),
      tone: "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      label: "疑似下架",
      value: "0",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "失败",
      value: String(summary.invalid),
      tone: "border-red-200 bg-red-50 text-red-700",
    },
    {
      label: "已导入",
      value: String(cleanMarkers.length),
      tone: "border-slate-200 bg-white text-slate-800",
    },
  ];

  useEffect(() => {
    void loadCleanMarkers();
  }, []);

  async function loadCleanMarkers() {
    setLoading("clean");
    try {
      const response = await fetch("/api/clean-markers", { cache: "no-store" });
      const data = (await response.json()) as { cleanMarkers: CleanMarker[] };
      setCleanMarkers(data.cleanMarkers);
    } catch {
      setErrorMsg("Clean Table 读取失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handlePreview() {
    setErrorMsg(null);
    setImportResult(null);
    setLoading("preview");
    try {
      const response = await fetch("/api/manual-paste/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = (await response.json()) as PreviewResponse;
      setPreviewRows(data.rows);
      setSummary(data.summary);
    } catch {
      setErrorMsg("生成预览失败。");
    } finally {
      setLoading(null);
    }
  }

  async function handleImport() {
    setErrorMsg(null);
    setLoading("import");
    try {
      const response = await fetch("/api/manual-paste/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewRows }),
      });
      const data = (await response.json()) as ImportResult;
      setImportResult(data);
      setCleanMarkers(data.cleanMarkers);
      setPreviewRows([]);
      setSummary(emptySummary);
      setPasteText("");
    } catch {
      setErrorMsg("导入 Clean Table 失败。");
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

  function handleClear() {
    setPasteText("");
    setPreviewRows([]);
    setSummary(emptySummary);
    setImportResult(null);
    setErrorMsg(null);
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

        <section className="grid min-w-0 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
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

          <section className="min-w-0 rounded-card border border-line bg-panel p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">粘贴导入</h2>
                <p className="mt-1 text-sm text-textSubtle">manual_paste</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
                  onClick={handleClear}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  <span>清空</span>
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
                  disabled={loading === "preview"}
                  onClick={handlePreview}
                  type="button"
                >
                  {loading === "preview" ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span>生成预览</span>
                </button>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  disabled={loading === "import" || importableCount === 0}
                  onClick={handleImport}
                  type="button"
                >
                  {loading === "import" ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span>导入 Clean Table</span>
                </button>
              </div>
            </div>

            <textarea
              className="mt-4 h-40 w-full resize-none rounded-md border border-line bg-white p-3 text-sm outline-none ring-0 placeholder:text-textWeak focus:border-zinc-400"
              onChange={(event) => setPasteText(event.target.value)}
              placeholder={"站点名称\t地址\t联系人\t电话\t薪资\t福利\t备注\n粘贴从 Excel、飞书、微信表格复制出的 TSV 文本"}
              value={pasteText}
            />

            {errorMsg ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            {importResult ? (
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                <ResultPill label="新增" value={importResult.inserted} tone="text-emerald-700" />
                <ResultPill label="更新" value={importResult.updated} tone="text-blue-700" />
                <ResultPill
                  label="跳过重复"
                  value={importResult.skippedDuplicate}
                  tone="text-slate-600"
                />
                <ResultPill
                  label="无效"
                  value={importResult.skippedInvalid}
                  tone="text-red-700"
                />
              </div>
            ) : null}

            <PreviewTable rows={previewRows} />
          </section>
        </section>

        <section className="min-w-0 rounded-card border border-line bg-panel p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">钉图模板导出</h2>
              <p className="mt-1 text-sm text-textSubtle">Clean Table → Sheet1</p>
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

          {exportErrorMsg ? (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {exportErrorMsg}
            </div>
          ) : null}

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

function PreviewTable({ rows }: { rows: ImportPreviewRow[] }) {
  return (
    <section className="mt-4 min-w-0 overflow-hidden rounded-card border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold">识别预览</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-tableHead text-textSubtle">
            <tr>
              {["行号", "站点名称", "地址", "联系人", "电话", "薪资", "福利", "备注", "状态", "错误 / 警告"].map(
                (column) => (
                  <th key={column} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-textWeak" colSpan={10}>
                  暂无预览
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.rowIndex}-${row.mergeKey ?? "none"}`} className="border-t border-line">
                  <td className="px-4 py-3 text-textSubtle">{row.rowIndex}</td>
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
