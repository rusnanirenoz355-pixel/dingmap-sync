export type MarkerSyncAction = "create" | "update" | "archive" | "noop" | "review";

export type MarkerSyncStatus =
  | "pending"
  | "need_confirm"
  | "synced"
  | "failed"
  | "skipped";

export interface CleanMarker {
  id?: number;
  source: string;
  sourceId?: string | null;
  siteName: string;
  address: string;
  longitude?: number | null;
  latitude?: number | null;
  stationManager?: string | null;
  phone?: string | null;
  salary?: string | null;
  welfare?: string | null;
  interviewTime?: string | null;
  jobTitle?: string | null;
  remark?: string | null;
  originType: "web" | "manual_paste" | "excel" | "dingmap";
  dingmapMarkerId?: string | null;
  syncAction: MarkerSyncAction;
  syncStatus: MarkerSyncStatus;
  currentHash?: string | null;
  lastSyncedHash?: string | null;
  lockedFields?: string[] | null;
  mergeKey?: string | null;
  manualOverride?: boolean;
  errorMsg?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportPreviewRow {
  rowIndex: number;
  source: string;
  rawText: string;
  normalized: Partial<CleanMarker>;
  parseStatus: "pending" | "parsed" | "needs_review" | "failed";
  warnings: string[];
}
