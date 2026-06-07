import type { MarkerSyncAction, MarkerSyncStatus } from "./marker";

export interface SyncRun {
  id?: number;
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  finishedAt?: string | null;
  summaryJson?: Record<string, unknown> | null;
  errorMsg?: string | null;
}

export interface SyncPlanItem {
  id?: number;
  runId: string;
  cleanMarkerId: number;
  source: string;
  sourceId?: string | null;
  action: MarkerSyncAction;
  reason: string;
  beforeHash?: string | null;
  afterHash?: string | null;
  status: MarkerSyncStatus;
  errorMsg?: string | null;
  createdAt?: string;
  finishedAt?: string | null;
}

export interface SyncLog {
  id?: number;
  runId: string;
  source: string;
  sourceId?: string | null;
  action: MarkerSyncAction;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  status: MarkerSyncStatus;
  errorMsg?: string | null;
  screenshotPath?: string | null;
  createdAt?: string;
}
