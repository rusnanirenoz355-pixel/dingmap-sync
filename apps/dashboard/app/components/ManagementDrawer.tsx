"use client";

import { useEffect, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import type { ManagedCleanMarker } from "../../../../packages/db/clean-marker-management";

interface ManagementDrawerProps {
  marker: ManagedCleanMarker | null;
  errorMsg: string | null;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: (marker: ManagedCleanMarker) => void;
  onSave: (marker: ManagedCleanMarker, fields: EditableFormState) => void;
}

export interface EditableFormState {
  siteName: string;
  address: string;
  longitude: string;
  latitude: string;
  stationManager: string;
  phone: string;
  salary: string;
  welfare: string;
  interviewTime: string;
  jobTitle: string;
  remark: string;
}

const editableFields: Array<{
  key: keyof EditableFormState;
  label: string;
  multiline?: boolean;
}> = [
  { key: "siteName", label: "站点名称" },
  { key: "address", label: "站点地址", multiline: true },
  { key: "longitude", label: "经度" },
  { key: "latitude", label: "纬度" },
  { key: "stationManager", label: "联系人" },
  { key: "salary", label: "薪资待遇", multiline: true },
  { key: "welfare", label: "福利待遇", multiline: true },
  { key: "remark", label: "交付条件", multiline: true },
]

export function ManagementDrawer({
  deleting,
  errorMsg,
  marker,
  onClose,
  onDelete,
  onSave,
  saving,
}: ManagementDrawerProps) {
  const [form, setForm] = useState<EditableFormState>(emptyForm);

  useEffect(() => {
    setForm(marker ? markerToForm(marker) : emptyForm);
  }, [marker]);

  if (!marker) {
    return null;
  }

  const isDeleted = Boolean(marker.deletedAt);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20">
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-line bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{marker.siteName || "未命名"}</h2>
            <p className="mt-1 truncate text-sm text-textSubtle">
              {marker.source} / {marker.originType}
            </p>
          </div>
          <button
            aria-label="关闭"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line hover:bg-tableHead"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {errorMsg ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          <section className="grid gap-3">
            {editableFields.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm">
                <span className="font-medium text-textSubtle">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    className="min-h-24 resize-y rounded-md border border-line bg-white px-3 py-2 outline-none focus:border-zinc-400 disabled:bg-tableHead"
                    disabled={isDeleted}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    value={form[field.key]}
                  />
                ) : (
                  <input
                    className="h-10 rounded-md border border-line bg-white px-3 outline-none focus:border-zinc-400 disabled:bg-tableHead"
                    disabled={isDeleted}
                    onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                    value={form[field.key]}
                  />
                )}
              </label>
            ))}
          </section>

          <section className="mt-5 grid gap-2 rounded-md border border-line bg-tableHead p-3 text-sm">
            <ReadOnlyValue label="source" value={marker.source} />
            <ReadOnlyValue label="originType" value={marker.originType} />
            <ReadOnlyValue label="sourceId" value={marker.sourceId} />
            <ReadOnlyValue label="createdAt" value={marker.createdAt} />
            <ReadOnlyValue label="updatedAt" value={marker.updatedAt} />
            <ReadOnlyValue label="deletedAt" value={marker.deletedAt} />
            <ReadOnlyValue label="mergeKey" value={marker.mergeKey} />
            <ReadOnlyValue label="currentHash" value={marker.currentHash} />
          </section>

          <section className="mt-5 grid gap-2 text-sm">
            <h3 className="font-semibold">状态</h3>
            <p className="text-textSubtle">{marker.managementStatus}</p>
            <p className="text-textSubtle">
              {marker.anomalyReasons.length > 0 ? marker.anomalyReasons.join(" / ") : "-"}
            </p>
            {marker.errorMsg ? <p className="text-red-700">{marker.errorMsg}</p> : null}
          </section>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-line px-5 py-4">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleting || isDeleted}
            onClick={() => onDelete(marker)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            <span>软删除</span>
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
            disabled={saving || isDeleted}
            onClick={() => onSave(marker, form)}
            type="button"
          >
            <Save aria-hidden="true" className="h-4 w-4" />
            <span>保存</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
      <span className="text-textWeak">{label}</span>
      <span className="break-all text-textSubtle">{value || "-"}</span>
    </div>
  );
}

function markerToForm(marker: ManagedCleanMarker): EditableFormState {
  return {
    siteName: marker.siteName ?? "",
    address: marker.address ?? "",
    longitude: marker.longitude === null || marker.longitude === undefined ? "" : String(marker.longitude),
    latitude: marker.latitude === null || marker.latitude === undefined ? "" : String(marker.latitude),
    stationManager: marker.stationManager ?? "",
    phone: marker.phone ?? "",
    salary: marker.salary ?? "",
    welfare: marker.welfare ?? "",
    interviewTime: marker.interviewTime ?? "",
    jobTitle: marker.jobTitle ?? "",
    remark: marker.remark ?? "",
  };
}

const emptyForm: EditableFormState = {
  siteName: "",
  address: "",
  longitude: "",
  latitude: "",
  stationManager: "",
  phone: "",
  salary: "",
  welfare: "",
  interviewTime: "",
  jobTitle: "",
  remark: "",
};
