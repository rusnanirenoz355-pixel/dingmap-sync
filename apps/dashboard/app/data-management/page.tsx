"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, Loader2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import type {
  CleanMarkerManagementStatistics,
  ManagedCleanMarker,
} from "../../../../packages/db/clean-marker-management";
import {
  ManagementDrawer,
  type EditableFormState,
} from "../components/ManagementDrawer";
import { TruncatedText } from "../components/TruncatedText";

interface ManagedCleanMarkerListResponse {
  rows: ManagedCleanMarker[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  statistics: CleanMarkerManagementStatistics;
  sources: string[];
}

const statusLabels: Record<ManagedCleanMarker["managementStatus"], string> = {
  normal: "正常",
  anomaly: "异常",
  deleted: "已删除",
};

const statusClasses: Record<ManagedCleanMarker["managementStatus"], string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-700",
  anomaly: "border-amber-200 bg-amber-50 text-amber-700",
  deleted: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function DataManagementPage() {
  const [data, setData] = useState<ManagedCleanMarkerListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [deletedOnly, setDeletedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedMarker, setSelectedMarker] = useState<ManagedCleanMarker | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drawerErrorMsg, setDrawerErrorMsg] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (search.trim()) {
      params.set("search", search.trim());
    }
    if (source) {
      params.set("source", source);
    }
    if (anomalyOnly) {
      params.set("anomalyOnly", "true");
    }
    if (includeDeleted) {
      params.set("includeDeleted", "true");
    }
    if (deletedOnly) {
      params.set("deletedOnly", "true");
    }
    return params.toString();
  }, [anomalyOnly, deletedOnly, includeDeleted, page, search, source]);

  useEffect(() => {
    void loadRows();
  }, [query]);

  async function loadRows() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/clean-markers/manage?${query}`, { cache: "no-store" });
      const json = (await response.json()) as ManagedCleanMarkerListResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "读取已导入数据失败。");
      }
      setData(json);
      setSelectedMarker((current) =>
        current ? (json.rows.find((row) => row.id === current.id) ?? current) : null,
      );
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "读取已导入数据失败。");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setSearch("");
    setSource("");
    setAnomalyOnly(false);
    setIncludeDeleted(false);
    setDeletedOnly(false);
    setPage(1);
  }

  async function handleSave(marker: ManagedCleanMarker, fields: EditableFormState) {
    setSaving(true);
    setDrawerErrorMsg(null);
    try {
      const response = await fetch(`/api/clean-markers/${marker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = (await response.json()) as { marker?: ManagedCleanMarker; error?: string };
      if (!response.ok || !json.marker) {
        throw new Error(json.error ?? "保存失败。");
      }
      setSelectedMarker(json.marker);
      await loadRows();
    } catch (error) {
      setDrawerErrorMsg(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(marker: ManagedCleanMarker) {
    setDeleting(true);
    setDrawerErrorMsg(null);
    try {
      const response = await fetch(`/api/clean-markers/${marker.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { marker?: ManagedCleanMarker; error?: string };
      if (!response.ok || !json.marker) {
        throw new Error(json.error ?? "软删除失败。");
      }
      setSelectedMarker(json.marker);
      await loadRows();
    } catch (error) {
      setDrawerErrorMsg(error instanceof Error ? error.message : "软删除失败。");
    } finally {
      setDeleting(false);
    }
  }

  const statistics = data?.statistics;

  return (
    <main className="min-h-screen overflow-x-hidden bg-page text-textMain">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <a
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            <span>Dashboard</span>
          </a>
          <div className="flex min-w-0 items-center gap-2">
            <Database aria-hidden="true" className="h-5 w-5 shrink-0" />
            <h1 className="truncate text-base font-semibold">已导入数据管理</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="有效" value={statistics?.activeCount ?? 0} />
          <Metric label="异常" value={statistics?.anomalyCount ?? 0} />
          <Metric label="已删除" value={statistics?.deletedCount ?? 0} />
        </section>

        <section className="grid gap-3 rounded-card border border-line bg-panel p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 sm:min-w-80">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textWeak"
              />
              <input
                className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索名称 / 地址"
                value={search}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4 text-textWeak" />
              <select
                className="h-10 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400"
                onChange={(event) => {
                  setSource(event.target.value);
                  setPage(1);
                }}
                value={source}
              >
                <option value="">全部来源</option>
                {(data?.sources ?? []).map((sourceName) => (
                  <option key={sourceName} value={sourceName}>
                    {sourceName}
                  </option>
                ))}
              </select>
            </label>

            <Toggle
              checked={anomalyOnly}
              label="只看异常"
              onChange={(checked) => {
                setAnomalyOnly(checked);
                setPage(1);
              }}
            />
            <Toggle
              checked={includeDeleted}
              label="包含已删除"
              onChange={(checked) => {
                setIncludeDeleted(checked);
                setPage(1);
              }}
            />
            <Toggle
              checked={deletedOnly}
              label="只看已删除"
              onChange={(checked) => {
                setDeletedOnly(checked);
                setIncludeDeleted(checked ? true : includeDeleted);
                setPage(1);
              }}
            />

            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium hover:bg-tableHead"
              onClick={resetFilters}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              <span>重置</span>
            </button>
          </div>
          {errorMsg ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}
        </section>

        <section className="min-w-0 overflow-hidden rounded-card border border-line bg-panel shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="text-sm text-textSubtle">
              {loading ? "读取中" : `共 ${data?.pagination.total ?? 0} 条`}
            </div>
            {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed border-collapse text-left text-sm">
              <thead className="bg-tableHead text-textSubtle">
                <tr>
                  <HeaderCell width="w-40">名称</HeaderCell>
                  <HeaderCell width="w-64">地址</HeaderCell>
                  <HeaderCell width="w-36">坐标</HeaderCell>
                  <HeaderCell width="w-32">来源</HeaderCell>
                  <HeaderCell width="w-32">originType</HeaderCell>
                  <HeaderCell width="w-32">状态</HeaderCell>
                  <HeaderCell width="w-52">备注 / 异常</HeaderCell>
                  <th className="sticky right-0 w-28 bg-tableHead px-4 py-3 font-medium shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-textWeak" colSpan={8}>
                      {loading ? "读取中" : "暂无数据"}
                    </td>
                  </tr>
                ) : (
                  data?.rows.map((marker) => (
                    <tr key={marker.id} className="h-20 border-t border-line align-top">
                      <td className="max-w-0 overflow-hidden px-4 py-3 font-medium">
                        <TruncatedText maxLength={48} value={marker.siteName} />
                      </td>
                      <td className="max-w-0 overflow-hidden px-4 py-3">
                        <TruncatedText
                          className="text-textSubtle"
                          maxLength={72}
                          onExpand={() => setSelectedMarker(marker)}
                          value={marker.address}
                        />
                      </td>
                      <td className="px-4 py-3 text-textSubtle">
                        {formatCoordinate(marker.longitude, marker.latitude)}
                      </td>
                      <td className="max-w-0 overflow-hidden px-4 py-3 text-textSubtle">
                        <TruncatedText lineClamp={1} maxLength={40} value={marker.source} />
                      </td>
                      <td className="max-w-0 overflow-hidden px-4 py-3 text-textSubtle">
                        <TruncatedText lineClamp={1} maxLength={40} value={marker.originType} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs ${statusClasses[marker.managementStatus]}`}
                        >
                          {statusLabels[marker.managementStatus]}
                        </span>
                      </td>
                      <td className="max-w-0 overflow-hidden px-4 py-3 text-textSubtle">
                        <TruncatedText
                          maxLength={72}
                          onExpand={() => setSelectedMarker(marker)}
                          value={
                            marker.anomalyReasons.length > 0
                              ? marker.anomalyReasons.join(" / ")
                              : (marker.remark ?? marker.errorMsg)
                          }
                        />
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                        <button
                          className="inline-flex h-9 items-center rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800"
                          onClick={() => setSelectedMarker(marker)}
                          type="button"
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
            <span className="text-textSubtle">
              第 {data?.pagination.page ?? page} / {data?.pagination.totalPages ?? 1} 页
            </span>
            <div className="flex gap-2">
              <button
                className="h-9 rounded-md border border-line bg-white px-3 font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="h-9 rounded-md border border-line bg-white px-3 font-medium hover:bg-tableHead disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= (data?.pagination.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>

      <ManagementDrawer
        deleting={deleting}
        errorMsg={drawerErrorMsg}
        marker={selectedMarker}
        onClose={() => {
          setSelectedMarker(null);
          setDrawerErrorMsg(null);
        }}
        onDelete={handleDelete}
        onSave={handleSave}
        saving={saving}
      />
    </main>
  );
}

function HeaderCell({ children, width }: { children: React.ReactNode; width: string }) {
  return <th className={`${width} px-4 py-3 font-medium`}>{children}</th>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-sm">
      <p className="text-sm font-medium text-textSubtle">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm">
      <input
        checked={checked}
        className="h-4 w-4 accent-black"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function formatCoordinate(longitude?: number | null, latitude?: number | null): string {
  if (longitude === null || longitude === undefined || latitude === null || latitude === undefined) {
    return "-";
  }

  return `${longitude}, ${latitude}`;
}
