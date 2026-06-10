import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_MAP_URL,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_TARGET_TEAM_TITLE,
  buildLayerMoreButtonSelectors,
  buildMarkerColorSelectors,
  dingmapSelectors,
} from "./dingmap-selectors";
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

const COORDINATE_TYPE_LABEL = "\u5750\u6807\u7c7b\u578b";
const MARS_COORDINATE_TEXT = "\u706b\u661f\u5750\u6807";
const MARS_COORDINATE_PROVIDER_TEXT = "\u9ad8\u5fb7/\u817e\u8baf/\u8c37\u6b4c";
const MARKER_STYLE_LABEL = "\u6807\u8bb0\u6837\u5f0f";
const MARKER_SIZE_LABEL = "\u6807\u8bb0\u5927\u5c0f";
const SMALL_MARKER_SIZE_TEXT = "\u5c0f";
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

  try {
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

    const uploadReady = await setImportOptions(
      session.page,
      options.screenshotsDir,
      platform,
      options,
    );
    if (uploadReady) {
      return { ...uploadReady, session };
    }

    updateStatus(options, "uploading", "正在选择钉图模板 Excel。", {
      stage: "upload-file",
    });
    const uploaded = await uploadExportFile(
      session.page,
      options.exportFilePath,
      startedAt,
      timeoutMs,
    );
    if (!uploaded) {
      const result = await stageResult(
        session.page,
        options.screenshotsDir,
        "upload-input",
        "blocked",
        "未确认钉图页面已选择当前 Excel 文件，已停止点击“导入”。",
      );
      return { ...result, session };
    }

    updateStatus(options, "confirming", "已选择导入文件，正在点击右下角“导入”。");
    const confirmed = await clickFirstEnabledVisible(
      session.page,
      dingmapSelectors.confirmButtons,
    );
    if (!confirmed) {
      const result = await stageResult(
        session.page,
        options.screenshotsDir,
        "import-confirm",
        "blocked",
        "已选择导入文件，但未找到可点击的右下角“导入”按钮。",
      );
      return { ...result, session };
    }

    const result = await waitForUploadResult(session.page, startedAt, timeoutMs);
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

  if (!(await clickFirstEnabledVisible(page, layerMoreSelectors))) {
    return stageResult(
      page,
      screenshotsDir,
      "layer-not-found",
      "blocked",
      `未找到图层：${platform.layerName}。请确认当前地图“${DINGMAP_TARGET_MAP_NAME}”的左侧图层列表中存在该图层。`,
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

interface ImportOptionStepResult extends DingmapUploadStatusDetails {
  ok: boolean;
}

async function setImportOptions(
  page: Page,
  screenshotsDir: string,
  platform: DingmapPlatformConfig,
  options: DingmapUploadBrowserOptions,
): Promise<DingmapUploadBrowserResult | null> {
  updateStatus(options, "opening_dingmap", "正在确认钉图新增数据导入页签。", {
    stage: "confirm-add-data-tab",
  });
  if (!(await clickFirstEnabledVisible(page, dingmapSelectors.addDataTabs))) {
    return stageResult(
      page,
      screenshotsDir,
      "add-data-tab",
      "blocked",
      "未找到“新增数据”页签，无法确认当前导入模式。",
    );
  }

  const coordinateTypeReady = await setCoordinateType(page);
  if (!coordinateTypeReady.ok) {
    return stageResult(
      page,
      screenshotsDir,
      "set-coordinate-type",
      "blocked",
      DINGMAP_COORDINATE_TYPE_CONFIRMATION_MESSAGE,
      coordinateTypeReady,
    );
  }
  updateStatus(options, "opening_dingmap", "已确认钉图坐标类型。", {
    stage: "set-marker-style",
    confirmedCoordinateType: coordinateTypeReady.confirmedCoordinateType,
  });

  const markerStyleReady = await setMarkerStyle(page, platform);
  if (!markerStyleReady.ok) {
    return stageResult(
      page,
      screenshotsDir,
      "set-marker-style",
      "blocked",
      DINGMAP_MARKER_STYLE_CONFIRMATION_MESSAGE,
      {
        ...coordinateTypeReady,
        ...markerStyleReady,
      },
    );
  }
  updateStatus(options, "opening_dingmap", `已确认钉图标记样式：${platform.markerColorLabel}。`, {
    stage: "set-marker-size",
    confirmedCoordinateType: coordinateTypeReady.confirmedCoordinateType,
    confirmedMarkerStyle: markerStyleReady.confirmedMarkerStyle,
  });

  const markerSizeReady = await setMarkerSize(page);
  if (!markerSizeReady.ok) {
    return stageResult(
      page,
      screenshotsDir,
      "set-marker-size",
      "blocked",
      DINGMAP_MARKER_SIZE_CONFIRMATION_MESSAGE,
      {
        ...coordinateTypeReady,
        ...markerStyleReady,
        ...markerSizeReady,
      },
    );
  }
  updateStatus(options, "opening_dingmap", "已确认钉图标记大小：小。", {
    stage: "upload-file",
    confirmedCoordinateType: coordinateTypeReady.confirmedCoordinateType,
    confirmedMarkerStyle: markerStyleReady.confirmedMarkerStyle,
    confirmedMarkerSize: markerSizeReady.confirmedMarkerSize,
  });

  return null;
}

async function setCoordinateType(page: Page): Promise<ImportOptionStepResult> {
  const initialText = await readCoordinateTypeDisplayText(page);
  if (isDingmapMarsCoordinateText(initialText)) {
    return { ok: true, confirmedCoordinateType: initialText };
  }

  if (await selectNativeCoordinateType(page)) {
    return buildCoordinateTypeStepResult(page);
  }

  const trigger = await findCoordinateTypeTrigger(page);
  if (trigger && (await clickLocatorIfUsable(trigger))) {
    await page.waitForTimeout(300);
    const openedText = await readCoordinateTypeDisplayText(page);
    if (isDingmapMarsCoordinateText(openedText)) {
      return { ok: true, confirmedCoordinateType: openedText };
    }
    if (await clickCoordinateTypeOption(page)) {
      await page.waitForTimeout(300);
      return buildCoordinateTypeStepResult(page);
    }
  }

  if (await clickFirstEnabledVisible(page, dingmapSelectors.coordinateTypeTriggers)) {
    await page.waitForTimeout(300);
    if (await clickCoordinateTypeOption(page)) {
      await page.waitForTimeout(300);
      return buildCoordinateTypeStepResult(page);
    }
  }

  return {
    ok: false,
    confirmedCoordinateType: await readCoordinateTypeDisplayText(page),
  };
}

export function isDingmapMarsCoordinateText(value: string): boolean {
  const normalized = normalizeCoordinateText(value);
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes(normalizeCoordinateText(MARS_COORDINATE_TEXT)) ||
    (normalized.includes("\u9ad8\u5fb7") &&
      normalized.includes("\u817e\u8baf") &&
      normalized.includes("\u8c37\u6b4c"))
  );
}

async function buildCoordinateTypeStepResult(page: Page): Promise<ImportOptionStepResult> {
  const currentText = await readCoordinateTypeDisplayText(page);
  return {
    ok: isDingmapMarsCoordinateText(currentText),
    confirmedCoordinateType: currentText,
  };
}

async function readCoordinateTypeDisplayText(page: Page): Promise<string> {
  return page
    .evaluate(({ label }) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? "").replace(/\s+/g, "").trim();
      const normalizeLabel = (value: string | null | undefined) =>
        normalize(value).replace(/[：:]/g, "");
      const textOf = (element: Element | null | undefined) =>
        String((element as HTMLElement | null | undefined)?.innerText ?? element?.textContent ?? "").trim();
      const roots = Array.from(
        document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
      );
      const root =
        roots.find((element) => textOf(element).includes("\u6570\u636e\u5bfc\u5165")) ??
        roots[roots.length - 1] ??
        document.body;
      const allElements = Array.from(root.querySelectorAll("*"));
      const labelElement = findFieldLabelElement(allElements, label, textOf, normalizeLabel);
      if (!labelElement) {
        return textOf(root);
      }

      const containers = [
        labelElement.closest(".ant-form-item"),
        labelElement.closest(".form-item"),
        labelElement.closest(".ant-row"),
        labelElement.parentElement,
        labelElement.parentElement?.parentElement,
      ].filter(Boolean) as Element[];

      for (const container of containers) {
        const selectText = textOf(
          container.querySelector(
            ".ant-select-selection-item, .ant-select-selector, [role='combobox'], select, [class*='select']",
          ),
        );
        if (selectText && !normalize(selectText).includes(label)) {
          return selectText;
        }

        const containerText = textOf(container);
        const labelIndex = normalize(containerText).indexOf(label);
        if (containerText && labelIndex >= 0) {
          return containerText;
        }
      }

      return textOf(labelElement.parentElement);

      function findFieldLabelElement(
        elements: Element[],
        expectedLabel: string,
        readText: (element: Element | null | undefined) => string,
        normalizeText: (value: string | null | undefined) => string,
      ) {
        return elements
          .filter((element) => normalizeText(readText(element)).includes(expectedLabel))
          .sort((left, right) => {
            const leftText = normalizeText(readText(left));
            const rightText = normalizeText(readText(right));
            const score = (value: string) => (value === expectedLabel ? 0 : value.startsWith(expectedLabel) ? 1 : 2);
            return score(leftText) - score(rightText) || leftText.length - rightText.length;
          })[0];
      }
    }, { label: COORDINATE_TYPE_LABEL })
    .catch(() => "");
}

async function readDialogFieldDisplayText(page: Page, label: string): Promise<string> {
  return page
    .evaluate(({ label }) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? "").replace(/\s+/g, "").trim();
      const normalizeLabel = (value: string | null | undefined) =>
        normalize(value).replace(/[：:]/g, "");
      const textOf = (element: Element | null | undefined) =>
        String((element as HTMLElement | null | undefined)?.innerText ?? element?.textContent ?? "").trim();
      const roots = Array.from(
        document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
      );
      const root =
        roots.find((element) => textOf(element).includes("\u6570\u636e\u5bfc\u5165")) ??
        roots[roots.length - 1] ??
        document.body;
      const allElements = Array.from(root.querySelectorAll("*"));
      const labelElement = findFieldLabelElement(allElements, label, textOf, normalizeLabel);
      if (!labelElement) {
        return "";
      }

      const containers = [
        labelElement.closest(".ant-form-item"),
        labelElement.closest(".form-item"),
        labelElement.closest(".ant-row"),
        labelElement.parentElement,
        labelElement.parentElement?.parentElement,
      ].filter(Boolean) as Element[];

      for (const container of containers) {
        const valueElement = container.querySelector(
          ".ant-select-selection-item, .ant-select-selector, [role='combobox'], select, [class*='select']",
        );
        const valueText = textOf(valueElement);
        if (valueText && !normalize(valueText).includes(label)) {
          return valueText;
        }

        const containerText = textOf(container);
        const normalizedContainerText = normalize(containerText);
        const labelIndex = normalizedContainerText.indexOf(label);
        if (containerText && labelIndex >= 0) {
          return containerText;
        }
      }

      return textOf(labelElement.parentElement);

      function findFieldLabelElement(
        elements: Element[],
        expectedLabel: string,
        readText: (element: Element | null | undefined) => string,
        normalizeText: (value: string | null | undefined) => string,
      ) {
        return elements
          .filter((element) => normalizeText(readText(element)).includes(expectedLabel))
          .sort((left, right) => {
            const leftText = normalizeText(readText(left));
            const rightText = normalizeText(readText(right));
            const score = (value: string) => (value === expectedLabel ? 0 : value.startsWith(expectedLabel) ? 1 : 2);
            return score(leftText) - score(rightText) || leftText.length - rightText.length;
          })[0];
      }
    }, { label })
    .catch(() => "");
}

async function findCoordinateTypeTrigger(page: Page): Promise<Locator | null> {
  const labelText = toXPathString(COORDINATE_TYPE_LABEL);
  const marsText = toXPathString(MARS_COORDINATE_TEXT);
  const candidates = [
    `xpath=(//*[contains(normalize-space(.), ${labelText})]/following::*[self::select or @role='combobox' or contains(@class, 'select')][1])[1]`,
    `xpath=(//*[contains(normalize-space(.), ${labelText})]/ancestor::*[contains(@class, 'form') or contains(@class, 'row') or contains(@class, 'item') or @role='dialog'][1]//*[self::select or @role='combobox' or contains(@class, 'select')][1])[1]`,
    `xpath=(//*[contains(normalize-space(.), ${marsText})]/ancestor::*[self::div or self::span][contains(@class, 'select') or @role='combobox'][1])[1]`,
    "[role='dialog'] [role='combobox']",
    "[role='dialog'] .ant-select-selector",
    ".ant-modal [role='combobox']",
    ".ant-modal .ant-select-selector",
    "select",
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await isLocatorVisible(locator))) {
      return locator;
    }
  }

  return null;
}

async function clickCoordinateTypeOption(page: Page): Promise<boolean> {
  const marsText = toXPathString(MARS_COORDINATE_TEXT);
  const providerText = toXPathString(MARS_COORDINATE_PROVIDER_TEXT);
  const selectors = [
    `xpath=(//*[contains(@class, 'ant-select-dropdown') and not(contains(@class, 'hidden'))]//*[contains(normalize-space(.), ${marsText}) or contains(normalize-space(.), ${providerText})])[1]`,
    `xpath=(//*[@role='option' or @role='menuitem'][contains(normalize-space(.), ${marsText}) or contains(normalize-space(.), ${providerText})])[1]`,
    `[role='option']:has-text('${MARS_COORDINATE_TEXT}')`,
    `[role='menuitem']:has-text('${MARS_COORDINATE_TEXT}')`,
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await clickLocatorIfUsable(locator)) {
      return true;
    }
  }

  return false;
}

async function selectNativeCoordinateType(page: Page): Promise<boolean> {
  return page
    .locator("select")
    .evaluateAll((selects, { label, marsText }) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? "").replace(/\s+/g, "").trim();
      const isMarsText = (value: string) => {
        const normalized = normalize(value);
        return (
          normalized.includes(normalize(marsText)) ||
          (normalized.includes("\u9ad8\u5fb7") &&
            normalized.includes("\u817e\u8baf") &&
            normalized.includes("\u8c37\u6b4c"))
        );
      };

      for (const select of selects) {
        const htmlSelect = select as HTMLSelectElement;
        const surroundingText = normalize(htmlSelect.parentElement?.textContent);
        const options = Array.from(htmlSelect.options);
        const option = options.find((candidate) => isMarsText(candidate.textContent ?? ""));
        if (!option) {
          continue;
        }

        if (!surroundingText.includes(label) && !options.some((candidate) => isMarsText(candidate.textContent ?? ""))) {
          continue;
        }

        htmlSelect.value = option.value;
        htmlSelect.dispatchEvent(new Event("input", { bubbles: true }));
        htmlSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      return false;
    }, {
      label: COORDINATE_TYPE_LABEL,
      marsText: MARS_COORDINATE_TEXT,
    })
    .catch(() => false);
}

async function clickLocatorIfUsable(locator: Locator): Promise<boolean> {
  try {
    if ((await locator.count()) === 0) {
      return false;
    }

    await locator.scrollIntoViewIfNeeded({ timeout: SHORT_WAIT_MS }).catch(() => undefined);
    if (await isLocatorVisible(locator)) {
      await locator.click({ timeout: SHORT_WAIT_MS });
      return true;
    }
  } catch {
    // Continue to other fallbacks.
  }

  return false;
}

function normalizeCoordinateText(value: string): string {
  return value
    .replace(/[()（）]/g, "")
    .replace(/[／\\]/g, "/")
    .replace(/\s+/g, "")
    .trim();
}

async function setMarkerStyle(
  page: Page,
  platform: DingmapPlatformConfig,
): Promise<ImportOptionStepResult> {
  const beforeState = await readMarkerStyleState(page);
  const trigger = await findMarkerStyleTrigger(page);
  if (!trigger || !(await clickLocatorIfUsable(trigger))) {
    return { ok: false, confirmedMarkerStyle: "\u672a\u786e\u8ba4" };
  }

  await page.waitForTimeout(300);
  if (!(await hasVisibleMarkerStylePanel(page))) {
    return { ok: false, confirmedMarkerStyle: "\u672a\u786e\u8ba4" };
  }

  const colorSelected = await clickFirstEnabledVisible(
    page,
    buildMarkerColorSelectors(platform.markerColorLabel, platform.markerColor),
  );
  if (!colorSelected) {
    return { ok: false, confirmedMarkerStyle: "\u672a\u786e\u8ba4" };
  }

  await page.waitForTimeout(300);
  const afterState = await readMarkerStyleState(page);
  const confirmed =
    !(await hasVisibleMarkerStylePanel(page)) ||
    Boolean(beforeState && afterState && beforeState !== afterState);
  return {
    ok: confirmed,
    confirmedMarkerStyle: confirmed ? "\u5df2\u786e\u8ba4" : "\u672a\u786e\u8ba4",
  };
}

async function setMarkerSize(page: Page): Promise<ImportOptionStepResult> {
  const initialText = await readMarkerSizeDisplayText(page);
  if (isDingmapSmallMarkerSizeText(initialText)) {
    return { ok: true, confirmedMarkerSize: SMALL_MARKER_SIZE_TEXT };
  }

  if (await selectNativeMarkerSize(page)) {
    return buildMarkerSizeStepResult(page);
  }

  const trigger = await findMarkerSizeTrigger(page);
  if (!trigger || !(await clickLocatorIfUsable(trigger))) {
    return { ok: false, confirmedMarkerSize: initialText };
  }

  await page.waitForTimeout(300);
  if (!(await clickSmallMarkerSizeOption(page))) {
    return { ok: false, confirmedMarkerSize: await readMarkerSizeDisplayText(page) };
  }

  await page.waitForTimeout(300);
  return buildMarkerSizeStepResult(page);
}

async function buildMarkerSizeStepResult(page: Page): Promise<ImportOptionStepResult> {
  const currentText = await readMarkerSizeDisplayText(page);
  return {
    ok: isDingmapSmallMarkerSizeText(currentText),
    confirmedMarkerSize: isDingmapSmallMarkerSizeText(currentText)
      ? SMALL_MARKER_SIZE_TEXT
      : currentText,
  };
}

export function isDingmapSmallMarkerSizeText(value: string): boolean {
  const normalized = normalizeMarkerSizeText(value);
  return normalized === "\u5c0f" || normalized.includes("\u5c0f\u53f7") || normalized === "small";
}

async function findMarkerStyleTrigger(page: Page): Promise<Locator | null> {
  const labelText = toXPathString(MARKER_STYLE_LABEL);
  const labelPredicate = `contains(normalize-space(.), ${labelText}) and string-length(normalize-space(.)) <= 16`;
  const candidates = [
    `xpath=(//*[${labelPredicate}]/following::*[self::button or @role='button' or contains(@class, 'button') or contains(@class, 'btn')][1])[1]`,
    `xpath=(//*[${labelPredicate}]/following::*[name()='svg' or self::i or contains(@class, 'icon')][1]/ancestor-or-self::*[self::button or @role='button' or contains(@class, 'button') or contains(@class, 'btn') or contains(@class, 'icon')][1])[1]`,
    `xpath=(//*[${labelPredicate}]/ancestor::*[contains(@class, 'form') or contains(@class, 'row') or contains(@class, 'item') or @role='dialog'][1]//*[self::button or @role='button' or contains(@class, 'button') or contains(@class, 'btn') or name()='svg' or self::i or contains(@class, 'icon')][not(contains(normalize-space(.), ${labelText}))][1])[1]`,
    "[role='dialog'] [aria-label*='\u6807\u8bb0\u6837\u5f0f']",
    "[role='dialog'] [title*='\u6807\u8bb0\u6837\u5f0f']",
    ".ant-modal [aria-label*='\u6807\u8bb0\u6837\u5f0f']",
    ".ant-modal [title*='\u6807\u8bb0\u6837\u5f0f']",
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await isLocatorVisible(locator))) {
      return locator;
    }
  }

  return null;
}

async function readMarkerStyleState(page: Page): Promise<string> {
  return page
    .evaluate(({ label }) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? "").replace(/\s+/g, "").trim();
      const normalizeLabel = (value: string | null | undefined) =>
        normalize(value).replace(/[：:]/g, "");
      const textOf = (element: Element | null | undefined) =>
        String((element as HTMLElement | null | undefined)?.innerText ?? element?.textContent ?? "").trim();
      const roots = Array.from(
        document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
      );
      const root =
        roots.find((element) => textOf(element).includes("\u6570\u636e\u5bfc\u5165")) ??
        roots[roots.length - 1] ??
        document.body;
      const allElements = Array.from(root.querySelectorAll("*"));
      const labelElement = allElements
        .filter((element) => normalizeLabel(textOf(element)).includes(label))
        .sort((left, right) => {
          const leftText = normalizeLabel(textOf(left));
          const rightText = normalizeLabel(textOf(right));
          const score = (value: string) => (value === label ? 0 : value.startsWith(label) ? 1 : 2);
          return score(leftText) - score(rightText) || leftText.length - rightText.length;
        })[0];
      const container =
        labelElement?.closest(".ant-form-item") ??
        labelElement?.closest(".form-item") ??
        labelElement?.closest(".ant-row") ??
        labelElement?.parentElement?.parentElement ??
        labelElement?.parentElement;
      const target = container?.querySelector(
        "button,[role='button'],svg,i,[class*='icon'],[class*='marker']",
      ) as HTMLElement | SVGElement | null;
      if (!target) {
        return "";
      }

      const style = target.getAttribute("style") ?? "";
      const className = target.getAttribute("class") ?? "";
      const aria = target.getAttribute("aria-label") ?? "";
      const title = target.getAttribute("title") ?? "";
      return `${target.tagName}:${className}:${style}:${aria}:${title}:${target.outerHTML.slice(0, 300)}`;
    }, { label: MARKER_STYLE_LABEL })
    .catch(() => "");
}

async function hasVisibleMarkerStylePanel(page: Page): Promise<boolean> {
  const markerStyleLabel = toXPathString(MARKER_STYLE_LABEL);
  const markerSizeLabel = toXPathString(MARKER_SIZE_LABEL);
  const panelSelectors = [
    ".ant-popover:not(.ant-popover-hidden)",
    ".ant-dropdown:not(.ant-dropdown-hidden)",
    "[role='dialog'] [class*='popover']:visible",
    "[role='dialog'] [class*='dropdown']:visible",
    `xpath=(//*[contains(normalize-space(.), ${markerStyleLabel}) and string-length(normalize-space(.)) <= 16]/following::*[(contains(@class, 'color') or contains(@class, 'swatch') or contains(@class, 'colour') or contains(@style, 'background') or contains(@style, 'border-color')) and not(preceding::*[contains(normalize-space(.), ${markerSizeLabel})])][1])`,
  ];
  return hasVisibleSelector(page, panelSelectors, SHORT_WAIT_MS);
}

async function findMarkerSizeTrigger(page: Page): Promise<Locator | null> {
  const labelText = toXPathString(MARKER_SIZE_LABEL);
  const labelPredicate = `contains(normalize-space(.), ${labelText}) and string-length(normalize-space(.)) <= 16`;
  const candidates = [
    `xpath=(//*[${labelPredicate}]/following::*[self::select or @role='combobox' or contains(@class, 'select')][1])[1]`,
    `xpath=(//*[${labelPredicate}]/ancestor::*[contains(@class, 'form') or contains(@class, 'row') or contains(@class, 'item') or @role='dialog'][1]//*[self::select or @role='combobox' or contains(@class, 'select')][1])[1]`,
    "[role='dialog'] [role='combobox']:has-text('\u5c0f')",
    "[role='dialog'] [role='combobox']:has-text('\u4e2d')",
    "[role='dialog'] .ant-select-selector:has-text('\u5c0f')",
    "[role='dialog'] .ant-select-selector:has-text('\u4e2d')",
    ".ant-modal [role='combobox']:has-text('\u5c0f')",
    ".ant-modal [role='combobox']:has-text('\u4e2d')",
    ".ant-modal .ant-select-selector:has-text('\u5c0f')",
    ".ant-modal .ant-select-selector:has-text('\u4e2d')",
    "select",
  ];

  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await isLocatorVisible(locator))) {
      return locator;
    }
  }

  return null;
}

async function readMarkerSizeDisplayText(page: Page): Promise<string> {
  return readDialogFieldDisplayText(page, MARKER_SIZE_LABEL);
}

async function selectNativeMarkerSize(page: Page): Promise<boolean> {
  return page
    .locator("select")
    .evaluateAll((selects, { label }) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? "").replace(/\s+/g, "").trim().toLowerCase();
      const isSmall = (value: string) => {
        const normalized = normalize(value);
        return normalized === "\u5c0f" || normalized.includes("\u5c0f\u53f7") || normalized === "small";
      };

      for (const select of selects) {
        const htmlSelect = select as HTMLSelectElement;
        const surroundingText = normalize(htmlSelect.parentElement?.textContent);
        const option = Array.from(htmlSelect.options).find((candidate) =>
          isSmall(candidate.textContent ?? ""),
        );
        if (!option || !surroundingText.includes(normalize(label))) {
          continue;
        }

        htmlSelect.value = option.value;
        htmlSelect.dispatchEvent(new Event("input", { bubbles: true }));
        htmlSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      return false;
    }, { label: MARKER_SIZE_LABEL })
    .catch(() => false);
}

async function clickSmallMarkerSizeOption(page: Page): Promise<boolean> {
  const smallText = toXPathString(SMALL_MARKER_SIZE_TEXT);
  const selectors = [
    `xpath=(//*[contains(@class, 'ant-select-dropdown') and not(contains(@class, 'hidden'))]//*[normalize-space(.)=${smallText} or contains(normalize-space(.), '\u5c0f\u53f7') or translate(normalize-space(.), 'SMALL', 'small')='small'])[1]`,
    `xpath=(//*[@role='option' or @role='menuitem'][normalize-space(.)=${smallText} or contains(normalize-space(.), '\u5c0f\u53f7') or translate(normalize-space(.), 'SMALL', 'small')='small'])[1]`,
    "[role='option']:has-text('\u5c0f')",
    "[role='menuitem']:has-text('\u5c0f')",
    "text=\u5c0f",
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await clickLocatorIfUsable(locator)) {
      return true;
    }
  }

  return false;
}

function normalizeMarkerSizeText(value: string): string {
  return value
    .replace(MARKER_SIZE_LABEL, "")
    .replace(/[:：]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
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

    await page.waitForTimeout(200);
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

    await page.waitForTimeout(500);
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
