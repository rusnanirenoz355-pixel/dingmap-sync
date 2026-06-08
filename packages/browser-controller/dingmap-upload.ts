import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_TARGET_TEAM_TITLE,
  dingmapSelectors,
} from "./dingmap-selectors";

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

export interface DingmapUploadBrowserSession {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export interface DingmapUploadBrowserOptions {
  exportFilePath: string;
  profileDir: string;
  screenshotsDir: string;
  mapUrl?: string;
  timeoutMs?: number;
  session?: DingmapUploadBrowserSession;
  onStatus?: (status: DingmapUploadStatus, message: string) => void;
}

export interface DingmapUploadBrowserResult {
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

export async function runDingmapUploadBrowser(
  options: DingmapUploadBrowserOptions,
): Promise<DingmapUploadBrowserResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const entryUrl = options.mapUrl ?? DINGMAP_HOME_URL;
  const session = options.session ?? (await openDingmapUploadSession(options.profileDir));

  try {
    updateStatus(options, "opening_dingmap", "正在打开钉图地图列表。");
    await session.page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForPageSettled(session.page);

    const initialBlock = await detectLoginOrCaptcha(session.page, options.screenshotsDir);
    if (initialBlock) {
      if (initialBlock.status !== "requires_login") {
        await session.close();
      }
      return initialBlock.status === "requires_login" ? { ...initialBlock, session } : initialBlock;
    }

    const targetMapOpened = await openTargetTeamMap(
      session.page,
      options.screenshotsDir,
      startedAt,
      timeoutMs,
    );
    if (targetMapOpened) {
      return closeAndReturn(session, targetMapOpened);
    }

    const mapBlock = await detectLoginOrCaptcha(session.page, options.screenshotsDir);
    if (mapBlock) {
      if (mapBlock.status !== "requires_login") {
        await session.close();
      }
      return mapBlock.status === "requires_login" ? { ...mapBlock, session } : mapBlock;
    }

    const importDialogOpened = await openLayerDataImportDialog(
      session.page,
      options.screenshotsDir,
      startedAt,
      timeoutMs,
    );
    if (importDialogOpened) {
      return closeAndReturn(session, importDialogOpened);
    }

    const uploadReady = await prepareAddDataUploadDialog(
      session.page,
      options.screenshotsDir,
    );
    if (uploadReady) {
      return closeAndReturn(session, uploadReady);
    }

    updateStatus(options, "uploading", "正在上传钉图模板 Excel。");
    const uploaded = await uploadExportFile(
      session.page,
      options.exportFilePath,
      startedAt,
      timeoutMs,
    );
    if (!uploaded) {
      return closeAndReturn(
        session,
        await stageResult(
          session.page,
          options.screenshotsDir,
          "upload-input",
          "blocked",
          "未确认钉图页面已选择当前 Excel 文件，已停止点击“导入”。",
        ),
      );
    }

    updateStatus(options, "confirming", "已选择导入文件，正在点击右下角“导入”。");
    const confirmed = await clickFirstEnabledVisible(
      session.page,
      dingmapSelectors.confirmButtons,
    );
    if (!confirmed) {
      return closeAndReturn(
        session,
        await stageResult(
          session.page,
          options.screenshotsDir,
          "import-confirm",
          "blocked",
          "已选择导入文件，但未找到可点击的右下角“导入”按钮。",
        ),
      );
    }

    const result = await waitForUploadResult(session.page, startedAt, timeoutMs);

    await session.close();
    if (result.status !== "unknown") {
      return result;
    }

    return {
      status: "unknown",
      message: "文件已选择并点击“导入”，但页面没有可靠的成功或失败提示，需要人工确认。",
      submitted: true,
    };
  } catch (error) {
    const screenshotPath = await saveStageScreenshot(session.page, options.screenshotsDir, "error");
    await session.close();
    return {
      status: Date.now() - startedAt >= timeoutMs ? "timeout" : "failed",
      message: error instanceof Error ? error.message : String(error),
      screenshotPath,
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
): Promise<DingmapUploadBrowserResult | null> {
  if (!(await clickFirstEnabledVisible(page, dingmapSelectors.layerMoreButtons))) {
    return stageResult(
      page,
      screenshotsDir,
      "layer-more",
      "blocked",
      "未找到“图层列表”当前图层区域里的“更多”按钮，页面结构可能已变化。",
    );
  }

  if (!(await clickFirstEnabledVisible(page, dingmapSelectors.dataImportMenuItems))) {
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

  if (Date.now() - startedAt >= timeoutMs) {
    return stageResult(page, screenshotsDir, "open-import-timeout", "timeout", "打开数据导入窗口超时。");
  }

  return null;
}

async function prepareAddDataUploadDialog(
  page: Page,
  screenshotsDir: string,
): Promise<DingmapUploadBrowserResult | null> {
  if (!(await clickFirstEnabledVisible(page, dingmapSelectors.addDataTabs))) {
    return stageResult(
      page,
      screenshotsDir,
      "add-data-tab",
      "blocked",
      "未找到“新增数据”页签，无法确认当前导入模式。",
    );
  }

  if (!(await hasVisibleSelector(page, dingmapSelectors.coordinateTypeIndicators, SHORT_WAIT_MS))) {
    // 坐标类型允许保持钉图默认值；这里不强行失败，只保留后续结果判断。
  }

  return null;
}

async function uploadExportFile(
  page: Page,
  exportFilePath: string,
  startedAt: number,
  timeoutMs: number,
): Promise<boolean> {
  const filename = basename(exportFilePath);

  for (const selector of dingmapSelectors.uploadZones) {
    try {
      const locator = page.locator(selector).first();
      if (!(await isLocatorVisible(locator))) {
        continue;
      }

      const fileChooserPromise = page
        .waitForEvent("filechooser", {
          timeout: SHORT_WAIT_MS,
        })
        .catch(() => null);
      await locator.click({ timeout: SHORT_WAIT_MS });
      const fileChooser = await fileChooserPromise;
      if (fileChooser) {
        await fileChooser.setFiles(exportFilePath);
        return waitForSelectedExportFile(page, filename);
      }

      const inputAfterClick = await findFirstExistingInput(page, dingmapSelectors.fileInputs);
      if (inputAfterClick) {
        await inputAfterClick.setInputFiles(exportFilePath, {
          timeout: remainingTimeout(startedAt, timeoutMs),
        });
        return waitForSelectedExportFile(page, filename);
      }
    } catch {
      // Continue trying other upload entry selectors.
    }
  }

  const existingInput = await findFirstExistingInput(page, dingmapSelectors.fileInputs);
  if (!existingInput) {
    return false;
  }

  await existingInput.setInputFiles(exportFilePath, {
    timeout: remainingTimeout(startedAt, timeoutMs),
  });
  return waitForSelectedExportFile(page, filename);
}

async function openDingmapUploadSession(profileDir: string): Promise<DingmapUploadBrowserSession> {
  mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1365, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return {
    context,
    page,
    close: async () => {
      await context.close();
    },
  };
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
      if (await isLocatorVisible(page.locator(selector).first(), timeoutMs)) {
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

async function findFirstExistingInput(page: Page, selectors: SelectorGroup): Promise<Locator | null> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        return locator;
      }
    } catch {
      // Continue trying other selectors.
    }
  }
  return null;
}

async function waitForSelectedExportFile(page: Page, filename: string): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MEDIUM_WAIT_MS) {
    if (await hasFileInputWithFilename(page, filename)) {
      return true;
    }

    if (await waitForLocatorVisible(page.getByText(filename, { exact: false }).first(), SHORT_WAIT_MS)) {
      return true;
    }

    await page.waitForTimeout(300);
  }

  return false;
}

async function hasFileInputWithFilename(page: Page, filename: string): Promise<boolean> {
  try {
    return await page.locator("input[type='file']").evaluateAll((inputs, expectedFilename) => {
      return inputs.some((input) => {
        const fileInput = input as HTMLInputElement;
        return Array.from(fileInput.files ?? []).some((file) => file.name === expectedFilename);
      });
    }, filename);
  } catch {
    return false;
  }
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

async function waitForUploadResult(
  page: Page,
  startedAt: number,
  timeoutMs: number,
): Promise<DingmapUploadBrowserResult> {
  while (Date.now() - startedAt < timeoutMs) {
    if (await hasVisibleSelector(page, dingmapSelectors.successIndicators)) {
      return {
        status: "success",
        message: "钉图页面显示导入成功。",
        submitted: true,
      };
    }

    if (await hasVisibleSelector(page, dingmapSelectors.failureIndicators)) {
      return {
        status: "failed",
        message: "钉图页面显示导入失败或校验失败。",
        submitted: true,
      };
    }

    await page.waitForTimeout(1_000);
  }

  return {
    status: "unknown",
    message: "文件已提交给钉图，但等待期间没有可靠的成功或失败提示。",
    submitted: true,
  };
}

async function stageResult(
  page: Page,
  screenshotsDir: string,
  stage: string,
  status: Extract<DingmapUploadStatus, "failed" | "blocked" | "timeout">,
  message: string,
): Promise<DingmapUploadBrowserResult> {
  return {
    status,
    message,
    screenshotPath: await saveStageScreenshot(page, screenshotsDir, stage),
  };
}

async function closeAndReturn(
  session: DingmapUploadBrowserSession,
  result: DingmapUploadBrowserResult,
): Promise<DingmapUploadBrowserResult> {
  await session.close();
  return result;
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
): void {
  options.onStatus?.(status, message);
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
