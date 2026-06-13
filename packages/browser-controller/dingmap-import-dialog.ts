import { basename } from "node:path";
import type { Locator, Page } from "playwright";
import {
  DINGMAP_MARKER_COLOR_ORDER,
  DINGMAP_MARKER_SIZE,
  type DingmapMarkerColor,
  type DingmapPlatformConfig,
} from "./dingmap-platforms";
import { dingmapSelectors } from "./dingmap-selectors";

export type ImportDialogStepStatus = "ok" | "blocked";

export interface ImportOptionResult {
  status: ImportDialogStepStatus;
  message?: string;
  confirmedCoordinateType?: string;
  confirmedMarkerStyle?: string;
  confirmedMarkerSize?: string;
}

export interface UploadFileResult {
  status: ImportDialogStepStatus;
  message?: string;
  filename?: string;
}

export interface ClickImportResult {
  status: ImportDialogStepStatus;
  message?: string;
}

export interface ImportResult {
  status: "success" | "failed" | "unknown";
  message: string;
  submitted: boolean;
}

export interface DingMapImportDialogControllerOptions {
  platform: DingmapPlatformConfig;
  exportFilePath?: string;
  timeoutMs?: number;
}

export interface DingmapImportDialogInspection {
  capturedAt: string;
  url: string;
  title: string;
  screenshotPath?: string;
  coordinateType: FieldInspection;
  markerStyle: MarkerStyleInspection;
  markerSize: FieldInspection;
  upload: UploadInspection;
  importButton: ImportButtonInspection;
}

export interface FieldInspection {
  label: string;
  labelLocator: string;
  triggerLocator: string;
  currentText: string;
  hasConcatenatedOptions: boolean;
  options: OptionInspection[];
  nearbyControls: NearbyControlInspection[];
}

export interface OptionInspection {
  text: string;
  domSummary: string;
}

export interface MarkerStyleInspection {
  label: string;
  labelLocator: string;
  triggerLocator: string;
  panelLocator: string;
  swatchCount: number;
  swatches: ColorSwatchInspection[];
  nearbyControls: NearbyControlInspection[];
}

export interface NearbyControlInspection {
  domSummary: string;
  text: string;
  tagName: string;
  className: string;
  ariaLabel: string;
  title: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ColorSwatchInspection {
  index: number;
  fallbackColor: DingmapMarkerColor | null;
  domSummary: string;
  backgroundColor: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface UploadInspection {
  uploadZoneLocator: string;
  fileInputLocator: string;
  inputCount: number;
  canSetInputFiles: boolean;
}

export interface ImportButtonInspection {
  locator: string;
  text: string;
  enabled: boolean;
}

const SHORT_WAIT_MS = 1_500;
const MEDIUM_WAIT_MS = 8_000;
const COORDINATE_TYPE_LABEL = "坐标类型";
const MARKER_STYLE_LABEL = "标记样式";
const MARKER_SIZE_LABEL = "标记大小";
const MARS_COORDINATE_TEXT = "火星坐标";
const MARS_COORDINATE_PROVIDER_TEXT = "高德/腾讯/谷歌";
const COORDINATE_OPTION_TEXTS = [
  "火星坐标（高德/腾讯/谷歌）",
  "百度坐标",
  "大地坐标",
] as const;
const MARKER_SIZE_OPTION_TEXTS = ["小", "中", "大"] as const;
const MARKER_COLOR_LABELS: Record<DingmapMarkerColor, string> = {
  blue: "蓝色",
  green: "绿色",
  red: "红色",
  purple: "紫色",
  orange: "橙色",
  yellow: "黄色",
  black: "黑色",
};
const MARKER_COLOR_RGB_HINTS: Record<DingmapMarkerColor, Array<[number, number, number]>> = {
  blue: [[75, 128, 204]],
  green: [[84, 179, 65]],
  red: [[255, 0, 0], [255, 77, 79]],
  purple: [[160, 95, 176]],
  orange: [[255, 112, 45], [250, 140, 22]],
  yellow: [[255, 188, 64], [250, 219, 20]],
  black: [[0, 0, 0]],
};

export class DingMapImportDialogController {
  private readonly page: Page;
  private readonly platform: DingmapPlatformConfig;
  private readonly exportFilePath?: string;
  private readonly timeoutMs: number;

  constructor(page: Page, options: DingMapImportDialogControllerOptions) {
    this.page = page;
    this.platform = options.platform;
    this.exportFilePath = options.exportFilePath;
    this.timeoutMs = options.timeoutMs ?? 45_000;
  }

  async setCoordinateType(): Promise<ImportOptionResult> {
    const initialText = await this.readFieldDisplayText(COORDINATE_TYPE_LABEL);
    if (isDingmapConfirmedMarsCoordinateText(initialText)) {
      return { status: "ok", confirmedCoordinateType: initialText };
    }
    if (isConcatenatedCoordinateOptionText(initialText)) {
      return { status: "blocked", confirmedCoordinateType: initialText };
    }

    const nativeSelected = await this.selectNativeOptionNearLabel(
      COORDINATE_TYPE_LABEL,
      isMarsCoordinateOptionText,
    );
    if (!nativeSelected) {
      const trigger = await this.findFieldTrigger(COORDINATE_TYPE_LABEL);
      if (!trigger || !(await clickLocatorIfUsable(trigger))) {
        return {
          status: "blocked",
          confirmedCoordinateType: initialText,
          message: "未能打开坐标类型下拉框。",
        };
      }
      await this.page.waitForTimeout(250);
      if (!(await this.clickOption(isMarsCoordinateOptionText))) {
        return {
          status: "blocked",
          confirmedCoordinateType: await this.readFieldDisplayText(COORDINATE_TYPE_LABEL),
          message: "未找到火星坐标选项。",
        };
      }
      await this.page.waitForTimeout(250);
    }

    const confirmedText = await this.readFieldDisplayText(COORDINATE_TYPE_LABEL);
    return {
      status: isDingmapConfirmedMarsCoordinateText(confirmedText) ? "ok" : "blocked",
      confirmedCoordinateType: confirmedText,
    };
  }

  async setMarkerStyle(): Promise<ImportOptionResult> {
    let swatches = await this.collectMarkerColorSwatches();
    if (swatches.length === 0) {
      const trigger = await this.findMarkerStyleTrigger();
      if (!trigger || !(await clickLocatorIfUsable(trigger))) {
        return {
          status: "blocked",
          confirmedMarkerStyle: "未确认",
          message: "未能打开标记样式选择器。",
        };
      }
      await this.page.waitForTimeout(250);
      swatches = await this.collectMarkerColorSwatches();
    }

    if (swatches.length === 0) {
      return {
        status: "blocked",
        confirmedMarkerStyle: "未确认",
        message: "未找到标记样式颜色块。",
      };
    }

    const targetColor = this.platform.markerColor;
    const computedMatch = swatches.find((swatch) => swatch.color === targetColor && swatch.fromComputedStyle);
    const fallbackMatch = swatches.find((swatch) => swatch.color === targetColor);
    const selected = computedMatch ?? fallbackMatch;
    if (!selected) {
      return {
        status: "blocked",
        confirmedMarkerStyle: "未确认",
        message: `未找到${this.platform.markerColorLabel}标记样式。`,
      };
    }

    await selected.locator.click({ timeout: SHORT_WAIT_MS }).catch(async () => {
      await selected.locator.dispatchEvent("click");
    });
    await this.page.waitForTimeout(250);

    return {
      status: "ok",
      confirmedMarkerStyle: MARKER_COLOR_LABELS[targetColor],
    };
  }

  async setMarkerSize(): Promise<ImportOptionResult> {
    const initialText = await this.readFieldDisplayText(MARKER_SIZE_LABEL);
    if (isDingmapConfirmedSmallMarkerSizeText(initialText)) {
      return { status: "ok", confirmedMarkerSize: DINGMAP_MARKER_SIZE };
    }
    if (isConcatenatedMarkerSizeOptionText(initialText)) {
      return { status: "blocked", confirmedMarkerSize: initialText };
    }

    const nativeSelected = await this.selectNativeOptionNearLabel(
      MARKER_SIZE_LABEL,
      isSmallMarkerSizeOptionText,
    );
    if (!nativeSelected) {
      const trigger = await this.findFieldTrigger(MARKER_SIZE_LABEL);
      if (!trigger || !(await clickLocatorIfUsable(trigger))) {
        return {
          status: "blocked",
          confirmedMarkerSize: initialText,
          message: "未能打开标记大小下拉框。",
        };
      }
      await this.page.waitForTimeout(250);
      if (!(await this.clickOption(isSmallMarkerSizeOptionText))) {
        return {
          status: "blocked",
          confirmedMarkerSize: await this.readFieldDisplayText(MARKER_SIZE_LABEL),
          message: "未找到“小”标记大小选项。",
        };
      }
      await this.page.waitForTimeout(250);
    }

    const confirmedText = await this.readFieldDisplayText(MARKER_SIZE_LABEL);
    return {
      status: isDingmapConfirmedSmallMarkerSizeText(confirmedText) ? "ok" : "blocked",
      confirmedMarkerSize: isDingmapConfirmedSmallMarkerSizeText(confirmedText)
        ? DINGMAP_MARKER_SIZE
        : confirmedText,
    };
  }

  async setImportOptions(): Promise<ImportOptionResult> {
    await clickFirstEnabledVisible(this.page, dingmapSelectors.addDataTabs);

    const coordinate = await this.setCoordinateType();
    if (coordinate.status !== "ok") {
      return coordinate;
    }

    const markerStyle = await this.setMarkerStyle();
    if (markerStyle.status !== "ok") {
      return { ...coordinate, ...markerStyle };
    }

    const markerSize = await this.setMarkerSize();
    if (markerSize.status !== "ok") {
      return { ...coordinate, ...markerStyle, ...markerSize };
    }

    return {
      status: "ok",
      confirmedCoordinateType: coordinate.confirmedCoordinateType,
      confirmedMarkerStyle: markerStyle.confirmedMarkerStyle,
      confirmedMarkerSize: markerSize.confirmedMarkerSize,
    };
  }

  async uploadFile(): Promise<UploadFileResult> {
    if (!this.exportFilePath) {
      return { status: "blocked", message: "缺少待上传的 Excel 文件路径。" };
    }

    const filename = basename(this.exportFilePath);
    for (const selector of dingmapSelectors.uploadZones) {
      try {
        const locator = this.page.locator(selector).first();
        if (!(await isLocatorCurrentlyVisible(locator))) {
          continue;
        }

        const fileChooserPromise = this.page
          .waitForEvent("filechooser", { timeout: SHORT_WAIT_MS })
          .catch(() => null);
        await locator.click({ timeout: SHORT_WAIT_MS });
        const fileChooser = await fileChooserPromise;
        if (fileChooser) {
          await fileChooser.setFiles(this.exportFilePath);
          return (await this.waitForSelectedFile(filename))
            ? { status: "ok", filename }
            : { status: "blocked", filename, message: "页面未确认已选择当前 Excel 文件。" };
        }

        const inputAfterClick = await this.findFirstFileInput();
        if (inputAfterClick) {
          await inputAfterClick.setInputFiles(this.exportFilePath, { timeout: this.timeoutMs });
          return (await this.waitForSelectedFile(filename))
            ? { status: "ok", filename }
            : { status: "blocked", filename, message: "页面未确认已选择当前 Excel 文件。" };
        }
      } catch {
        // Continue trying other upload zones.
      }
    }

    const input = await this.findFirstFileInput();
    if (!input) {
      return { status: "blocked", filename, message: "未找到真实文件上传 input。" };
    }

    await input.setInputFiles(this.exportFilePath, { timeout: this.timeoutMs });
    return (await this.waitForSelectedFile(filename))
      ? { status: "ok", filename }
      : { status: "blocked", filename, message: "页面未确认已选择当前 Excel 文件。" };
  }

  async clickImport(): Promise<ClickImportResult> {
    const clicked = await clickFirstEnabledVisible(this.page, dingmapSelectors.confirmButtons);
    return clicked
      ? { status: "ok" }
      : { status: "blocked", message: "已选择导入文件，但未找到可点击的右下角“导入”按钮。" };
  }

  async readResult(startedAt = Date.now()): Promise<ImportResult> {
    while (Date.now() - startedAt < this.timeoutMs) {
      if (await hasVisibleSelector(this.page, dingmapSelectors.successIndicators)) {
        return { status: "success", message: "钉图页面显示导入成功。", submitted: true };
      }

      if (await hasVisibleSelector(this.page, dingmapSelectors.failureIndicators)) {
        return { status: "failed", message: "钉图页面显示导入失败或校验失败。", submitted: true };
      }

      await this.page.waitForTimeout(500);
    }

    return {
      status: "unknown",
      message: "文件已提交给钉图，但等待期间没有可靠的成功或失败提示。",
      submitted: true,
    };
  }

  async inspect(): Promise<DingmapImportDialogInspection> {
    const coordinateType = await this.inspectField(COORDINATE_TYPE_LABEL);
    const markerSize = await this.inspectField(MARKER_SIZE_LABEL);
    const markerStyle = await this.inspectMarkerStyle();
    const upload = await this.inspectUpload();
    const importButton = await this.inspectImportButton();

    return {
      capturedAt: new Date().toISOString(),
      url: this.page.url(),
      title: await this.page.title().catch(() => ""),
      coordinateType,
      markerStyle,
      markerSize,
      upload,
      importButton,
    };
  }

  private async inspectField(label: string): Promise<FieldInspection> {
    const trigger = await this.findFieldTrigger(label);
    const triggerLocator = await locatorSummary(trigger);
    const options = await this.collectOptionsForLabel(label);
    const currentText = await this.readFieldDisplayText(label);
    return {
      label,
      labelLocator: `label text: ${label}`,
      triggerLocator,
      currentText,
      hasConcatenatedOptions:
        label === COORDINATE_TYPE_LABEL
          ? isConcatenatedCoordinateOptionText(currentText)
          : isConcatenatedMarkerSizeOptionText(currentText),
      options,
      nearbyControls: await this.inspectNearbyControls(label),
    };
  }

  private async inspectMarkerStyle(): Promise<MarkerStyleInspection> {
    const trigger = await this.findMarkerStyleTrigger();
    if (trigger) {
      await clickLocatorIfUsable(trigger);
      await this.page.waitForTimeout(250);
    }
    const swatches = await this.collectMarkerColorSwatches();
    return {
      label: MARKER_STYLE_LABEL,
      labelLocator: `label text: ${MARKER_STYLE_LABEL}`,
      triggerLocator: await locatorSummary(trigger),
      panelLocator: ".ant-popover, .ant-dropdown, [class*='popover'], [class*='dropdown']",
      swatchCount: swatches.length,
      nearbyControls: await this.inspectNearbyControls(MARKER_STYLE_LABEL),
      swatches: await Promise.all(
        swatches.map(async (swatch, index) => ({
          index,
          fallbackColor: DINGMAP_MARKER_COLOR_ORDER[index] ?? null,
          domSummary: await elementDomSummary(swatch.locator),
          backgroundColor: await swatch.locator
            .evaluate((element) => getComputedStyle(element).backgroundColor)
            .catch(() => ""),
          boundingBox: await swatch.locator.boundingBox().catch(() => null),
        })),
      ),
    };
  }

  private async inspectUpload(): Promise<UploadInspection> {
    const inputCount = await this.page.locator("input[type='file']").count().catch(() => 0);
    return {
      uploadZoneLocator: dingmapSelectors.uploadZones.join(" | "),
      fileInputLocator: dingmapSelectors.fileInputs.join(" | "),
      inputCount,
      canSetInputFiles: inputCount > 0,
    };
  }

  private async inspectImportButton(): Promise<ImportButtonInspection> {
    const button = await firstExistingLocator(this.page, dingmapSelectors.confirmButtons);
    return {
      locator: dingmapSelectors.confirmButtons.join(" | "),
      text: button ? await button.innerText().catch(() => "") : "",
      enabled: button ? await button.isEnabled().catch(() => false) : false,
    };
  }

  private async inspectNearbyControls(label: string): Promise<NearbyControlInspection[]> {
    return this.page
      .evaluate(({ label }) => {
        const root = findImportDialogRoot();
        const labelElement = findBestLabelElement(root, label);
        if (!labelElement) {
          return [];
        }
        const labelRect = getLabelSearchRect(labelElement, label);
        const selectors = [
          "select",
          "button",
          "[role='button']",
          "[role='combobox']",
          "svg",
          "img",
          "i",
          "span",
          "div",
          "[aria-label]",
          "[title]",
          "[class*='icon']",
          "[class*='marker']",
        ];
        return uniqueElements(selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector))))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const yDistance = Math.abs(rect.top + rect.height / 2 - (labelRect.top + labelRect.height / 2));
            const xDistance = rect.left - labelRect.right;
            return { element, rect, yDistance, xDistance };
          })
          .filter(({ element, rect, yDistance, xDistance }) => {
            const style = getComputedStyle(element);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              xDistance >= -12 &&
              xDistance <= 320 &&
              yDistance <= Math.max(32, labelRect.height * 3) &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .sort((left, right) => left.yDistance - right.yDistance || left.xDistance - right.xDistance)
          .slice(0, 12)
          .map(({ element, rect }) => ({
            domSummary: domSummary(element),
            text: textOf(element),
            tagName: element.tagName.toLowerCase(),
            className: element.getAttribute("class") ?? "",
            ariaLabel: element.getAttribute("aria-label") ?? "",
            title: element.getAttribute("title") ?? "",
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          }));

        function findImportDialogRoot(): Element {
          const roots = Array.from(
            document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
          );
          return (
            roots.find((element) => textOf(element).includes("数据导入")) ??
            roots[roots.length - 1] ??
            document.body
          );
        }

        function findBestLabelElement(rootElement: Element, expectedLabel: string): Element | null {
          return Array.from(rootElement.querySelectorAll("label,*"))
            .filter((element) => {
              const normalized = normalizeLabel(textOf(element));
              return normalized === expectedLabel || normalized.startsWith(expectedLabel);
            })
            .sort((left, right) => {
              const leftText = normalizeLabel(textOf(left));
              const rightText = normalizeLabel(textOf(right));
              const score = (value: string) =>
                value === expectedLabel ? 0 : value.startsWith(expectedLabel) ? 1 : 2;
              return score(leftText) - score(rightText) || leftText.length - rightText.length;
            })[0] ?? null;
        }

        function getLabelSearchRect(labelElement: Element, expectedLabel: string): DOMRect {
          return findLabelTextRect(labelElement, expectedLabel) ?? labelElement.getBoundingClientRect();
        }

        function findLabelTextRect(labelElement: Element, expectedLabel: string): DOMRect | null {
          const walker = document.createTreeWalker(labelElement, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const textNode = walker.currentNode;
            const text = textNode.textContent ?? "";
            const start = text.indexOf(expectedLabel);
            if (start < 0) {
              continue;
            }
            const range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, start + expectedLabel.length);
            const rect = range.getBoundingClientRect();
            range.detach();
            if (rect.width > 0 && rect.height > 0) {
              return rect;
            }
          }
          return null;
        }

        function uniqueElements(elements: Element[]): Element[] {
          return Array.from(new Set(elements));
        }

        function domSummary(element: Element): string {
          const attrs = Array.from(element.attributes)
            .map((attr) => `${attr.name}="${attr.value}"`)
            .join(" ");
          return `<${element.tagName.toLowerCase()} ${attrs}> ${textOf(element)}`.slice(0, 500);
        }

        function textOf(element: Element | null | undefined): string {
          if (!element) {
            return "";
          }
          if (element instanceof HTMLSelectElement) {
            return element.selectedOptions[0]?.textContent?.trim() ?? "";
          }
          return String((element as HTMLElement).innerText ?? element.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim();
        }

        function normalizeLabel(value: string): string {
          return value.replace(/\s+/g, "").replace(/[：:]/g, "").trim();
        }
      }, { label })
      .catch(() => []);
  }

  private async readFieldDisplayText(label: string): Promise<string> {
    const nearestControl = await this.findNearestControlBesideLabel(label, "field");
    if (nearestControl) {
      const nearestText = await readControlText(nearestControl);
      if (nearestText) {
        return nearestText;
      }
    }

    const trigger = await this.findFieldTrigger(label);
    if (trigger) {
      const triggerText = await readControlText(trigger);
      if (triggerText) {
        return triggerText;
      }
    }

    return this.page
      .evaluate(({ label }) => {
        const field = findDialogField(label);
        if (!field) {
          return "";
        }

        const valueElement = findValueElement(field, label);
        return textOf(valueElement);

        function findDialogField(expectedLabel: string): Element | null {
          const root = findImportDialogRoot();
          const labels = Array.from(root.querySelectorAll("label,*"))
            .filter((element) => {
              const normalized = normalizeLabel(textOf(element));
              return normalized === expectedLabel || normalized.startsWith(expectedLabel);
            })
            .sort((left, right) => scoreLabel(left, expectedLabel) - scoreLabel(right, expectedLabel));
          const labelElement = labels[0];
          return (
            labelElement?.closest("[data-field], .ant-form-item, .form-item, .ant-row") ??
            labelElement?.parentElement?.parentElement ??
            labelElement?.parentElement ??
            null
          );
        }

        function findImportDialogRoot(): Element {
          const roots = Array.from(
            document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
          );
          return (
            roots.find((element) => textOf(element).includes("数据导入")) ??
            roots[roots.length - 1] ??
            document.body
          );
        }

        function findValueElement(field: Element, expectedLabel: string): Element | null {
          const selectors = [
            ".ant-select-selection-item",
            ".ant-select-selection-placeholder",
            ".ant-select-selector [title]",
            ".ant-select-selector",
            "[role='combobox']",
            "select",
            "button.trigger",
            "button:not([role='tab'])",
            "[role='button']",
          ];

          for (const selector of selectors) {
            const candidates = Array.from(field.querySelectorAll(selector));
            const candidate = candidates.find((element) => {
              const value = textOf(element);
              return value && !normalize(value).includes(normalize(expectedLabel));
            });
            if (candidate) {
              return candidate;
            }
          }

          return null;
        }

        function scoreLabel(element: Element, expectedLabel: string): number {
          const normalized = normalizeLabel(textOf(element));
          if (normalized === expectedLabel) {
            return 0;
          }
          if (normalized.startsWith(expectedLabel)) {
            return 1;
          }
          return 2 + normalized.length;
        }

        function textOf(element: Element | null | undefined): string {
          if (!element) {
            return "";
          }
          if (element instanceof HTMLSelectElement) {
            return element.selectedOptions[0]?.textContent?.trim() ?? "";
          }
          return String((element as HTMLElement).innerText ?? element.textContent ?? "").trim();
        }

        function normalize(value: string): string {
          return value.replace(/\s+/g, "").trim();
        }

        function normalizeLabel(value: string): string {
          return normalize(value).replace(/[：:]/g, "");
        }
      }, { label })
      .catch(() => "");
  }

  private async findFieldTrigger(label: string): Promise<Locator | null> {
    const nearestControl = await this.findNearestControlBesideLabel(label, "field");
    if (nearestControl) {
      return nearestControl;
    }

    const labelText = toXPathString(label);
    const labelPredicate = `contains(normalize-space(.), ${labelText}) and string-length(normalize-space(.)) <= 24`;
    const selectors = [
      `[data-field*='${label === COORDINATE_TYPE_LABEL ? "coordinate" : "marker-size"}'] .trigger`,
      `xpath=(//*[${labelPredicate}]/ancestor::*[@data-field or contains(@class, 'ant-form-item') or contains(@class, 'form-item') or contains(@class, 'ant-row')][1]//*[self::select or @role='combobox' or contains(@class, 'ant-select-selector') or self::button][not(@role='tab')][1])[1]`,
      `xpath=(//*[${labelPredicate}]/following::*[self::select or @role='combobox' or contains(@class, 'ant-select-selector') or self::button][not(@role='tab')][1])[1]`,
    ];
    return firstVisibleLocator(this.page, selectors);
  }

  private async findMarkerStyleTrigger(): Promise<Locator | null> {
    const nearestControl = await this.findNearestControlBesideLabel(MARKER_STYLE_LABEL, "style");
    if (nearestControl) {
      return nearestControl;
    }

    const labelText = toXPathString(MARKER_STYLE_LABEL);
    const labelPredicate = `contains(normalize-space(.), ${labelText}) and string-length(normalize-space(.)) <= 24`;
    const selectors = [
      "[data-field='marker-style'] .style-trigger",
      `xpath=(//*[${labelPredicate}]/ancestor::*[@data-field or contains(@class, 'ant-form-item') or contains(@class, 'form-item') or contains(@class, 'ant-row')][1]//*[self::button or @role='button' or name()='svg' or self::i or contains(@class, 'icon')][not(contains(normalize-space(.), ${labelText}))][1])[1]`,
      `xpath=(//*[${labelPredicate}]/following::*[self::button or @role='button' or name()='svg' or self::i or contains(@class, 'icon')][1])[1]`,
      "[role='dialog'] [aria-label*='标记样式']",
      ".ant-modal [aria-label*='标记样式']",
    ];
    return firstVisibleLocator(this.page, selectors);
  }

  private async collectMarkerColorSwatches(): Promise<
    Array<{
      locator: Locator;
      color: DingmapMarkerColor;
      fromComputedStyle: boolean;
    }>
  > {
    const selectors = [
      ".ant-popover:not(.ant-popover-hidden) .swatch",
      ".ant-dropdown:not(.ant-dropdown-hidden) .swatch",
      ".ant-popover:not(.ant-popover-hidden) [data-color]",
      ".ant-dropdown:not(.ant-dropdown-hidden) [data-color]",
      ".ant-popover:not(.ant-popover-hidden) button",
      ".ant-dropdown:not(.ant-dropdown-hidden) button",
      "[role='dialog'] [class*='color']",
      "[role='dialog'] [class*='swatch']",
      "[role='dialog'] [style*='background']",
    ];

    const locators: Locator[] = [];
    const seen = new Set<string>();
    for (const selector of selectors) {
      const candidates = this.page.locator(selector);
      const count = await candidates.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const locator = candidates.nth(index);
        if (!(await isLocatorCurrentlyVisible(locator))) {
          continue;
        }
        const summary = await elementDomSummary(locator);
        if (seen.has(summary)) {
          continue;
        }
        seen.add(summary);
        locators.push(locator);
      }
    }

    return Promise.all(
      locators.map(async (locator, index) => {
        const computedColor = await locator
          .evaluate((element) => getComputedStyle(element).backgroundColor)
          .catch(() => "");
        const matchedColor = parseMarkerColorFromCss(computedColor);
        const fallbackColor = DINGMAP_MARKER_COLOR_ORDER[index] ?? "black";
        return {
          locator,
          color: matchedColor ?? fallbackColor,
          fromComputedStyle: Boolean(matchedColor),
        };
      }),
    );
  }

  private async collectOptionsForLabel(label: string): Promise<OptionInspection[]> {
    const trigger = await this.findFieldTrigger(label);
    if (trigger && (await isNativeSelect(trigger))) {
      return trigger
        .evaluate((select) => {
          const htmlSelect = select as HTMLSelectElement;
          return Array.from(htmlSelect.options).map((option) => ({
            text: option.textContent?.trim() ?? "",
            domSummary: `<option value="${option.value}"> ${option.textContent?.trim() ?? ""}`.slice(0, 500),
          }));
        })
        .catch(() => []);
    }

    if (trigger) {
      await clickLocatorIfUsable(trigger);
      await this.page.waitForTimeout(250);
    }

    const optionLocators = await this.collectOptionLocators();
    return Promise.all(
      optionLocators.map(async (locator) => ({
        text: await locator.innerText().catch(() => ""),
        domSummary: await elementDomSummary(locator),
      })),
    );
  }

  private async clickOption(matches: (value: string) => boolean): Promise<boolean> {
    const options = await this.collectOptionLocators();
    for (const option of options) {
      const text = await option.innerText().catch(() => "");
      if (matches(text) && (await clickLocatorIfUsable(option))) {
        return true;
      }
    }
    return false;
  }

  private async collectOptionLocators(): Promise<Locator[]> {
    const selectors = [
      ".ant-select-dropdown:not(.ant-select-dropdown-hidden) [role='option']",
      ".ant-dropdown:not(.ant-dropdown-hidden) [role='option']",
      "[role='listbox'] [role='option']",
      "[role='option']",
      "[data-field] .options:not([hidden]) [role='option']",
    ];
    const locators: Locator[] = [];
    const seenTexts = new Set<string>();
    for (const selector of selectors) {
      const candidates = this.page.locator(selector);
      const count = await candidates.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const locator = candidates.nth(index);
        if (!(await isLocatorCurrentlyVisible(locator))) {
          continue;
        }
        const text = await locator.innerText().catch(() => "");
        if (!text || seenTexts.has(text)) {
          continue;
        }
        seenTexts.add(text);
        locators.push(locator);
      }
    }
    return locators;
  }

  private async selectNativeOptionNearLabel(
    label: string,
    matches: (value: string) => boolean,
  ): Promise<boolean> {
    const nearestControl = await this.findNearestControlBesideLabel(label, "field");
    if (nearestControl && (await isNativeSelect(nearestControl))) {
      return this.selectNativeOption(nearestControl, label, matches);
    }

    const isMarkerSizeLabel = label.includes(MARKER_SIZE_LABEL) || MARKER_SIZE_LABEL.includes(label);

    return this.page
      .locator("select")
      .evaluateAll((selects, args) => {
        const normalize = (value: string | null | undefined) =>
          String(value ?? "").replace(/\s+/g, "").trim();
        for (const select of selects) {
          const htmlSelect = select as HTMLSelectElement;
          const surroundingText = normalize(htmlSelect.parentElement?.textContent);
          if (!surroundingText.includes(args.label)) {
            continue;
          }
          const option = Array.from(htmlSelect.options).find((candidate) =>
            args.optionTexts.some((optionText) => normalize(candidate.textContent).includes(normalize(optionText))),
          );
          const fallbackOption = args.fallbackIndex >= 0 ? htmlSelect.options.item(args.fallbackIndex) : null;
          if (!option && !fallbackOption) {
            continue;
          }
          htmlSelect.value = (option ?? fallbackOption)?.value ?? "";
          htmlSelect.dispatchEvent(new Event("input", { bubbles: true }));
          htmlSelect.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        return false;
      }, {
        label,
        optionTexts:
          isMarkerSizeLabel
            ? [DINGMAP_MARKER_SIZE]
            : [MARS_COORDINATE_TEXT, MARS_COORDINATE_PROVIDER_TEXT],
        fallbackIndex: isMarkerSizeLabel ? 0 : -1,
      })
      .then((selected) => {
        return selected;
      })
      .catch(() => false);
  }

  private async selectNativeOption(
    locator: Locator,
    label: string,
    matches: (value: string) => boolean,
  ): Promise<boolean> {
    const isMarkerSizeLabel = label.includes(MARKER_SIZE_LABEL) || MARKER_SIZE_LABEL.includes(label);
    const optionTexts = await locator
      .evaluate((select) => {
        const htmlSelect = select as HTMLSelectElement;
        return Array.from(htmlSelect.options).map((option) => option.textContent?.trim() ?? "");
      })
      .catch(() => []);
    const textMatchIndex = optionTexts.findIndex((optionText) => matches(optionText));
    const optionIndex = textMatchIndex >= 0 ? textMatchIndex : isMarkerSizeLabel ? 0 : -1;
    if (optionIndex < 0) {
      return false;
    }
    await locator.selectOption({ index: optionIndex }).catch(async () => {
      await locator.evaluate((select, index) => {
        const htmlSelect = select as HTMLSelectElement;
        const option = htmlSelect.options.item(index);
        if (!option) {
          return;
        }
        htmlSelect.value = option.value;
        htmlSelect.dispatchEvent(new Event("input", { bubbles: true }));
        htmlSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }, optionIndex);
    });
    return locator
      .evaluate((select, index) => {
        const htmlSelect = select as HTMLSelectElement;
        return htmlSelect.selectedIndex === index;
      }, optionIndex)
      .catch(() => false);
  }

  private async findNearestControlBesideLabel(
    label: string,
    kind: "field" | "style",
  ): Promise<Locator | null> {
    const id = `dingmap-control-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const found = await this.page
      .evaluate(({ label, kind, id }) => {
        const root = findImportDialogRoot();
        const labelElement = findBestLabelElement(root, label);
        if (!labelElement) {
          return false;
        }

        const labelRect = getLabelSearchRect(labelElement, label);
        const pointElement = findControlByPoint(root, labelRect, kind);
        if (pointElement) {
          pointElement.setAttribute("data-dingmap-control-id", id);
          return true;
        }

        const selectors =
          kind === "style"
            ? [
                "button",
                "[role='button']",
                "svg",
                "img",
                "i",
                "[aria-label]",
                "[title]",
                "[class*='icon']",
                "[class*='marker']",
                "span",
                "div",
              ]
            : [
                "select",
                "[role='combobox']",
                ".ant-select-selector",
                ".ant-select-selection-item",
                "button.trigger",
                "button:not([role='tab'])",
                "[role='button']",
              ];
        const candidates = uniqueElements(
          selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector))),
        )
          .map((element) => normalizeClickableElement(element, kind))
          .filter((element): element is HTMLElement | SVGElement => Boolean(element))
          .filter((element) => element !== labelElement && isVisible(element));

        const scored = candidates
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const labelCenterY = labelRect.top + labelRect.height / 2;
            const yDistance = Math.abs(centerY - labelCenterY);
            const xDistance = rect.left - labelRect.right;
            const sameRowLimit = Math.max(28, labelRect.height * 2.4);
            if (xDistance < -6 || yDistance > sameRowLimit) {
              return null;
            }
            if (kind === "style" && element instanceof HTMLSelectElement) {
              return null;
            }
            if (kind === "field" && !isFieldControl(element)) {
              return null;
            }
            if (kind === "style" && !isStyleControl(element)) {
              return null;
            }
            const priority = getElementPriority(element, kind);
            return {
              element,
              score: yDistance * 1000 + xDistance + priority,
            };
          })
          .filter((candidate): candidate is { element: HTMLElement | SVGElement; score: number } =>
            Boolean(candidate),
          )
          .sort((left, right) => left.score - right.score);

        const best = scored[0]?.element;
        if (!best) {
          return false;
        }
        best.setAttribute("data-dingmap-control-id", id);
        return true;

        function findImportDialogRoot(): Element {
          const roots = Array.from(
            document.querySelectorAll("[role='dialog'], .ant-modal, .modal, .dialog"),
          );
          return (
            roots.find((element) => textOf(element).includes("数据导入")) ??
            roots[roots.length - 1] ??
            document.body
          );
        }

        function findBestLabelElement(rootElement: Element, expectedLabel: string): Element | null {
          return Array.from(rootElement.querySelectorAll("label,*"))
            .filter((element) => {
              const normalized = normalizeLabel(textOf(element));
              return normalized === expectedLabel || normalized.startsWith(expectedLabel);
            })
            .sort((left, right) => {
              const leftText = normalizeLabel(textOf(left));
              const rightText = normalizeLabel(textOf(right));
              const score = (value: string) =>
                value === expectedLabel ? 0 : value.startsWith(expectedLabel) ? 1 : 2;
              return score(leftText) - score(rightText) || leftText.length - rightText.length;
            })[0] ?? null;
        }

        function getLabelSearchRect(labelElement: Element, expectedLabel: string): DOMRect {
          return findLabelTextRect(labelElement, expectedLabel) ?? labelElement.getBoundingClientRect();
        }

        function findLabelTextRect(labelElement: Element, expectedLabel: string): DOMRect | null {
          const walker = document.createTreeWalker(labelElement, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const textNode = walker.currentNode;
            const text = textNode.textContent ?? "";
            const start = text.indexOf(expectedLabel);
            if (start < 0) {
              continue;
            }
            const range = document.createRange();
            range.setStart(textNode, start);
            range.setEnd(textNode, start + expectedLabel.length);
            const rect = range.getBoundingClientRect();
            range.detach();
            if (rect.width > 0 && rect.height > 0) {
              return rect;
            }
          }
          return null;
        }

        function normalizeClickableElement(
          element: Element,
          controlKind: "field" | "style",
        ): HTMLElement | SVGElement | null {
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
            return null;
          }
          if (controlKind === "field") {
            return element;
          }
          return (
            element.closest("button,[role='button'],[aria-label],[title]") ??
            element
          ) as HTMLElement | SVGElement | null;
        }

        function isVisible(element: Element): boolean {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        }

        function getElementPriority(element: Element, controlKind: "field" | "style"): number {
          if (controlKind === "field" && element instanceof HTMLSelectElement) {
            return 0;
          }
          if (element.getAttribute("role") === "combobox") {
            return 1;
          }
          if (element.tagName.toLowerCase() === "button") {
            return 2;
          }
          if (element.getAttribute("role") === "button") {
            return 3;
          }
          if (controlKind === "style" && /svg|img|i|span|div/i.test(element.tagName)) {
            return 4;
          }
          return 10;
        }

        function isFieldControl(element: Element): boolean {
          const tagName = element.tagName.toLowerCase();
          const className = getClassName(element).toLowerCase();
          const text = normalizeLabel(textOf(element));
          if (isUnrelatedAction(element) || text === "导入") {
            return false;
          }
          return (
            element instanceof HTMLSelectElement ||
            element.getAttribute("role") === "combobox" ||
            className.includes("select") ||
            className.includes("trigger") ||
            tagName === "input"
          );
        }

        function isStyleControl(element: Element): boolean {
          if (element instanceof HTMLSelectElement || isUnrelatedAction(element)) {
            return false;
          }

          const rect = element.getBoundingClientRect();
          const tagName = element.tagName.toLowerCase();
          const className = getClassName(element).toLowerCase();
          const text = normalizeLabel(textOf(element));
          const labelText = normalizeLabel(label);
          const ariaLabel = String(element.getAttribute("aria-label") ?? "");
          const title = String(element.getAttribute("title") ?? "");
          const role = element.getAttribute("role");
          const compact = rect.width <= 96 && rect.height <= 96;

          if (text.includes(labelText)) {
            return false;
          }
          if (text.includes("标记大小") || text.includes("坐标类型")) {
            return false;
          }

          const iconish =
            /^(svg|img|i|span)$/i.test(tagName) ||
            tagName === "button" ||
            role === "button" ||
            className.includes("icon") ||
            className.includes("marker") ||
            className.includes("style") ||
            normalizeLabel(ariaLabel).includes(labelText) ||
            normalizeLabel(title).includes(labelText);

          return iconish && (compact || text.length === 0 || text.includes("图标"));
        }

        function isUnrelatedAction(element: Element): boolean {
          const text = normalizeLabel(textOf(element));
          return (
            text === "导入" ||
            text.includes("下载导入模板") ||
            text.includes("新增数据教程") ||
            text.includes("更新数据教程") ||
            text === "新增数据" ||
            text === "更新数据"
          );
        }

        function getClassName(element: Element): string {
          return String(element.getAttribute("class") ?? "");
        }

        function uniqueElements(elements: Element[]): Element[] {
          return Array.from(new Set(elements));
        }

        function findControlByPoint(
          rootElement: Element,
          labelBox: DOMRect,
          controlKind: "field" | "style",
        ): HTMLElement | SVGElement | null {
          const centerY = labelBox.top + labelBox.height / 2;
          for (const dy of [0, -8, 8, -16, 16, -24, 24]) {
            for (let dx = 8; dx <= 380; dx += 8) {
              const elements = document.elementsFromPoint(labelBox.right + dx, centerY + dy);
              for (const element of elements) {
                if (!rootElement.contains(element) || element === labelElement) {
                  continue;
                }
                const normalized = normalizeClickableElement(element, controlKind);
                if (!normalized || normalized === labelElement || !isVisible(normalized)) {
                  continue;
                }
                if (controlKind === "field") {
                  if (isFieldControl(normalized)) {
                    return normalized;
                  }
                  continue;
                }
                if (isStyleControl(normalized)) {
                  return normalized;
                }
              }
            }
          }
          return null;
        }

        function textOf(element: Element | null | undefined): string {
          if (!element) {
            return "";
          }
          if (element instanceof HTMLSelectElement) {
            return element.selectedOptions[0]?.textContent?.trim() ?? "";
          }
          return String((element as HTMLElement).innerText ?? element.textContent ?? "").trim();
        }

        function normalizeLabel(value: string): string {
          return value.replace(/\s+/g, "").replace(/[：:]/g, "").trim();
        }
      }, { label, kind, id })
      .catch(() => false);

    if (!found) {
      return null;
    }
    return this.page.locator(`[data-dingmap-control-id="${id}"]`).first();
  }

  private async findFirstFileInput(): Promise<Locator | null> {
    return firstExistingLocator(this.page, dingmapSelectors.fileInputs);
  }

  private async waitForSelectedFile(filename: string): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < MEDIUM_WAIT_MS) {
      if (await this.hasFileInputWithFilename(filename)) {
        return true;
      }

      if (await isLocatorVisible(this.page.getByText(filename, { exact: false }).first(), SHORT_WAIT_MS)) {
        return true;
      }

      await this.page.waitForTimeout(200);
    }
    return false;
  }

  private async hasFileInputWithFilename(filename: string): Promise<boolean> {
    return this.page.locator("input[type='file']").evaluateAll((inputs, expectedFilename) => {
      return inputs.some((input) => {
        const fileInput = input as HTMLInputElement;
        return Array.from(fileInput.files ?? []).some((file) => file.name === expectedFilename);
      });
    }, filename).catch(() => false);
  }
}

export function isDingmapConfirmedMarsCoordinateText(value: string): boolean {
  const normalized = normalizeCoordinateText(value);
  if (!normalized || isConcatenatedCoordinateOptionText(value)) {
    return false;
  }

  return (
    normalized.includes(normalizeCoordinateText(MARS_COORDINATE_TEXT)) ||
    (normalized.includes("高德") && normalized.includes("腾讯") && normalized.includes("谷歌"))
  );
}

export function isDingmapConfirmedSmallMarkerSizeText(value: string): boolean {
  const normalized = normalizeMarkerSizeText(value);
  if (!normalized || isConcatenatedMarkerSizeOptionText(value)) {
    return false;
  }

  return normalized === "小" || normalized.includes("小号") || normalized === "small";
}

export function isDingmapMarsCoordinateOptionText(value: string): boolean {
  return isMarsCoordinateOptionText(value);
}

export function isDingmapSmallMarkerSizeText(value: string): boolean {
  return isDingmapConfirmedSmallMarkerSizeText(value);
}

function isMarsCoordinateOptionText(value: string): boolean {
  const normalized = normalizeCoordinateText(value);
  return (
    normalized.includes(normalizeCoordinateText(MARS_COORDINATE_TEXT)) ||
    (normalized.includes("高德") && normalized.includes("腾讯") && normalized.includes("谷歌"))
  );
}

function isSmallMarkerSizeOptionText(value: string): boolean {
  const normalized = normalizeMarkerSizeText(value);
  return normalized === "小" || normalized.includes("小号") || normalized === "small";
}

function isConcatenatedCoordinateOptionText(value: string): boolean {
  const normalized = normalizeCoordinateText(value);
  const matchedOptions = COORDINATE_OPTION_TEXTS.filter((option) =>
    normalized.includes(normalizeCoordinateText(option)),
  );
  return matchedOptions.length >= 2;
}

function isConcatenatedMarkerSizeOptionText(value: string): boolean {
  const normalized = normalizeMarkerSizeText(value);
  const matchedOptions = MARKER_SIZE_OPTION_TEXTS.filter((option) => normalized.includes(option));
  return matchedOptions.length >= 2;
}

function normalizeCoordinateText(value: string): string {
  return value
    .replace(COORDINATE_TYPE_LABEL, "")
    .replace(/[:：]/g, "")
    .replace(/[()]/g, (match) => (match === "(" ? "（" : "）"))
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function normalizeMarkerSizeText(value: string): string {
  return value
    .replace(MARKER_SIZE_LABEL, "")
    .replace(/[:：]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function parseMarkerColorFromCss(value: string): DingmapMarkerColor | null {
  const channels = value.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3) {
    return null;
  }

  let best: { color: DingmapMarkerColor; distance: number } | null = null;
  for (const color of DINGMAP_MARKER_COLOR_ORDER) {
    for (const hint of MARKER_COLOR_RGB_HINTS[color]) {
      const distance =
        Math.abs(channels[0] - hint[0]) +
        Math.abs(channels[1] - hint[1]) +
        Math.abs(channels[2] - hint[2]);
      if (!best || distance < best.distance) {
        best = { color, distance };
      }
    }
  }

  return best && best.distance <= 80 ? best.color : null;
}

async function firstVisibleLocator(page: Page, selectors: readonly string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0 && (await isLocatorVisible(locator))) {
      return locator;
    }
  }
  return null;
}

async function firstExistingLocator(page: Page, selectors: readonly string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count().catch(() => 0)) > 0) {
      return locator;
    }
  }
  return null;
}

async function isNativeSelect(locator: Locator): Promise<boolean> {
  return locator
    .evaluate((element) => element instanceof HTMLSelectElement)
    .catch(() => false);
}

async function readControlText(locator: Locator): Promise<string> {
  return locator
    .evaluate((element) => {
      if (element instanceof HTMLSelectElement) {
        return element.selectedOptions[0]?.textContent?.trim() ?? "";
      }
      if (element instanceof HTMLInputElement) {
        return element.value.trim();
      }
      const text = String((element as HTMLElement).innerText ?? element.textContent ?? "").trim();
      const title = element.getAttribute("title") ?? "";
      const aria = element.getAttribute("aria-label") ?? "";
      return text || title || aria;
    })
    .catch(() => "");
}

async function clickFirstEnabledVisible(page: Page, selectors: readonly string[]): Promise<boolean> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await clickLocatorIfUsable(locator)) {
      return true;
    }
  }
  return false;
}

async function hasVisibleSelector(
  page: Page,
  selectors: readonly string[],
  timeoutMs = SHORT_WAIT_MS,
): Promise<boolean> {
  for (const selector of selectors) {
    if (await isLocatorVisible(page.locator(selector).first(), timeoutMs)) {
      return true;
    }
  }
  return false;
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
    return false;
  }
  return false;
}

async function isLocatorVisible(locator: Locator, timeoutMs = SHORT_WAIT_MS): Promise<boolean> {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function isLocatorCurrentlyVisible(locator: Locator): Promise<boolean> {
  try {
    return (await locator.count()) > 0 && (await locator.isVisible());
  } catch {
    return false;
  }
}

async function locatorSummary(locator: Locator | null): Promise<string> {
  if (!locator) {
    return "";
  }
  return elementDomSummary(locator);
}

async function elementDomSummary(locator: Locator): Promise<string> {
  return locator
    .evaluate((element) => {
      const attrs = Array.from(element.attributes)
        .map((attr) => `${attr.name}="${attr.value}"`)
        .join(" ");
      const text = String((element as HTMLElement).innerText ?? element.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return `<${element.tagName.toLowerCase()} ${attrs}> ${text}`.slice(0, 500);
    })
    .catch(() => "");
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
