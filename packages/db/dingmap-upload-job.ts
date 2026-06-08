import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  runDingmapUploadBrowser,
  type DingmapUploadBrowserSession,
  type DingmapUploadStatus,
} from "@dingmap-sync/browser-controller/dingmap-upload";
import {
  DEFAULT_EXPORT_DIR,
  listDingmapExportFiles,
  resolveExistingDingmapExportFilePath,
  selectLatestDingmapExportFile,
  type DingmapExportFile,
} from "./dingmap-export";
import { resolveDatabasePath } from "./database-url";

export type { DingmapUploadStatus };

export interface DingmapUploadJobSnapshot {
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

export interface DingmapUploadStatusResponse {
  job: DingmapUploadJobSnapshot | null;
  recentExports: Array<Pick<DingmapExportFile, "filename" | "mtimeMs">>;
}

export interface CreateDingmapUploadJobOptions {
  filename?: string;
  timeoutMs?: number;
}

interface DingmapUploadJob extends DingmapUploadJobSnapshot {
  exportFilePath: string;
  session?: DingmapUploadBrowserSession;
  timeoutMs?: number;
}

type Store = {
  currentJob: DingmapUploadJob | null;
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_DIR = join(PROJECT_ROOT, "data", "browser-profile", "dingmap");
const SCREENSHOTS_DIR = join(PROJECT_ROOT, "data", "screenshots", "dingmap-upload");
const TERMINAL_STATUSES = new Set<DingmapUploadStatus>([
  "success",
  "failed",
  "blocked",
  "timeout",
  "unknown",
]);
const ACTIVE_STATUSES = new Set<DingmapUploadStatus>([
  "pending",
  "opening_dingmap",
  "uploading",
  "confirming",
]);

const store = getStore();

export function createDingmapUploadJob(
  options: CreateDingmapUploadJobOptions = {},
): DingmapUploadJobSnapshot {
  if (store.currentJob && ACTIVE_STATUSES.has(store.currentJob.status)) {
    throw new Error("已有钉图上传任务正在执行。");
  }

  if (store.currentJob?.status === "requires_login") {
    throw new Error("已有钉图上传任务等待登录，请先继续该任务。");
  }

  const selected = options.filename
    ? {
        filename: options.filename,
        filePath: resolveExistingDingmapExportFilePath(options.filename),
      }
    : selectLatestDingmapExportFile();

  if (!selected) {
    throw new Error("未找到可上传的钉图导出文件，请先导出钉图模板。");
  }

  const now = new Date().toISOString();
  const job: DingmapUploadJob = {
    id: `dingmap-upload-${Date.now()}`,
    status: "pending",
    filename: selected.filename,
    exportFilePath: selected.filePath,
    message: "等待上传。",
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    timeoutMs: options.timeoutMs,
  };
  store.currentJob = job;
  void runJob(job);
  return toSnapshot(job);
}

export function continueDingmapUploadJob(): DingmapUploadJobSnapshot {
  const job = store.currentJob;
  if (!job) {
    throw new Error("没有可继续的钉图上传任务。");
  }

  if (job.status !== "requires_login") {
    throw new Error("当前钉图上传任务不需要继续。");
  }

  void runJob(job);
  return toSnapshot(job);
}

export function getDingmapUploadStatus(): DingmapUploadStatusResponse {
  return {
    job: store.currentJob ? toSnapshot(store.currentJob) : null,
    recentExports: listDingmapExportFiles(DEFAULT_EXPORT_DIR)
      .slice(0, 8)
      .map(({ filename, mtimeMs }) => ({ filename, mtimeMs })),
  };
}

async function runJob(job: DingmapUploadJob): Promise<void> {
  try {
    mkdirSync(PROFILE_DIR, { recursive: true });
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    setJobStatus(job, "opening_dingmap", "正在打开钉图地图列表。");
    const result = await runDingmapUploadBrowser({
      exportFilePath: job.exportFilePath,
      profileDir: PROFILE_DIR,
      screenshotsDir: SCREENSHOTS_DIR,
      mapUrl: DINGMAP_HOME_URL,
      timeoutMs: job.timeoutMs,
      session: job.session,
      onStatus: (status, message) => setJobStatus(job, status, message),
    });

    job.session = result.status === "requires_login" ? result.session : undefined;
    job.screenshotPath = result.screenshotPath
      ? toProjectRelativePath(result.screenshotPath)
      : undefined;
    job.submitted = result.submitted;
    setJobStatus(job, result.status, result.message);

    if (TERMINAL_STATUSES.has(result.status)) {
      job.finishedAt = new Date().toISOString();
      writeUploadSyncLog(job);
    }
  } catch (error) {
    job.session = undefined;
    job.finishedAt = new Date().toISOString();
    setJobStatus(job, "failed", error instanceof Error ? error.message : String(error));
    writeUploadSyncLog(job);
  }
}

function setJobStatus(job: DingmapUploadJob, status: DingmapUploadStatus, message: string): void {
  job.status = status;
  job.message = message;
  job.updatedAt = new Date().toISOString();
}

function writeUploadSyncLog(job: DingmapUploadJob): void {
  const database = new DatabaseSync(resolveDatabasePath());
  try {
    database
      .prepare(
        `
          INSERT INTO sync_logs (
            run_id,
            source,
            action,
            after_json,
            status,
            error_msg,
            screenshot_path
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        job.id,
        "dingmap",
        "upload",
        JSON.stringify({
          filename: job.filename,
          exportedCount: countExportedRowsForFilename(database, job.filename),
          status: job.status,
          submitted: Boolean(job.submitted),
          teamName: DINGMAP_TARGET_TEAM_NAME,
          mapName: DINGMAP_TARGET_MAP_NAME,
          entryUrl: DINGMAP_HOME_URL,
          referenceMapUrl: DINGMAP_TARGET_MAP_URL,
        }),
        job.status,
        job.status === "success" ? null : job.message,
        job.screenshotPath ?? null,
      );
  } finally {
    database.close();
  }
}

function countExportedRowsForFilename(database: DatabaseSync, filename: string): number | null {
  const rows = database
    .prepare(
      `
        SELECT after_json
        FROM sync_logs
        WHERE action = 'export'
          AND status = 'success'
      `,
    )
    .all() as Array<{ after_json: string | null }>;

  let count = 0;
  for (const row of rows) {
    if (!row.after_json) {
      continue;
    }

    try {
      const parsed = JSON.parse(row.after_json) as { filename?: unknown };
      if (parsed.filename === filename) {
        count += 1;
      }
    } catch {
      // Ignore old or malformed local diagnostic rows.
    }
  }

  return count || null;
}

function toSnapshot(job: DingmapUploadJob): DingmapUploadJobSnapshot {
  return {
    id: job.id,
    status: job.status,
    filename: job.filename,
    message: job.message,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
    screenshotPath: job.screenshotPath,
    submitted: job.submitted,
  };
}

function getStore(): Store {
  const globalStore = globalThis as typeof globalThis & {
    __dingmapUploadStore?: Store;
  };
  globalStore.__dingmapUploadStore ??= { currentJob: null };
  return globalStore.__dingmapUploadStore;
}

function toProjectRelativePath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}
