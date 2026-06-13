import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_TARGET_TEAM_TITLE,
  buildLayerMoreButtonSelectors,
  dingmapSelectors,
} from "./dingmap-selectors";
import {
  DingMapImportDialogController,
  isDingmapConfirmedMarsCoordinateText,
  isDingmapConfirmedSmallMarkerSizeText,
  type ImportOptionResult,
} from "./dingmap-import-dialog";
import {
  resolveDingmapPlatform,
  type DingmapPlatformConfig,
  type DingmapPlatformKey,
} from "./dingmap-platforms";

export {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_TARGET_TEAM_TITLE,
};

export type DingmapUploadStatus =
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

export interface DingmapUploadStatusDetails {
  stage?: string;
  confirmedCoordinateType?: string;
  confirmedMarkerStyle?: string;
  confirmedMarkerSize?: string;
}

export interface DingmapUploadBrowserSession {
  context: BrowserContext;
  page: Page;
}

export interface DingmapUploadBrowserOptions {
  exportFilePath: string;
  profileDir: string;
  screenshotsDir: string;
  mapUrl?: string;
  platform?: DingmapPlatformKey;
  timeoutMs?: number;
  session?: DingmapUploadBrowserSession;
  resumeCurrentDialog?: boolean;
  onStatus?: (
    status: DingmapUploadStatus,
    message: string,
    details?: DingmapUploadStatusDetails,
  ) => void;
}

export interface DingmapUploadBrowserResult extends DingmapUploadStatusDetails {
  status: DingmapUploadStatus;
  message: string;
  screenshotPath?: string;
  submitted?: boolean;
  session?: DingmapUploadBrowserSession;
}

type SelectorGroup = readonly string[];

const DEFAULT_TIMEOUT_MS = 45_000;
const SHORT_WAIT_MS = 1_500;
const MEDIUM_WAIT_MS = 8_000;
export const DINGMAP_BROWSER_CLOSED_MESSAGE =
  "自动化浏览器已关闭，请点击“重置上传任务”后重新开始。";
export const DINGMAP_COORDINATE_TYPE_CONFIRMATION_MESSAGE =
  "\u672a\u80fd\u786e\u8ba4\u5750\u6807\u7c7b\u578b\uff0c\u8bf7\u68c0\u67e5\u9489\u56fe\u5bfc\u5165\u5f39\u7a97\u4e2d\u7684\u5750\u6807\u7c7b\u578b\u4e0b\u62c9\u6846\u3002";

const DINGMAP_MARKER_STYLE_CONFIRMATION_MESSAGE =
  "\u672a\u80fd\u8bbe\u7f6e\u6807\u8bb0\u6837\u5f0f\uff0c\u8bf7\u68c0\u67e5\u9489\u56fe\u5bfc\u5165\u5f39\u7a97\u4e2d\u7684\u6807\u8bb0\u6837\u5f0f\u9009\u62e9\u5668\u3002";
const DINGMAP_MARKER_SIZE_CONFIRMATION_MESSAGE =
  "\u672a\u80fd\u8bbe\u7f6e\u6807\u8bb0\u5927\u5c0f\uff0c\u8bf7\u68c0\u67e5\u9489\u56fe\u5bfc\u5165\u5f39\u7a97\u4e2d\u7684\u6807\u8bb0\u5927\u5c0f\u4e0b\u62c9\u6846\u3002";

export async function runDingmapUploadBrowser(
  options: DingmapUploadBrowserOptions,
): Promise<DingmapUploadBrowserResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const entryUrl = options.mapUrl ?? DINGMAP_HOME_URL;
  const platform = resolveDingmapPlatform(options.platform);
  const session = isDingmapUploadSessionUsable(options.session)
    ? options.session
    : await openDingmapUploadSession(options.profileDir);
  const resumeCurrentDialog = Boolean(options.resumeCurrentDialog && options.session === session);

  try {
    if (resumeCurrentDialog) {
      updateStatus(options, "opening_dingmap", "正在从当前钉图导入弹窗继续上传。", {
        stage: "resume-current-dialog",
      });
      await session.page.bringToFront().catch(() => undefined);

      if (!(await hasVisibleSelector(session.page, dingmapSelectors.dataImportDialog, SHORT_WAIT_MS))) {
        const result = await stageResult(
          session.page,
          options.screenshotsDir,
          "resume-import-dialog",
          "blocked",
          "未检测到可继续的钉图数据导入弹窗，请重新打开导入窗口后再继续。",
        );
        return { ...result, session };
      }
    } else {
      updateStatus(options, "opening_dingmap", `正在打开钉图地图列表，目标平台：${platform.label}。`);
      await session.page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await waitForPageSettled(session.page);

      const initialBlock = await detectLoginOrCaptcha(session.page, options.screenshotsDir);
      if (initialBlock) {
        return initialBlock.status === "requires_login" ? { ...initialBlock, session } : initialBlock;
      }

      const targetMapOpened = await openTargetTeamMap(
        session.page,
        options.screenshotsDir,
        startedAt,
        timeoutMs,
      );
      if (targetMapOpened) {
        return { ...targetMapOpened, session };
      }

      const mapBlock = await detectLoginOrCaptcha(session.page, options.screenshotsDir);
      if (mapBlock) {
        return mapBlock.status === "requires_login" ? { ...mapBlock, session } : mapBlock;
      }

      const importDialogOpened = await openLayerDataImportDialog(
        session.page,
        options.screenshotsDir,
        startedAt,
        timeoutMs,
        platform,
      );
      if (importDialogOpened) {
        return { ...importDialogOpened, session };
      }
    }

    const importDialog = new DingMapImportDialogController(session.page, {
      platform,
      exportFilePath: options.exportFilePath,
      timeoutMs,
    });
    const uploadReady = await setImportOptions(
      session.page,
      options.screenshotsDir,
      importDialog,
      options,
    );
    if (uploadReady) {
      return { ...uploadReady, session };
    }

    updateStatus(options, "uploading", "正在选择钉图模板 Excel。", {
      stage: "upload-file",
    });
    const uploaded = await importDialog.uploadFile();
    if (uploaded.status !== "ok") {
      const result = await stageResult(
        session.page,
        options.screenshotsDir,
        "upload-input",
        "blocked",
        uploaded.message ?? "未确认钉图页面已选择当前 Excel 文件，已停止点击“导入”。",
      );
      return { ...result, session };
    }

    updateStatus(options, "confirming", "已选择导入文件，正在点击右下角“导入”。");
    const confirmed = await importDialog.clickImport();
    if (confirmed.status !== "ok") {
      const result = await stageResult(
        session.page,
        options.screenshotsDir,
        "import-confirm",
        "blocked",
        confirmed.message ?? "已选择导入文件，但未找到可点击的右下角“导入”按钮。",
      );
      return { ...result, session };
    }

    const resultStartedAt = Date.now();
    updateStatus(options, "confirming", "已点击“导入”，正在等待钉图返回结果。", {
      stage: "wait-result",
    });
    const result = await importDialog.readResult(resultStartedAt);
    if (result.status !== "unknown") {
      return { ...result, session };
    }

    return {
      status: "unknown",
      message: "文件已选择并点击“导入”，但页面没有可靠的成功或失败提示，需要人工确认。",
      submitted: true,
      session,
    };
  } catch (error) {
    const browserClosed = isBrowserClosedError(error);
    const screenshotPath = await saveStageScreenshot(session.page, options.screenshotsDir, "error").catch(
      () => undefined,
    );
    return {
      status: Date.now() - startedAt >= timeoutMs ? "timeout" : "failed",
      message: formatDingmapUploadErrorMessage(error),
      screenshotPath,
      session: isDingmapUploadSessionUsable(session) ? session : undefined,
      stage: browserClosed ? "browser-closed" : undefined,
    };
  }
}

async function openTargetTeamMap(
  page: Page,
  screenshotsDir: string,
  startedAt: number,
  timeoutMs: number,
): Promise<DingmapUploadBrowserResult | null> {
  const teamTitle = page.getByText(DINGMAP_TARGET_TEAM_TITLE, { exact: false }).first();
  if (!(await waitForLocatorVisible(teamTitle, MEDIUM_WAIT_MS))) {
    return stageResult(
      page,
      screenshotsDir,
      "target-team",
      "failed",
      `未找到“${DINGMAP_TARGET_TEAM_TITLE}”，请确认当前钉图账号拥有“${DINGMAP_TARGET_TEAM_NAME}”团队协作地图权限。`,
    );
  }

  await teamTitle.scrollIntoViewIfNeeded({ timeout: SHORT_WAIT_MS }).catch(() => undefined);

  const targetMap = await findTargetMapCardAfterTeam(page);
  if (!targetMap) {
    return stageResult(
      page,
      screenshotsDir,
      "target-map",
      "failed",
      `已找到“${DINGMAP_TARGET_TEAM_TITLE}”，但未找到“${DINGMAP_TARGET_MAP_NAME}”地图，请确认钉图权限或地图名称。`,
    );
  }

  await targetMap.scrollIntoViewIfNeeded({ timeout: SHORT_WAIT_MS }).catch(() => undefined);
  await targetMap.click({ timeout: remainingTimeout(startedAt, timeoutMs) });
  await waitForPageSettled(page);

  if (!(await hasVisibleSelector(page, dingmapSelectors.layerList, MEDIUM_WAIT_MS))) {
    return stageResult(
      page,
      screenshotsDir,
      "layer-list",
      "blocked",
      `已点击“${DINGMAP_TARGET_MAP_NAME}”地图，但未找到左侧“图层列表”，页面结构可能已变化。`,
    );
  }

  return null;
}

async function openLayerDataImportDialog(
  page: Page,
  screenshotsDir: string,
  startedAt: number,
  timeoutMs: number,
  platform: DingmapPlatformConfig,
): Promise<DingmapUploadBrowserResult | null> {
  const layerMoreSelectors = buildLayerMoreButtonSelectors(platform.layerName);

  if (
    !(await clickLayerMoreButtonForLayer(page, platform.layerName)) &&
    !(await clickFirstEnabledVisible(page, layerMoreSelectors))
  ) {
    return stageResult(
      page,
      screenshotsDir,
      "layer-not-found",
      "blocked",
      `未找到图层：${platform.layerName}。请确认当前地图“${DINGMAP_TARGET_MAP_NAME}”的左侧图层列表中存在该图层。`,
    );
  }

  if (!(await clickDataImportMenuItem(page))) {
    return stageResult(
      page,
      screenshotsDir,
      "data-import-menu",
      "blocked",
      "已点击图层“更多”，但未找到“数据导入”菜单项，页面结构可能已变化。",
    );
  }

  await waitForPageSettled(page);
  if (!(await hasVisibleSelector(page, dingmapSelectors.dataImportDialog, SHORT_WAIT_MS))) {
    return stageResult(
      page,
      screenshotsDir,
      "data-import-dialog",
      "blocked",
      "已点击“数据导入”，但未看到“数据导入”窗口。",
    );
  }

  return null;
}

export async function clickLayerMoreButtonForLayer(page: Page, layerName: string): Promise<boolean> {
  const labels = page.getByText(layerName, { exact: true });
  const labelCount = await labels.count().catch(() => 0);
  const candidates = page.locator("button, [role='button'], [aria-label*='更多'], [title*='更多']");
  const candidateCount = await candidates.count().catch(() => 0);
  let best: { locator: Locator; score: number } | null = null;

  for (let labelIndex = 0; labelIndex < labelCount; labelIndex += 1) {
    const label = labels.nth(labelIndex);
    if (!(await isLocatorVisible(label))) {
      continue;
    }
    const labelBox = await label.boundingBox().catch(() => null);
    if (!labelBox) {
      continue;
    }
    const labelCenterY = labelBox.y + labelBox.height / 2;

    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
      const candidate = candidates.nth(candidateIndex);
      if (!(await isLocatorVisible(candidate))) {
        continue;
      }
      const isMoreButton = await candidate
        .evaluate((element) => {
          const text = String((element as HTMLElement).innerText ?? element.textContent ?? "");
          const ariaLabel = String(element.getAttribute("aria-label") ?? "");
          const title = String(element.getAttribute("title") ?? "");
          return [text, ariaLabel, title].some((value) => value.replace(/\s+/g, "").includes("更多"));
        })
        .catch(() => false);
      if (!isMoreButton) {
        continue;
      }
      const candidateBox = await candidate.boundingBox().catch(() => null);
      if (!candidateBox) {
        continue;
      }
      const candidateCenterY = candidateBox.y + candidateBox.height / 2;
      const yDistance = Math.abs(candidateCenterY - labelCenterY);
      if (yDistance > Math.max(34, labelBox.height * 1.8)) {
        continue;
      }
      if (candidateBox.x < labelBox.x) {
        continue;
      }
      const xDistance = Math.max(0, candidateBox.x - (labelBox.x + labelBox.width));
      const score = yDistance * 1000 + xDistance;
      if (!best || score < best.score) {
        best = { locator: candidate, score };
      }
    }
  }

  if (!best) {
    return false;
  }

  await best.locator.click({ timeout: SHORT_WAIT_MS });
  return true;
}

export async function clickDataImportMenuItem(page: Page): Promise<boolean> {
  const controlId = `dingmap-data-import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const foundExactVisibleText = await page
    .evaluate((id) => {
      const normalize = (value: string | null | undefined) => String(value ?? "").replace(/\s+/g, "");
      const candidates = Array.from(document.querySelectorAll("body *"))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            normalize(element.innerText || element.textContent) === "数据导入"
          );
        })
        .sort((left, right) => {
          const leftBox = left.getBoundingClientRect();
          const rightBox = right.getBoundingClientRect();
          return leftBox.width * leftBox.height - rightBox.width * rightBox.height;
        });
      const target = candidates[0];
      if (!target) {
        return false;
      }
      target.setAttribute("data-dingmap-data-import-menu-id", id);
      return true;
    }, controlId)
    .catch(() => false);

  if (foundExactVisibleText) {
    const target = page.locator(`[data-dingmap-data-import-menu-id="${controlId}"]`).first();
    await target.click({ timeout: SHORT_WAIT_MS, force: true }).catch(async () => {
      await target.dispatchEvent("click");
    });
    return true;
  }

  return clickFirstVisible(page, dingmapSelectors.dataImportMenuItems);
}

async function setImportOptions(
  page: Page,
  screenshotsDir: string,
  controller: DingMapImportDialogController,
  options: DingmapUploadBrowserOptions,
): Promise<DingmapUploadBrowserResult | null> {
  updateStatus(options, "opening_dingmap", "正在确认钉图新增数据导入页签。", {
    stage: "confirm-add-data-tab",
  });

  const result = await controller.setImportOptions();
  const details = toUploadStatusDetails(result);

  if (result.status !== "ok") {
    const blockedStage = getImportOptionBlockedStage(result);
    return stageResult(
      page,
      screenshotsDir,
      blockedStage,
      "blocked",
      getImportOptionBlockedMessage(blockedStage),
      details,
    );
  }

  updateStatus(options, "opening_dingmap", "已确认钉图标记大小：小。", {
    stage: "upload-file",
    ...details,
  });

  return null;
}

function toUploadStatusDetails(result: ImportOptionResult): DingmapUploadStatusDetails {
  return {
    confirmedCoordinateType: result.confirmedCoordinateType,
    confirmedMarkerStyle: result.confirmedMarkerStyle,
    confirmedMarkerSize: result.confirmedMarkerSize,
  };
}

function getImportOptionBlockedStage(result: ImportOptionResult): string {
  if (!result.confirmedCoordinateType || !isDingmapMarsCoordinateText(result.confirmedCoordinateType)) {
    return "set-coordinate-type";
  }
  if (!result.confirmedMarkerStyle || result.confirmedMarkerStyle === "未确认") {
    return "set-marker-style";
  }
  return "set-marker-size";
}

function getImportOptionBlockedMessage(stage: string): string {
  if (stage === "set-coordinate-type") {
    return DINGMAP_COORDINATE_TYPE_CONFIRMATION_MESSAGE;
  }
  if (stage === "set-marker-style") {
    return DINGMAP_MARKER_STYLE_CONFIRMATION_MESSAGE;
  }
  return DINGMAP_MARKER_SIZE_CONFIRMATION_MESSAGE;
}

export function isDingmapMarsCoordinateText(value: string): boolean {
  return isDingmapConfirmedMarsCoordinateText(value);
}

export function isDingmapSmallMarkerSizeText(value: string): boolean {
  return isDingmapConfirmedSmallMarkerSizeText(value);
}

export async function openDingmapUploadSession(profileDir: string): Promise<DingmapUploadBrowserSession> {
  mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1365, height: 900 },
  });
  const page =
    context.pages().find((candidate) => candidate.url().includes("dm.dingmap.com")) ??
    context.pages()[0] ??
    (await context.newPage());
  return { context, page };
}

export function isDingmapUploadSessionUsable(
  session?: DingmapUploadBrowserSession | null,
): session is DingmapUploadBrowserSession {
  return Boolean(session && !session.page.isClosed());
}

export function formatDingmapUploadErrorMessage(error: unknown): string {
  if (isBrowserClosedError(error)) {
    return DINGMAP_BROWSER_CLOSED_MESSAGE;
  }

  return error instanceof Error ? error.message : String(error);
}

function isBrowserClosedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Target page, context or browser has been closed|Target page closed|page has been closed|browser has been closed|context .*closed/i.test(
    message,
  );
}

async function detectLoginOrCaptcha(
  page: Page,
  screenshotsDir: string,
): Promise<DingmapUploadBrowserResult | null> {
  if (await hasVisibleSelector(page, dingmapSelectors.captchaIndicators)) {
    return stageResult(
      page,
      screenshotsDir,
      "captcha",
      "blocked",
      "钉图页面出现验证码或人机验证，需要人工处理。",
    );
  }

  if (await isLoginRequired(page)) {
    return {
      status: "requires_login",
      message: "钉图需要登录。请在已打开的 Playwright 浏览器中手动登录，然后点击继续上传。",
      session: undefined,
    };
  }

  return null;
}

async function isLoginRequired(page: Page): Promise<boolean> {
  if (/login|signin/i.test(page.url())) {
    return true;
  }

  return hasVisibleSelector(page, dingmapSelectors.loginIndicators);
}

async function hasVisibleSelector(
  page: Page,
  selectors: SelectorGroup,
  timeoutMs = SHORT_WAIT_MS,
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      if (await waitForAnyLocatorVisible(page.locator(selector), timeoutMs)) {
        return true;
      }
    } catch {
      // Continue trying other selectors; DingMap markup is outside our control.
    }
  }
  return false;
}

async function clickFirstEnabledVisible(page: Page, selectors: SelectorGroup): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        continue;
      }

      await locator.scrollIntoViewIfNeeded({ timeout: SHORT_WAIT_MS }).catch(() => undefined);
      if ((await isLocatorVisible(locator)) && (await locator.isEnabled())) {
        await locator.click({ timeout: SHORT_WAIT_MS });
        return true;
      }
    } catch {
      // Continue trying other selectors.
    }
  }
  return false;
}

async function clickFirstVisible(page: Page, selectors: SelectorGroup): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        continue;
      }

      await locator.scrollIntoViewIfNeeded({ timeout: SHORT_WAIT_MS }).catch(() => undefined);
      if (await isLocatorVisible(locator)) {
        await locator.click({ timeout: SHORT_WAIT_MS });
        return true;
      }
    } catch {
      // Continue trying other selectors.
    }
  }
  return false;
}

async function findTargetMapCardAfterTeam(page: Page): Promise<Locator | null> {
  const teamText = toXPathString(DINGMAP_TARGET_TEAM_TITLE);
  const mapText = toXPathString(DINGMAP_TARGET_MAP_NAME);
  const candidates = [
    `xpath=(//*[text()[contains(normalize-space(.), ${teamText})]]/following::*[text()[contains(normalize-space(.), ${mapText})]])[1]`,
    `xpath=(//*[contains(normalize-space(.), ${teamText})]/following::*[contains(normalize-space(.), ${mapText})])[1]`,
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await waitForLocatorVisible(locator, SHORT_WAIT_MS)) {
      return locator;
    }
  }

  const uniqueMapByText = page.getByText(DINGMAP_TARGET_MAP_NAME, { exact: true });
  if ((await uniqueMapByText.count().catch(() => 0)) === 1) {
    const locator = uniqueMapByText.first();
    return (await waitForLocatorVisible(locator, SHORT_WAIT_MS)) ? locator : null;
  }

  return null;
}

async function stageResult(
  page: Page,
  screenshotsDir: string,
  stage: string,
  status: Extract<DingmapUploadStatus, "failed" | "blocked" | "timeout">,
  message: string,
  details?: DingmapUploadStatusDetails,
): Promise<DingmapUploadBrowserResult> {
  return {
    ...details,
    status,
    message,
    stage,
    screenshotPath: await saveStageScreenshot(page, screenshotsDir, stage).catch(() => undefined),
  };
}

async function saveStageScreenshot(
  page: Page,
  screenshotsDir: string,
  stage: string,
): Promise<string> {
  mkdirSync(screenshotsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const screenshotPath = join(screenshotsDir, `${timestamp}-${stage}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function waitForPageSettled(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: MEDIUM_WAIT_MS }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: MEDIUM_WAIT_MS }).catch(() => undefined);
}

async function waitForLocatorVisible(locator: Locator, timeoutMs: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function waitForAnyLocatorVisible(locator: Locator, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) {
        return true;
      }
    }
    await locator.page().waitForTimeout(100).catch(() => undefined);
  }

  return false;
}

async function isLocatorVisible(locator: Locator, timeoutMs = SHORT_WAIT_MS): Promise<boolean> {
  return waitForLocatorVisible(locator, timeoutMs);
}

function remainingTimeout(startedAt: number, timeoutMs: number): number {
  return Math.max(1_000, timeoutMs - (Date.now() - startedAt));
}

function updateStatus(
  options: DingmapUploadBrowserOptions,
  status: DingmapUploadStatus,
  message: string,
  details?: DingmapUploadStatusDetails,
): void {
  options.onStatus?.(status, message, details);
}

function toXPathString(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
}
