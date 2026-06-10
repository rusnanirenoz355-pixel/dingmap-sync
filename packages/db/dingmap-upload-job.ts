import { mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_BROWSER_CLOSED_MESSAGE,
  formatDingmapUploadErrorMessage,
  isDingmapUploadSessionUsable,
  openDingmapUploadSession,
  runDingmapUploadBrowser,
  type DingmapUploadBrowserSession,
  type DingmapUploadStatusDetails,
  type DingmapUploadStatus,
} from "@dingmap-sync/browser-controller/dingmap-upload";
import {
  DINGMAP_COORDINATE_TYPE,
  DINGMAP_PLATFORM_OPTIONS,
  resolveDingmapPlatform,
  type DingmapPlatformConfig,
  type DingmapPlatformKey,
} from "@dingmap-sync/browser-controller/dingmap-platforms";
import {
  DingmapUploadRowLimitError,
  assertDingmapUploadRowLimit,
} from "@dingmap-sync/dingmap/read-export-row-count";
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
  platform: DingmapPlatformKey;
  platformLabel: string;
  layerName: string;
  markerColor: string;
  markerColorLabel: string;
  markerSize: string;
  coordinateType: string;
  confirmedCoordinateType?: string;
  confirmedMarkerStyle?: string;
  confirmedMarkerSize?: string;
  message: string;
  stage?: string;
  dataRows?: number;
  maxRows?: number;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  screenshotPath?: string;
  submitted?: boolean;
}

export interface DingmapUploadStatusResponse {
  job: DingmapUploadJobSnapshot | null;
  recentExports: Array<Pick<DingmapExportFile, "filename" | "mtimeMs">>;
  platformOptions: Array<Pick<DingmapPlatformConfig, "key" | "label">>;
}

export interface CreateDingmapUploadJobOptions {
  filename?: string;
  platform?: unknown;
  timeoutMs?: number;
}

interface DingmapUploadJob extends DingmapUploadJobSnapshot {
  exportFilePath: string;
  platformConfig: DingmapPlatformConfig;
  session?: DingmapUploadBrowserSession;
  timeoutMs?: number;
}

type Store = {
  currentJob: DingmapUploadJob | null;
  sharedSession?: DingmapUploadBrowserSession;
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

export async function createDingmapUploadJob(
  options: CreateDingmapUploadJobOptions = {},
): Promise<DingmapUploadJobSnapshot> {
  recoverClosedUploadJob();

  if (store.currentJob && ACTIVE_STATUSES.has(store.currentJob.status)) {
    throw new Error("已有钉图上传任务正在执行。");
  }

  if (store.currentJob?.status === "requires_login") {
    throw new Error("已有钉图上传任务等待人工操作，请先继续该任务。");
  }

  const platform = resolveDingmapPlatform(options.platform);
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
    platform: platform.key,
    platformLabel: platform.label,
    layerName: platform.layerName,
    markerColor: platform.markerColor,
    markerColorLabel: platform.markerColorLabel,
    markerSize: platform.markerSize,
    coordinateType: DINGMAP_COORDINATE_TYPE,
    exportFilePath: selected.filePath,
    platformConfig: platform,
    message: `等待上传到 ${platform.label} / ${platform.layerName}。`,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    timeoutMs: options.timeoutMs,
  };
  store.currentJob = job;

  try {
    const rowLimit = await assertDingmapUploadRowLimit(job.exportFilePath);
    job.dataRows = rowLimit.dataRows;
    job.maxRows = rowLimit.maxRows;
  } catch (error) {
    if (error instanceof DingmapUploadRowLimitError) {
      job.dataRows = error.dataRows;
      job.maxRows = error.maxRows;
      job.stage = error.stage;
      job.finishedAt = new Date().toISOString();
      setJobStatus(job, "blocked", error.message, error.stage);
      writeUploadSyncLog(job);
      return toSnapshot(job);
    }

    throw error;
  }

  void runJob(job);
  return toSnapshot(job);
}

export function continueDingmapUploadJob(): DingmapUploadJobSnapshot {
  recoverClosedUploadJob();

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

export async function openDingmapAutomationBrowser(): Promise<{
  message: string;
  url: string;
}> {
  mkdirSync(PROFILE_DIR, { recursive: true });
  const session =
    (isDingmapUploadSessionUsable(store.currentJob?.session)
      ? store.currentJob?.session
      : undefined) ??
    (isDingmapUploadSessionUsable(store.sharedSession) ? store.sharedSession : undefined) ??
    (await openDingmapUploadSession(PROFILE_DIR));
  store.sharedSession = session;

  if (!session.page.url().includes("dm.dingmap.com")) {
    await session.page.goto(DINGMAP_HOME_URL, { waitUntil: "domcontentloaded", timeout: 15_000 });
  }
  await session.page.bringToFront().catch(() => undefined);

  return {
    message: "已在自动化 Chrome 中打开钉图。",
    url: session.page.url(),
  };
}

export function getDingmapUploadStatus(): DingmapUploadStatusResponse {
  recoverClosedUploadJob();

  return {
    job: store.currentJob ? toSnapshot(store.currentJob) : null,
    recentExports: listDingmapExportFiles(DEFAULT_EXPORT_DIR)
      .slice(0, 8)
      .map(({ filename, mtimeMs }) => ({ filename, mtimeMs })),
    platformOptions: DINGMAP_PLATFORM_OPTIONS.map(({ key, label }) => ({ key, label })),
  };
}

export function resetDingmapUploadJob(): DingmapUploadStatusResponse {
  store.currentJob = null;
  if (!isDingmapUploadSessionUsable(store.sharedSession)) {
    store.sharedSession = undefined;
  }

  return getDingmapUploadStatus();
}

function recoverClosedUploadJob(): void {
  if (!isDingmapUploadSessionUsable(store.sharedSession)) {
    store.sharedSession = undefined;
  }

  const job = store.currentJob;
  if (!job) {
    return;
  }

  const waitingOrRunning = ACTIVE_STATUSES.has(job.status) || job.status === "requires_login";
  if (!waitingOrRunning || !job.session || isDingmapUploadSessionUsable(job.session)) {
    return;
  }

  job.session = undefined;
  job.finishedAt = new Date().toISOString();
  setJobStatus(job, "failed", DINGMAP_BROWSER_CLOSED_MESSAGE, "browser-closed");
  writeUploadSyncLog(job);
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
      platform: job.platform,
      timeoutMs: job.timeoutMs,
      session:
        (isDingmapUploadSessionUsable(job.session) ? job.session : undefined) ??
        (isDingmapUploadSessionUsable(store.sharedSession) ? store.sharedSession : undefined),
      onStatus: (status, message, details) => setJobStatus(job, status, message, details?.stage, details),
    });

    job.session = isDingmapUploadSessionUsable(result.session) ? result.session : undefined;
    store.sharedSession = isDingmapUploadSessionUsable(result.session) ? result.session : undefined;
    applyUploadStatusDetails(job, result);
    job.stage = result.stage ?? job.stage;
    job.screenshotPath = result.screenshotPath
      ? toProjectRelativePath(result.screenshotPath)
      : undefined;
    job.submitted = result.submitted;
    setJobStatus(job, result.status, result.message, result.stage);

    if (TERMINAL_STATUSES.has(result.status)) {
      job.finishedAt = new Date().toISOString();
      writeUploadSyncLog(job);
    }
  } catch (error) {
    job.finishedAt = new Date().toISOString();
    const message = formatDingmapUploadErrorMessage(error);
    setJobStatus(
      job,
      "failed",
      message,
      message === DINGMAP_BROWSER_CLOSED_MESSAGE ? "browser-closed" : undefined,
    );
    writeUploadSyncLog(job);
  }
}

function setJobStatus(
  job: DingmapUploadJob,
  status: DingmapUploadStatus,
  message: string,
  stage?: string,
  details?: DingmapUploadStatusDetails,
): void {
  applyUploadStatusDetails(job, details);
  job.status = status;
  job.message = message;
  job.stage = stage ?? job.stage;
  job.updatedAt = new Date().toISOString();
}

function applyUploadStatusDetails(
  job: DingmapUploadJob,
  details?: DingmapUploadStatusDetails | null,
): void {
  if (!details) {
    return;
  }

  if (details.confirmedCoordinateType !== undefined) {
    job.confirmedCoordinateType = details.confirmedCoordinateType;
  }
  if (details.confirmedMarkerStyle !== undefined) {
    job.confirmedMarkerStyle = details.confirmedMarkerStyle;
  }
  if (details.confirmedMarkerSize !== undefined) {
    job.confirmedMarkerSize = details.confirmedMarkerSize;
  }
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
          exportedCount: job.dataRows ?? countExportedRowsForFilename(database, job.filename),
          status: job.status,
          submitted: Boolean(job.submitted),
          platform: job.platform,
          platformLabel: job.platformLabel,
          layerName: job.layerName,
          markerColor: job.markerColor,
          markerColorLabel: job.markerColorLabel,
          markerSize: job.markerSize,
          coordinateType: job.coordinateType,
          confirmedCoordinateType: job.confirmedCoordinateType,
          confirmedMarkerStyle: job.confirmedMarkerStyle,
          confirmedMarkerSize: job.confirmedMarkerSize,
          stage: job.stage,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
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
    platform: job.platform,
    platformLabel: job.platformLabel,
    layerName: job.layerName,
    markerColor: job.markerColor,
    markerColorLabel: job.markerColorLabel,
    markerSize: job.markerSize,
    coordinateType: job.coordinateType,
    confirmedCoordinateType: job.confirmedCoordinateType,
    confirmedMarkerStyle: job.confirmedMarkerStyle,
    confirmedMarkerSize: job.confirmedMarkerSize,
    message: job.message,
    stage: job.stage,
    dataRows: job.dataRows,
    maxRows: job.maxRows,
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
