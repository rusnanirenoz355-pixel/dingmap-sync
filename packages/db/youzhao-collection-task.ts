import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ImportPreviewRow } from "@dingmap-sync/shared";
import type { DingmapTargetLayer, YouzhaoApiStatus, YouzhaoQueryInput } from "@dingmap-sync/sources/youzhao";
import { previewYouzhaoPositionsForImport } from "./youzhao-import";
import {
  importCleanMarkers,
  type ImportCleanMarkersOptions,
  type ImportCleanMarkersResult,
} from "./import-clean-markers";
import type { RawImportRow } from "../sources/import-pipeline";

export const YOUZHAO_TASK_STATUSES = [
  "idle",
  "running",
  "paused",
  "completed",
  "smoke_completed",
  "failed",
  "requires_login",
  "forbidden",
  "blocked",
  "schema_changed",
  "timeout",
  "cancelled",
  "count_mismatch",
] as const;

export type YouzhaoTaskStatus = (typeof YOUZHAO_TASK_STATUSES)[number];
export type YouzhaoTaskMode = "smoke" | "full";
export type YouzhaoSessionCheckStatus =
  | "authenticated"
  | "opened"
  | "requires_login"
  | "forbidden"
  | "blocked"
  | "schema_changed"
  | "auth_failed"
  | "auth_mechanism_unknown"
  | "timeout"
  | "failed";

export type YouzhaoFailedPageStatus =
  | "timeout"
  | "network_error"
  | "server_error"
  | "requires_login"
  | "forbidden"
  | "blocked"
  | "schema_changed";

export interface YouzhaoCollectionTaskInput {
  city: string;
  mode: YouzhaoTaskMode;
  pageSize?: number;
  maxPages?: number;
  maxItems?: number;
  confirmed?: boolean;
  confirmedTotal?: number;
}

export interface YouzhaoPageCollectInput {
  city: string;
  page: number;
  pageSize: number;
  limit: number;
}

export interface YouzhaoPageCollectResult {
  status: YouzhaoApiStatus | "network_error" | "server_error";
  total: number | null;
  rawRows: RawImportRow[];
  rows: ImportPreviewRow[];
  filteredNonRecruiting: number;
}

export interface YouzhaoCollectionTaskDependencies {
  checkpointDir?: string;
  mode?: YouzhaoTaskMode;
  collectPage?: (input: YouzhaoPageCollectInput) => Promise<YouzhaoPageCollectResult>;
  importRows?: (
    rows: RawImportRow[],
    options: ImportCleanMarkersOptions,
  ) => Promise<ImportCleanMarkersResult & { options?: unknown }> | (ImportCleanMarkersResult & { options?: unknown });
  sleep?: (ms: number) => Promise<void>;
  afterPage?: (state: YouzhaoCollectionTaskState) => Promise<unknown> | unknown;
  sessionCheck?: () => Promise<string> | string;
}

export interface YouzhaoCollectionCounts {
  imported: number;
  duplicate: number;
  update_candidate: number;
  invalid: number;
  filteredNonRecruiting: number;
}

export interface YouzhaoFailedPage {
  page: number;
  attempts: number;
  status: YouzhaoFailedPageStatus;
}

export interface YouzhaoCollectionTaskState {
  city: string;
  mode: YouzhaoTaskMode;
  status: YouzhaoTaskStatus;
  currentPage: number;
  nextPage: number;
  pageSize: number;
  maxPages?: number;
  maxItems?: number;
  processedPages: number;
  processedItems: number;
  totalFromApi: number | null;
  totalPages: number | null;
  confirmedTotal?: number;
  completedPages: number[];
  countConsistencyPassed: boolean | null;
  countDifference: number | null;
  counts: YouzhaoCollectionCounts;
  targetLayerCounts: Partial<Record<DingmapTargetLayer, number>>;
  failedPages: YouzhaoFailedPage[];
  startedAt?: string;
  updatedAt?: string;
  lastErrorStatus?: string;
}

interface YouzhaoCollectionCheckpoint extends YouzhaoCollectionTaskState {
  schemaVersion: 1;
  processedSourceIdHashes: string[];
}

export interface YouzhaoTaskLookupOptions {
  city?: string;
  mode?: YouzhaoTaskMode;
}

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_CHECKPOINT_DIR = join(PROJECT_ROOT, "data", "youzhao", "checkpoints");
const CURRENT_TASK_FILENAME = "current-task.json";
const SMOKE_PAGE_SIZE = 20;
const SMOKE_MAX_PAGES = 2;
const SMOKE_MAX_ITEMS = 40;
const RETRY_DELAYS_MS = [1000, 3000, 8000] as const;

let currentTask: YouzhaoCollectionTaskState = buildIdleState("");
let stopIntent: "pause" | "cancel" | null = null;
let processedSourceIdHashes = new Set<string>();

export function getYouzhaoCheckpointPath(
  city: string,
  checkpointDir = DEFAULT_CHECKPOINT_DIR,
  mode: YouzhaoTaskMode = "smoke",
): string {
  const suffix = mode === "full" ? ".full" : "";
  return join(checkpointDir, `${encodeURIComponent(city)}${suffix}.json`);
}

export function getYouzhaoCollectionTask(
  checkpointDir = DEFAULT_CHECKPOINT_DIR,
  options: YouzhaoTaskLookupOptions = {},
): YouzhaoCollectionTaskState {
  const lookupCity = typeof options.city === "string" ? options.city.trim() : "";
  const lookupMode = options.mode;
  if (lookupCity || lookupMode) {
    const state = readTaskStateByLookup(checkpointDir, { city: lookupCity || undefined, mode: lookupMode });
    if (state) {
      return state;
    }
    return buildIdleState(lookupCity, lookupMode ?? "smoke");
  }

  if (currentTask.status === "idle" && !currentTask.city) {
    const persisted = readCurrentState(checkpointDir);
    if (persisted) {
      return persisted;
    }
  }
  return cloneState(currentTask);
}

export function pauseYouzhaoCollectionTask(city: string): YouzhaoCollectionTaskState {
  if (currentTask.city === city && currentTask.status === "running") {
    stopIntent = "pause";
  }
  return getYouzhaoCollectionTask();
}

export function cancelYouzhaoCollectionTask(city: string): YouzhaoCollectionTaskState {
  if (currentTask.city === city && currentTask.status === "running") {
    stopIntent = "cancel";
  }
  return getYouzhaoCollectionTask();
}

export function restartYouzhaoCollectionTask(
  city: string,
  options: { checkpointDir?: string; confirmed?: boolean; mode?: YouzhaoTaskMode } = {},
): YouzhaoCollectionTaskState {
  if (!options.confirmed) {
    currentTask = {
      ...buildIdleState(city),
      status: "failed",
      lastErrorStatus: "restart_confirmation_required",
      updatedAt: new Date().toISOString(),
    };
    writeCurrentState(currentTask, options.checkpointDir);
    return getYouzhaoCollectionTask();
  }

  const mode = options.mode ?? "smoke";
  const checkpointPath = getYouzhaoCheckpointPath(city, options.checkpointDir, mode);
  if (existsSync(checkpointPath)) {
    rmSync(checkpointPath, { force: true });
  }
  currentTask = buildIdleState(city, mode);
  processedSourceIdHashes = new Set();
  stopIntent = null;
  writeCurrentState(currentTask, options.checkpointDir);
  return getYouzhaoCollectionTask();
}

export async function resumeYouzhaoCollectionTask(
  city: string,
  dependencies: YouzhaoCollectionTaskDependencies = {},
): Promise<YouzhaoCollectionTaskState> {
  const mode = dependencies.mode ?? "smoke";
  const checkpoint = readCheckpoint(city, dependencies.checkpointDir, mode);
  if (!checkpoint && mode === "full") {
    currentTask = {
      ...buildIdleState(city, "full"),
      status: "failed",
      lastErrorStatus: "full_checkpoint_not_found",
      updatedAt: new Date().toISOString(),
    };
    writeCurrentState(currentTask, dependencies.checkpointDir);
    return getYouzhaoCollectionTask(dependencies.checkpointDir, { city, mode });
  }
  const baseState = checkpoint ? checkpointToState(checkpoint) : buildIdleState(city, mode);
  currentTask = baseState;
  processedSourceIdHashes = new Set(checkpoint?.processedSourceIdHashes ?? []);

  const sessionStatus = await dependencies.sessionCheck?.();
  if (sessionStatus !== "authenticated") {
    const rejectedStatus = mapSessionStatusToTaskStatus(sessionStatus ?? "failed");
    currentTask = {
      ...baseState,
      status: rejectedStatus,
      lastErrorStatus: sessionStatus ?? "session_check_missing",
      updatedAt: new Date().toISOString(),
    };
    writeCurrentState(currentTask, dependencies.checkpointDir);
    return getYouzhaoCollectionTask();
  }

  return runYouzhaoCollectionTask(
    {
      city,
      mode: baseState.mode,
      pageSize: baseState.pageSize,
      maxPages: baseState.maxPages,
      maxItems: baseState.maxItems,
      confirmed: baseState.mode === "full" ? true : undefined,
      confirmedTotal: baseState.confirmedTotal ?? baseState.totalFromApi ?? undefined,
    },
    dependencies,
    baseState,
  );
}

export async function startYouzhaoCollectionTask(
  input: YouzhaoCollectionTaskInput,
  dependencies: YouzhaoCollectionTaskDependencies = {},
): Promise<YouzhaoCollectionTaskState> {
  const normalized = normalizeTaskInput(input);
  if (normalized.mode === "full" && (!normalized.confirmed || !Number.isFinite(normalized.confirmedTotal))) {
    currentTask = {
      ...buildIdleState(normalized.city, "full"),
      mode: "full",
      status: "failed",
      pageSize: normalized.pageSize,
      confirmedTotal: normalized.confirmedTotal,
      lastErrorStatus: "full_confirmation_required",
      updatedAt: new Date().toISOString(),
    };
    writeCurrentState(currentTask, dependencies.checkpointDir);
    return getYouzhaoCollectionTask(dependencies.checkpointDir, { city: normalized.city, mode: "full" });
  }

  const startedAt = new Date().toISOString();
  const initialState: YouzhaoCollectionTaskState = {
    ...buildIdleState(normalized.city, normalized.mode),
    mode: normalized.mode,
    status: "running",
    currentPage: 1,
    nextPage: 1,
    pageSize: normalized.pageSize,
    maxPages: normalized.maxPages,
    maxItems: normalized.maxItems,
    totalFromApi: null,
    totalPages: normalized.confirmedTotal && normalized.mode === "full"
      ? Math.ceil(normalized.confirmedTotal / normalized.pageSize)
      : null,
    confirmedTotal: normalized.confirmedTotal,
    completedPages: [],
    startedAt,
    updatedAt: startedAt,
  };

  processedSourceIdHashes = new Set();
  return runYouzhaoCollectionTask(normalized, dependencies, initialState);
}

async function runYouzhaoCollectionTask(
  input: Required<Pick<YouzhaoCollectionTaskInput, "city" | "mode" | "pageSize">> &
    Pick<YouzhaoCollectionTaskInput, "maxPages" | "maxItems" | "confirmed" | "confirmedTotal">,
  dependencies: YouzhaoCollectionTaskDependencies,
  initialState: YouzhaoCollectionTaskState,
): Promise<YouzhaoCollectionTaskState> {
  const collectPage = dependencies.collectPage ?? collectYouzhaoPage;
  const importRows = dependencies.importRows ?? defaultImportRows;
  const sleep = dependencies.sleep ?? defaultSleep;
  stopIntent = null;
  currentTask = { ...initialState, status: "running", updatedAt: new Date().toISOString() };

  while (currentTask.status === "running") {
    if (shouldStopBeforeNextPage(currentTask)) {
      currentTask = finalizeCompletedState(currentTask);
      writeCheckpoint(currentTask, dependencies.checkpointDir);
      break;
    }

    const page = currentTask.nextPage;
    currentTask = {
      ...currentTask,
      currentPage: page,
      updatedAt: new Date().toISOString(),
    };

    const pageResult = await collectPageWithRetry(
      () => collectPage({ city: input.city, page, pageSize: currentTask.pageSize, limit: currentTask.pageSize }),
      sleep,
    );

    if (pageResult.result.status !== "success") {
      currentTask = finalizeFailedPage(currentTask, page, pageResult.attempts, pageResult.result.status);
      writeCheckpoint(currentTask, dependencies.checkpointDir);
      break;
    }

    const remainingItems = currentTask.maxItems
      ? Math.max(0, currentTask.maxItems - currentTask.processedItems)
      : Number.POSITIVE_INFINITY;
    const rawRows = pageResult.result.rawRows.slice(0, remainingItems);
    const previewRows = pageResult.result.rows.slice(0, remainingItems);
    const importResult = await importRows(rawRows, { updateCandidates: "skip" });
    const imported = importResult.inserted;
    const duplicate = importResult.skippedDuplicate;
    const updateCandidate = importResult.updateCandidate;
    const invalid = importResult.skippedInvalid;
    const processedThisPage = imported + duplicate + updateCandidate + invalid;

    addProcessedSourceIdHashes(rawRows);
    currentTask = {
      ...currentTask,
      nextPage: page + 1,
      processedPages: currentTask.processedPages + 1,
      processedItems: currentTask.processedItems + processedThisPage,
      totalFromApi: pageResult.result.total ?? currentTask.totalFromApi,
      totalPages: pageResult.result.total !== null
        ? Math.ceil(pageResult.result.total / currentTask.pageSize)
        : currentTask.totalPages,
      completedPages: [...currentTask.completedPages, page],
      counts: {
        imported: currentTask.counts.imported + imported,
        duplicate: currentTask.counts.duplicate + duplicate,
        update_candidate: currentTask.counts.update_candidate + updateCandidate,
        invalid: currentTask.counts.invalid + invalid,
        filteredNonRecruiting:
          currentTask.counts.filteredNonRecruiting + (pageResult.result.filteredNonRecruiting ?? 0),
      },
      targetLayerCounts: mergeLayerCounts(currentTask.targetLayerCounts, previewRows),
      updatedAt: new Date().toISOString(),
    };

    writeCheckpoint(currentTask, dependencies.checkpointDir);
    await dependencies.afterPage?.(getYouzhaoCollectionTask());

    if (stopIntent) {
      currentTask = {
        ...currentTask,
        status: stopIntent === "pause" ? "paused" : "cancelled",
        updatedAt: new Date().toISOString(),
      };
      stopIntent = null;
      writeCheckpoint(currentTask, dependencies.checkpointDir);
      break;
    }

    if (processedThisPage < currentTask.pageSize || currentTask.processedItems >= (currentTask.totalFromApi ?? Infinity)) {
      currentTask = finalizeCompletedState(currentTask);
      writeCheckpoint(currentTask, dependencies.checkpointDir);
      break;
    }
  }

  return getYouzhaoCollectionTask();
}

async function collectPageWithRetry(
  collectPage: () => Promise<YouzhaoPageCollectResult>,
  sleep: (ms: number) => Promise<void>,
): Promise<{ result: YouzhaoPageCollectResult; attempts: number }> {
  let attempts = 0;
  let result: YouzhaoPageCollectResult;

  while (true) {
    attempts += 1;
    result = await collectPage();
    if (result.status === "success" || !isRetryableStatus(result.status) || attempts > RETRY_DELAYS_MS.length) {
      return { result, attempts };
    }
    await sleep(RETRY_DELAYS_MS[attempts - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
  }
}

function normalizeTaskInput(
  input: YouzhaoCollectionTaskInput,
): Required<Pick<YouzhaoCollectionTaskInput, "city" | "mode" | "pageSize">> &
  Pick<YouzhaoCollectionTaskInput, "maxPages" | "maxItems" | "confirmed" | "confirmedTotal"> {
  const city = typeof input.city === "string" ? input.city.trim() : "";
  if (!city) {
    throw new Error("city is required");
  }

  if (input.mode === "smoke") {
    return {
      city,
      mode: "smoke",
      pageSize: SMOKE_PAGE_SIZE,
      maxPages: SMOKE_MAX_PAGES,
      maxItems: SMOKE_MAX_ITEMS,
    };
  }

  const pageSize = normalizeBoundedInteger(input.pageSize, 50, 1, 50, "pageSize");
  return {
    city,
    mode: "full",
    pageSize,
    maxPages: input.maxPages,
    maxItems: input.maxItems,
    confirmed: input.confirmed,
    confirmedTotal: input.confirmedTotal,
  };
}

function normalizeBoundedInteger(value: unknown, fallback: number, min: number, max: number, field: string): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return numberValue;
}

function shouldStopBeforeNextPage(state: YouzhaoCollectionTaskState): boolean {
  if (state.mode === "smoke") {
    return (
      (state.maxPages !== undefined && state.processedPages >= state.maxPages) ||
      (state.maxItems !== undefined && state.processedItems >= state.maxItems)
    );
  }

  return state.totalFromApi !== null && state.processedItems >= state.totalFromApi;
}

function finalizeCompletedState(state: YouzhaoCollectionTaskState): YouzhaoCollectionTaskState {
  if (state.mode === "smoke") {
    return {
      ...state,
      status: "smoke_completed",
      countConsistencyPassed: null,
      countDifference: null,
      updatedAt: new Date().toISOString(),
    };
  }

  const expectedTotal = state.totalFromApi ?? state.confirmedTotal ?? null;
  const actual = state.counts.imported + state.counts.duplicate + state.counts.update_candidate + state.counts.invalid;
  const countDifference = expectedTotal === null ? null : actual - expectedTotal;
  const countConsistencyPassed = expectedTotal !== null && countDifference === 0 && state.failedPages.length === 0;
  const status: YouzhaoTaskStatus = countConsistencyPassed ? "completed" : "count_mismatch";
  return {
    ...state,
    status,
    countConsistencyPassed,
    countDifference,
    updatedAt: new Date().toISOString(),
  };
}

function finalizeFailedPage(
  state: YouzhaoCollectionTaskState,
  page: number,
  attempts: number,
  rawStatus: YouzhaoPageCollectResult["status"],
): YouzhaoCollectionTaskState {
  const status = mapCollectStatusToTaskStatus(rawStatus);
  const failedStatus = mapCollectStatusToFailedPageStatus(rawStatus);
  return {
    ...state,
    status,
    failedPages: [...state.failedPages, { page, attempts, status: failedStatus }],
    lastErrorStatus: rawStatus,
    updatedAt: new Date().toISOString(),
  };
}

function mapCollectStatusToTaskStatus(status: YouzhaoPageCollectResult["status"]): YouzhaoTaskStatus {
  if (
    status === "requires_login" ||
    status === "forbidden" ||
    status === "blocked" ||
    status === "schema_changed" ||
    status === "timeout"
  ) {
    return status;
  }
  return "failed";
}

function mapCollectStatusToFailedPageStatus(status: YouzhaoPageCollectResult["status"]): YouzhaoFailedPageStatus {
  if (
    status === "timeout" ||
    status === "network_error" ||
    status === "server_error" ||
    status === "requires_login" ||
    status === "forbidden" ||
    status === "blocked" ||
    status === "schema_changed"
  ) {
    return status;
  }
  return "server_error";
}

function mapSessionStatusToTaskStatus(status: string): YouzhaoTaskStatus {
  if (
    status === "requires_login" ||
    status === "forbidden" ||
    status === "blocked" ||
    status === "schema_changed" ||
    status === "timeout"
  ) {
    return status;
  }
  return "failed";
}

function isRetryableStatus(status: YouzhaoPageCollectResult["status"]): boolean {
  return status === "timeout" || status === "network_error" || status === "server_error" || status === "failed";
}

function mergeLayerCounts(
  existing: Partial<Record<DingmapTargetLayer, number>>,
  rows: ImportPreviewRow[],
): Partial<Record<DingmapTargetLayer, number>> {
  const next = { ...existing };
  for (const row of rows) {
    const layer = row.targetLayer as DingmapTargetLayer | null | undefined;
    if (layer) {
      next[layer] = (next[layer] ?? 0) + 1;
    }
  }
  return next;
}

function addProcessedSourceIdHashes(rows: RawImportRow[]): void {
  for (const row of rows) {
    const sourceId = resolveRawSourceId(row);
    if (sourceId) {
      processedSourceIdHashes.add(hashSourceId(sourceId));
    }
  }
}

function resolveRawSourceId(row: RawImportRow): string | null {
  if (row.sourceId) {
    return row.sourceId;
  }
  const siteId = normalizeString(row.raw.siteId);
  const jobId = normalizeString(row.raw.jobId);
  if (siteId && jobId) {
    return `${siteId}:${jobId}`;
  }
  return jobId || null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashSourceId(sourceId: string): string {
  return createHash("sha256").update(sourceId).digest("hex");
}

function writeCheckpoint(state: YouzhaoCollectionTaskState, checkpointDir?: string): void {
  const checkpoint: YouzhaoCollectionCheckpoint = {
    ...cloneState(state),
    schemaVersion: 1,
    processedSourceIdHashes: Array.from(processedSourceIdHashes).sort(),
  };
  const checkpointPath = getYouzhaoCheckpointPath(state.city, checkpointDir, state.mode);
  mkdirSync(checkpointDir ?? DEFAULT_CHECKPOINT_DIR, { recursive: true });
  const temporaryPath = `${checkpointPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(checkpoint, null, 2), "utf8");
  replaceFileSync(temporaryPath, checkpointPath);
  writeCurrentState(state, checkpointDir);
}

function writeCurrentState(state: YouzhaoCollectionTaskState, checkpointDir?: string): void {
  const directory = checkpointDir ?? DEFAULT_CHECKPOINT_DIR;
  const currentPath = join(directory, CURRENT_TASK_FILENAME);
  mkdirSync(directory, { recursive: true });
  const temporaryPath = `${currentPath}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(cloneState(state), null, 2), "utf8");
  replaceFileSync(temporaryPath, currentPath);
}

function replaceFileSync(temporaryPath: string, targetPath: string): void {
  try {
    renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (!isWindowsReplacePermissionError(error)) {
      throw error;
    }
    rmSync(targetPath, { force: true });
    renameSync(temporaryPath, targetPath);
  }
}

function isWindowsReplacePermissionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code !== undefined &&
    ["EPERM", "EACCES"].includes(String((error as NodeJS.ErrnoException).code))
  );
}

function readCurrentState(checkpointDir?: string): YouzhaoCollectionTaskState | null {
  const directory = checkpointDir ?? DEFAULT_CHECKPOINT_DIR;
  const currentPath = join(directory, CURRENT_TASK_FILENAME);
  if (!existsSync(currentPath)) {
    return readLatestCheckpointState(directory);
  }
  const parsed = JSON.parse(readFileSync(currentPath, "utf8")) as Partial<YouzhaoCollectionTaskState>;
  if (!isTaskStateLike(parsed)) {
    return null;
  }
  return cloneState(parsed);
}

function readTaskStateByLookup(
  checkpointDir: string,
  options: YouzhaoTaskLookupOptions,
): YouzhaoCollectionTaskState | null {
  const city = typeof options.city === "string" ? options.city.trim() : "";
  const mode = options.mode;
  if (currentTask.status !== "idle") {
    const cityMatches = !city || currentTask.city === city;
    const modeMatches = !mode || currentTask.mode === mode;
    if (cityMatches && modeMatches) {
      return cloneState(currentTask);
    }
  }

  const current = readCurrentState(checkpointDir);
  if (current) {
    const cityMatches = !city || current.city === city;
    const modeMatches = !mode || current.mode === mode;
    if (cityMatches && modeMatches) {
      return cloneState(current);
    }
  }

  if (city && mode) {
    const checkpoint = readCheckpoint(city, checkpointDir, mode);
    return checkpoint ? checkpointToStateForCurrent(checkpoint) : null;
  }

  if (city) {
    const states = (["full", "smoke"] as const)
      .map((candidateMode) => readCheckpoint(city, checkpointDir, candidateMode))
      .filter((checkpoint): checkpoint is YouzhaoCollectionCheckpoint => Boolean(checkpoint))
      .map(checkpointToStateForCurrent)
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    return states[0] ?? null;
  }

  if (mode) {
    const latest = readLatestCheckpointState(checkpointDir);
    return latest?.mode === mode ? latest : null;
  }

  return null;
}

function readLatestCheckpointState(checkpointDir: string): YouzhaoCollectionTaskState | null {
  if (!existsSync(checkpointDir)) {
    return null;
  }

  const candidates = readdirSync(checkpointDir)
    .filter((filename) => filename.endsWith(".json") && filename !== CURRENT_TASK_FILENAME)
    .map((filename) => {
      try {
        const parsed = JSON.parse(readFileSync(join(checkpointDir, filename), "utf8")) as Partial<YouzhaoCollectionCheckpoint>;
        return parsed.schemaVersion === 1 ? checkpointToStateForCurrent(parsed as YouzhaoCollectionCheckpoint) : null;
      } catch {
        return null;
      }
    })
    .filter((state): state is YouzhaoCollectionTaskState => Boolean(state))
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));

  return candidates[0] ?? null;
}

function checkpointToStateForCurrent(checkpoint: YouzhaoCollectionCheckpoint): YouzhaoCollectionTaskState {
  const { schemaVersion: _schemaVersion, processedSourceIdHashes: _processedSourceIdHashes, ...state } = checkpoint;
  return cloneState(state);
}

function isTaskStateLike(value: Partial<YouzhaoCollectionTaskState>): value is YouzhaoCollectionTaskState {
  return (
    typeof value.city === "string" &&
    (value.mode === "smoke" || value.mode === "full") &&
    typeof value.status === "string" &&
    YOUZHAO_TASK_STATUSES.includes(value.status as YouzhaoTaskStatus) &&
    typeof value.currentPage === "number" &&
    typeof value.nextPage === "number" &&
    typeof value.pageSize === "number" &&
    typeof value.processedPages === "number" &&
    typeof value.processedItems === "number" &&
    (typeof value.totalFromApi === "number" || value.totalFromApi === null) &&
    Boolean(value.counts) &&
    typeof value.targetLayerCounts === "object" &&
    value.targetLayerCounts !== null &&
    Array.isArray(value.failedPages)
  );
}

function readCheckpoint(
  city: string,
  checkpointDir?: string,
  mode: YouzhaoTaskMode = "smoke",
): YouzhaoCollectionCheckpoint | null {
  const checkpointPath = getYouzhaoCheckpointPath(city, checkpointDir, mode);
  if (!existsSync(checkpointPath)) {
    return null;
  }
  const parsed = JSON.parse(readFileSync(checkpointPath, "utf8")) as Partial<YouzhaoCollectionCheckpoint>;
  if (parsed.schemaVersion !== 1 || parsed.city !== city) {
    return null;
  }
  return {
    ...buildIdleState(city, parsed.mode === "full" ? "full" : mode),
    ...parsed,
    schemaVersion: 1,
    processedSourceIdHashes: Array.isArray(parsed.processedSourceIdHashes)
      ? parsed.processedSourceIdHashes.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function checkpointToState(checkpoint: YouzhaoCollectionCheckpoint): YouzhaoCollectionTaskState {
  const { schemaVersion: _schemaVersion, processedSourceIdHashes: _processedSourceIdHashes, ...state } = checkpoint;
  return {
    ...state,
    status: "running",
    updatedAt: new Date().toISOString(),
  };
}

function buildIdleState(city: string, mode: YouzhaoTaskMode = "smoke"): YouzhaoCollectionTaskState {
  return {
    city,
    mode,
    status: "idle",
    currentPage: 0,
    nextPage: 1,
    pageSize: mode === "full" ? 50 : SMOKE_PAGE_SIZE,
    processedPages: 0,
    processedItems: 0,
    totalFromApi: null,
    totalPages: null,
    completedPages: [],
    countConsistencyPassed: null,
    countDifference: null,
    counts: {
      imported: 0,
      duplicate: 0,
      update_candidate: 0,
      invalid: 0,
      filteredNonRecruiting: 0,
    },
    targetLayerCounts: {},
    failedPages: [],
  };
}

function cloneState(state: YouzhaoCollectionTaskState): YouzhaoCollectionTaskState {
  return {
    ...state,
    totalPages: state.totalPages ?? null,
    completedPages: Array.isArray(state.completedPages) ? [...state.completedPages] : [],
    countConsistencyPassed: state.countConsistencyPassed ?? null,
    countDifference: state.countDifference ?? null,
    counts: { ...state.counts },
    targetLayerCounts: { ...state.targetLayerCounts },
    failedPages: state.failedPages.map((page) => ({ ...page })),
  };
}

async function collectYouzhaoPage(input: YouzhaoPageCollectInput): Promise<YouzhaoPageCollectResult> {
  const result = await previewYouzhaoPositionsForImport({
    city: input.city,
    page: input.page,
    pageSize: input.pageSize,
    limit: input.limit,
  } satisfies YouzhaoQueryInput);
  return {
    status: result.status,
    total: result.total,
    rawRows: result.rawRows,
    rows: result.rows,
    filteredNonRecruiting: result.filteredNonRecruiting,
  };
}

async function defaultImportRows(
  rows: RawImportRow[],
  options: ImportCleanMarkersOptions,
): Promise<ImportCleanMarkersResult> {
  return importCleanMarkers(rows, options);
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
