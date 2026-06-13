import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { runDingmapUploadBrowser } from "./dingmap-upload";

const tempPaths: string[] = [];
let browser: Browser | null = null;
let context: BrowserContext | null = null;

afterEach(async () => {
  await context?.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
  context = null;
  browser = null;

  for (const filePath of tempPaths.splice(0)) {
    rmSync(filePath, { recursive: true, force: true });
  }
});

describe("DingMap upload browser resume", () => {
  it("continues from the current import dialog without navigating away", async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    const page = await context.newPage();
    const exportFilePath = join(mkTempDir("dingmap-resume-export-"), "template.xlsx");
    writeFileSync(exportFilePath, "fake workbook");
    await page.setContent(buildCurrentImportDialogHtml());

    const result = await runDingmapUploadBrowser({
      exportFilePath,
      profileDir: mkTempDir("dingmap-unused-profile-"),
      screenshotsDir: mkTempDir("dingmap-resume-screenshots-"),
      mapUrl: "about:blank",
      platform: "meituan",
      timeoutMs: 12_000,
      session: { context, page },
      resumeCurrentDialog: true,
    });

    expect(result.status, JSON.stringify(result)).toBe("success");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("yellow");
    await expect(page.locator("body").getAttribute("data-import-clicked")).resolves.toBe("true");
  }, 30_000);

  it("continues when a hidden data import menu item appears before the visible import dialog", async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    const page = await context.newPage();
    const exportFilePath = join(mkTempDir("dingmap-resume-export-"), "template.xlsx");
    writeFileSync(exportFilePath, "fake workbook");
    await page.setContent(buildCurrentImportDialogHtmlWithHiddenMenu());

    const result = await runDingmapUploadBrowser({
      exportFilePath,
      profileDir: mkTempDir("dingmap-unused-profile-"),
      screenshotsDir: mkTempDir("dingmap-resume-screenshots-"),
      mapUrl: "about:blank",
      platform: "meituan",
      timeoutMs: 12_000,
      session: { context, page },
      resumeCurrentDialog: true,
    });

    expect(result.status, JSON.stringify(result)).toBe("success");
    await expect(page.locator("body").getAttribute("data-import-clicked")).resolves.toBe("true");
  }, 30_000);

});

function mkTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempPaths.push(dir);
  return dir;
}

function buildCurrentImportDialogHtml(): string {
  return `
    <!doctype html>
    <style>
      .swatch { width: 24px; height: 24px; display: inline-block; }
      .blue { background-color: rgb(75, 128, 204); }
      .green { background-color: rgb(84, 179, 65); }
      .red { background-color: rgb(255, 0, 0); }
      .purple { background-color: rgb(160, 95, 176); }
      .orange { background-color: rgb(255, 112, 45); }
      .yellow { background-color: rgb(255, 188, 64); }
      .black { background-color: rgb(0, 0, 0); }
    </style>
    <div role="dialog" aria-label="数据导入">
      <h2>数据导入</h2>
      <button role="tab">新增数据</button>
      <div>
        <span>坐标类型：</span>
        <select data-kind="coordinate">
          <option selected>火星坐标（高德/腾讯/谷歌）</option>
          <option>百度坐标</option>
          <option>大地坐标</option>
        </select>
      </div>
      <div>
        <span>标记样式：</span>
        <div class="ant-popover marker-style-panel">
          ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
            .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
            .join("")}
        </div>
      </div>
      <div>
        <span>标记大小：</span>
        <select data-kind="marker-size">
          <option selected>小</option>
          <option>中</option>
          <option>大</option>
        </select>
      </div>
      <label class="upload-zone">点击选择导入文件<input type="file" accept=".xlsx" hidden /></label>
      <button class="import-button" type="button">导入</button>
    </div>
    <script>
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
        });
      });
      document.querySelector(".import-button").addEventListener("click", () => {
        document.body.setAttribute("data-import-clicked", "true");
        const success = document.createElement("div");
        success.textContent = "导入成功";
        document.body.appendChild(success);
      });
    </script>
  `;
}

function buildCurrentImportDialogHtmlWithHiddenMenu(): string {
  return `
    <!doctype html>
    <style>
      [hidden] { display: none; }
      .swatch { width: 24px; height: 24px; display: inline-block; }
      .blue { background-color: rgb(75, 128, 204); }
      .green { background-color: rgb(84, 179, 65); }
      .red { background-color: rgb(255, 0, 0); }
      .purple { background-color: rgb(160, 95, 176); }
      .orange { background-color: rgb(255, 112, 45); }
      .yellow { background-color: rgb(255, 188, 64); }
      .black { background-color: rgb(0, 0, 0); }
    </style>
    <div role="menu" hidden>
      <div role="menuitem">设置为默认</div>
      <div role="menuitem">数据导入</div>
    </div>
    <section class="import-window">
      <h2>数据导入</h2>
      <button role="tab">新增数据</button>
      <div>
        <span>坐标类型：</span>
        <select data-kind="coordinate">
          <option selected>火星坐标（高德/腾讯/谷歌）</option>
          <option>百度坐标</option>
          <option>大地坐标</option>
        </select>
      </div>
      <div>
        <span>标记样式：</span>
        <div class="ant-popover marker-style-panel">
          ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
            .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
            .join("")}
        </div>
      </div>
      <div>
        <span>标记大小：</span>
        <select data-kind="marker-size">
          <option selected>小</option>
          <option>中</option>
          <option>大</option>
        </select>
      </div>
      <label class="upload-zone">点击选择导入文件<input type="file" accept=".xlsx" hidden /></label>
      <button class="import-button" type="button">导入</button>
    </section>
    <script>
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
        });
      });
      document.querySelector(".import-button").addEventListener("click", () => {
        document.body.setAttribute("data-import-clicked", "true");
        const success = document.createElement("div");
        success.textContent = "导入成功";
        document.body.appendChild(success);
      });
    </script>
  `;
}
