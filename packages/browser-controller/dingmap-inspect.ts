import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  DingMapImportDialogController,
  type DingmapImportDialogInspection,
} from "./dingmap-import-dialog";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_TEAM_NAME,
  openDingmapUploadSession,
} from "./dingmap-upload";
import { resolveDingmapPlatform } from "./dingmap-platforms";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE_DIR = join(PROJECT_ROOT, "data", "browser-profile", "dingmap");
const DEBUG_DIR = join(PROJECT_ROOT, "data", "debug", "dingmap-upload");
const SCREENSHOTS_DIR = join(PROJECT_ROOT, "data", "screenshots", "dingmap-upload");

async function main(): Promise<void> {
  mkdirSync(DEBUG_DIR, { recursive: true });
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const captureNow = args.includes("--capture-now");
  const platformArg = args.find((arg) => !arg.startsWith("--")) ?? "meituan";
  const platform = resolveDingmapPlatform(platformArg);
  let session: Awaited<ReturnType<typeof openDingmapUploadSession>> | null = null;

  try {
    session = await openDingmapUploadSession(PROFILE_DIR);
    const page = session.page;

    if (!page.url().includes("dm.dingmap.com")) {
      await page.goto(DINGMAP_HOME_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    }
    await page.bringToFront().catch(() => undefined);

    console.log("已打开自动化 Chrome。");
    console.log(`目标团队：${DINGMAP_TARGET_TEAM_NAME}`);
    console.log(`目标地图：${DINGMAP_TARGET_MAP_NAME}`);
    console.log(`诊断平台：${platform.label} / ${platform.markerColorLabel}`);
    console.log("请在自动化 Chrome 中打开目标图层的“数据导入”弹窗，并停留在“新增数据”页签。");

    if (!captureNow) {
      console.log("准备好后回到终端按 Enter，脚本会读取真实 DOM 并保存诊断文件。");
      await waitForEnter();
    } else {
      console.log("已启用 --capture-now，将直接读取当前页面 DOM。");
    }

    await assertImportDialogReady(page);

    const controller = new DingMapImportDialogController(page, { platform });
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const screenshotPath = join(SCREENSHOTS_DIR, `${timestamp}-import-dialog-inspect.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const inspection: DingmapImportDialogInspection = {
      ...(await controller.inspect()),
      screenshotPath: toProjectRelativePath(screenshotPath),
    };
    const jsonPath = join(DEBUG_DIR, `${timestamp}-import-dialog-inspect.json`);
    const txtPath = join(DEBUG_DIR, `${timestamp}-import-dialog-inspect.txt`);
    writeFileSync(jsonPath, `${JSON.stringify(inspection, null, 2)}\n`, "utf8");
    writeFileSync(txtPath, formatInspectionText(inspection), "utf8");

    console.log(`诊断 JSON：${toProjectRelativePath(jsonPath)}`);
    console.log(`诊断 TXT：${toProjectRelativePath(txtPath)}`);
    console.log(`截图：${toProjectRelativePath(screenshotPath)}`);
  } finally {
    if (session) {
      await session.context.close().catch(() => undefined);
    }
  }
}

function formatInspectionText(inspection: DingmapImportDialogInspection): string {
  return [
    `URL: ${inspection.url}`,
    `Title: ${inspection.title}`,
    `Screenshot: ${inspection.screenshotPath ?? ""}`,
    "",
    "坐标类型",
    `label locator: ${inspection.coordinateType.labelLocator}`,
    `trigger locator: ${inspection.coordinateType.triggerLocator}`,
    `当前显示值: ${inspection.coordinateType.currentText || "未读取"}`,
    `是否拼接多个选项: ${inspection.coordinateType.hasConcatenatedOptions ? "是" : "否"}`,
    `选项: ${inspection.coordinateType.options.map((option) => option.text).join(" | ")}`,
    formatNearbyControls(inspection.coordinateType.nearbyControls),
    "",
    "标记样式",
    `label locator: ${inspection.markerStyle.labelLocator}`,
    `trigger locator: ${inspection.markerStyle.triggerLocator}`,
    `panel locator: ${inspection.markerStyle.panelLocator}`,
    `颜色块数量: ${inspection.markerStyle.swatchCount}`,
    `颜色块: ${inspection.markerStyle.swatches
      .map((swatch) => `${swatch.index}:${swatch.fallbackColor}:${swatch.backgroundColor}`)
      .join(" | ")}`,
    formatNearbyControls(inspection.markerStyle.nearbyControls),
    "",
    "标记大小",
    `label locator: ${inspection.markerSize.labelLocator}`,
    `trigger locator: ${inspection.markerSize.triggerLocator}`,
    `当前显示值: ${inspection.markerSize.currentText || "未读取"}`,
    `是否拼接多个选项: ${inspection.markerSize.hasConcatenatedOptions ? "是" : "否"}`,
    `选项: ${inspection.markerSize.options.map((option) => option.text).join(" | ")}`,
    formatNearbyControls(inspection.markerSize.nearbyControls),
    "",
    "文件上传",
    `上传区域 locator: ${inspection.upload.uploadZoneLocator}`,
    `input[type=file] locator: ${inspection.upload.fileInputLocator}`,
    `input 数量: ${inspection.upload.inputCount}`,
    `是否可 setInputFiles: ${inspection.upload.canSetInputFiles ? "是" : "否"}`,
    "",
    "导入按钮",
    `locator: ${inspection.importButton.locator}`,
    `文本: ${inspection.importButton.text}`,
    `enabled: ${inspection.importButton.enabled ? "是" : "否"}`,
    "",
  ].join("\n");
}

async function waitForEnter(): Promise<void> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await readline.question("");
  } finally {
    readline.close();
  }
}

async function assertImportDialogReady(page: { url(): string; locator: (selector: string) => { count(): Promise<number> }; getByText: (text: string, options?: { exact?: boolean }) => { first(): { isVisible(): Promise<boolean> } } }): Promise<void> {
  const url = page.url();
  if (url.includes("/user/login") || /login|signin/i.test(url)) {
    throw new Error("当前页面是钉图登录页，请先登录并打开“数据导入”弹窗后再运行诊断。");
  }

  const hasDialogTitle = await page
    .getByText("数据导入", { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  const fileInputCount = await page.locator("input[type='file']").count().catch(() => 0);
  if (!hasDialogTitle || fileInputCount === 0) {
    throw new Error("未检测到“数据导入”弹窗或文件上传 input，请先打开真实导入弹窗后再运行诊断。");
  }
}

function formatNearbyControls(controls: DingmapImportDialogInspection["markerSize"]["nearbyControls"]): string {
  if (controls.length === 0) {
    return "附近控件: 无";
  }

  return `附近控件:\n${controls
    .map((control, index) => {
      const box = control.boundingBox
        ? `${Math.round(control.boundingBox.x)},${Math.round(control.boundingBox.y)},${Math.round(
            control.boundingBox.width,
          )}x${Math.round(control.boundingBox.height)}`
        : "无";
      return `${index + 1}. <${control.tagName}> text="${control.text}" class="${control.className}" aria="${control.ariaLabel}" title="${control.title}" box=${box}`;
    })
    .join("\n")}`;
}

function toProjectRelativePath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
