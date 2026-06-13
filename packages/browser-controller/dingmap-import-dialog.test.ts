import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import {
  DingMapImportDialogController,
  isDingmapConfirmedMarsCoordinateText,
  isDingmapConfirmedSmallMarkerSizeText,
} from "./dingmap-import-dialog";
import { resolveDingmapPlatform } from "./dingmap-platforms";

describe("DingMapImportDialogController", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("accepts an already selected Mars coordinate value without reading concatenated options", async () => {
    await page.setContent(buildImportDialogHtml({ coordinate: "火星坐标（高德/腾讯/谷歌）" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setCoordinateType();

    expect(result.status).toBe("ok");
    expect(result.confirmedCoordinateType).toBe("火星坐标（高德/腾讯/谷歌）");
  });

  it("selects Mars coordinate type when another coordinate type is selected", async () => {
    await page.setContent(buildImportDialogHtml({ coordinate: "百度坐标" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setCoordinateType();

    expect(result.status).toBe("ok");
    expect(result.confirmedCoordinateType).toBe("火星坐标（高德/腾讯/谷歌）");
    await expect(page.locator("[data-field='coordinate'] .trigger").innerText()).resolves.toBe(
      "火星坐标（高德/腾讯/谷歌）",
    );
  });

  it("blocks when coordinate confirmation reads concatenated option text", async () => {
    await page.setContent(
      buildImportDialogHtml({
        coordinate: "火星坐标（高德/腾讯/谷歌） 百度坐标 大地坐标",
      }),
    );
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setCoordinateType();

    expect(result.status).toBe("blocked");
    expect(result.confirmedCoordinateType).toBe("火星坐标（高德/腾讯/谷歌） 百度坐标 大地坐标");
  });

  it("selects the platform color from computed swatch styles before falling back to order", async () => {
    await page.setContent(buildImportDialogHtml({ markerSize: "小" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("yellow");
  });

  it("selects the red swatch for interview markers", async () => {
    await page.setContent(buildImportDialogHtml({ markerSize: "小" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("mianshi"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("红色");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("red");
  });

  it("uses centralized color order fallback when computed styles are unavailable", async () => {
    await page.setContent(
      buildImportDialogHtml({
        markerSize: "小",
        useColorClasses: false,
      }),
    );
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("yellow");
  });

  it("blocks marker style when no swatches can be found", async () => {
    await page.setContent(buildImportDialogHtml({ includeSwatches: false }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("blocked");
  });

  it("opens marker style from a plain icon element beside the label", async () => {
    await page.setContent(buildFlatNativeImportDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("yellow");
  });

  it("selects a visible marker color when the style panel was opened manually", async () => {
    await page.setContent(buildManuallyOpenedMarkerStyleDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
    await expect(page.locator("body").getAttribute("data-selected-color")).resolves.toBe("yellow");
  });

  it("accepts an already selected small marker size", async () => {
    await page.setContent(buildImportDialogHtml({ markerSize: "小" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerSize();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerSize).toBe("小");
  });

  it("selects small marker size when medium is selected", async () => {
    await page.setContent(buildImportDialogHtml({ markerSize: "中" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerSize();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerSize).toBe("小");
    await expect(page.locator("[data-field='marker-size'] .trigger").innerText()).resolves.toBe("小");
  });

  it("reads marker size from the control beside its label when native selects share one flat container", async () => {
    await page.setContent(buildFlatNativeImportDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerSize();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerSize).toBe("小");
    await expect(
      page.locator("select[data-kind='marker-size']").evaluate((select) => {
        const htmlSelect = select as HTMLSelectElement;
        return htmlSelect.selectedOptions[0]?.textContent?.trim();
      }),
    ).resolves.toBe("小");
  });

  it("reads marker size when the label text and native select share the same element", async () => {
    await page.setContent(buildInlineTextImportDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const inspection = await controller.inspect();
    const result = await controller.setMarkerSize();

    expect(inspection.markerSize.currentText).toBe("中");
    expect(inspection.markerSize.nearbyControls.length).toBeGreaterThan(0);
    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerSize).toBe("小");
  });

  it("opens marker style when the label text and icon share the same element", async () => {
    await page.setContent(buildInlineTextImportDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const inspection = await controller.inspect();
    const result = await controller.setMarkerStyle();

    expect(inspection.markerStyle.nearbyControls.length).toBeGreaterThan(0);
    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
  });

  it("skips wide label rows and clicks the compact marker style icon", async () => {
    await page.setContent(buildWideMarkerStyleRowDialogHtml());
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerStyle();

    expect(result.status).toBe("ok");
    expect(result.confirmedMarkerStyle).toBe("黄色");
    await expect(page.locator("body").getAttribute("data-style-opened")).resolves.toBe("true");
  });

  it("blocks marker size when the page still confirms medium after selecting small", async () => {
    await page.setContent(buildImportDialogHtml({ markerSize: "中", keepMediumSize: true }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
    });

    const result = await controller.setMarkerSize();

    expect(result.status).toBe("blocked");
    expect(result.confirmedMarkerSize).toBe("中");
  });

  it("only uploads after all import options are confirmed", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "dingmap-import-dialog-"));
    const exportPath = join(tempDir, "template.xlsx");
    writeFileSync(exportPath, "fake");
    await page.setContent(buildImportDialogHtml({ markerSize: "中" }));
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
      exportFilePath: exportPath,
    });

    const options = await controller.setImportOptions();
    const upload = await controller.uploadFile();

    expect(options.status).toBe("ok");
    expect(upload.status).toBe("ok");
    expect(await page.locator("input[type='file']").evaluate((input) => {
      const fileInput = input as HTMLInputElement;
      return fileInput.files?.[0]?.name;
    })).toBe("template.xlsx");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not upload or click import when an import option is blocked", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "dingmap-import-dialog-"));
    const exportPath = join(tempDir, "template.xlsx");
    writeFileSync(exportPath, "fake");
    await page.setContent(
      buildImportDialogHtml({
        coordinate: "火星坐标（高德/腾讯/谷歌） 百度坐标 大地坐标",
      }),
    );
    const controller = new DingMapImportDialogController(page, {
      platform: resolveDingmapPlatform("meituan"),
      exportFilePath: exportPath,
    });

    const options = await controller.setImportOptions();

    expect(options.status).toBe("blocked");
    await expect(
      page.locator("input[type='file']").evaluate((input) => (input as HTMLInputElement).files?.length ?? 0),
    ).resolves.toBe(0);
    await expect(page.locator("[data-import-clicked]").count()).resolves.toBe(0);

    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("DingMap import dialog confirmed text guards", () => {
  it("rejects concatenated coordinate option text", () => {
    expect(isDingmapConfirmedMarsCoordinateText("火星坐标（高德/腾讯/谷歌）")).toBe(true);
    expect(
      isDingmapConfirmedMarsCoordinateText("火星坐标（高德/腾讯/谷歌） 百度坐标 大地坐标"),
    ).toBe(false);
  });

  it("rejects concatenated marker size option text", () => {
    expect(isDingmapConfirmedSmallMarkerSizeText("小")).toBe(true);
    expect(isDingmapConfirmedSmallMarkerSizeText("小 中 大")).toBe(false);
  });
});

function buildImportDialogHtml(options: {
  coordinate?: string;
  markerSize?: string;
  useColorClasses?: boolean;
  includeSwatches?: boolean;
  keepMediumSize?: boolean;
} = {}): string {
  const coordinate = options.coordinate ?? "火星坐标（高德/腾讯/谷歌）";
  const markerSize = options.markerSize ?? "中";
  const useColorClasses = options.useColorClasses ?? true;
  const includeSwatches = options.includeSwatches ?? true;

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
      [hidden] { display: none; }
    </style>
    <div role="dialog" aria-label="数据导入">
      <button role="tab">新增数据</button>
      <div class="ant-form-item" data-field="coordinate">
        <label>坐标类型：</label>
        <button class="trigger" role="combobox" type="button">${coordinate}</button>
        <div class="options" hidden>
          <button role="option" type="button">火星坐标（高德/腾讯/谷歌）</button>
          <button role="option" type="button">百度坐标</button>
          <button role="option" type="button">大地坐标</button>
        </div>
      </div>
      <div class="ant-form-item" data-field="marker-style">
        <label>标记样式：</label>
        <button class="style-trigger" type="button" aria-label="标记样式图标">图标</button>
        <div class="ant-popover marker-style-panel" hidden>
          ${
            includeSwatches
              ? ["blue", "green", "red", "purple", "orange", "yellow", "black"]
                  .map((color) => {
                    const className = useColorClasses ? ` ${color}` : "";
                    return `<button class="swatch${className}" data-color="${color}" type="button"></button>`;
                  })
                  .join("")
              : ""
          }
        </div>
      </div>
      <div class="ant-form-item" data-field="marker-size">
        <label>标记大小：</label>
        <button class="trigger" role="combobox" type="button">${markerSize}</button>
        <div class="options" hidden>
          <button role="option" type="button">小</button>
          <button role="option" type="button">中</button>
          <button role="option" type="button">大</button>
        </div>
      </div>
      <label class="upload-zone">点击选择导入文件<input type="file" hidden /></label>
      <button class="import-button" type="button">导入</button>
    </div>
    <script>
      document.querySelector("[data-field='coordinate'] .trigger").addEventListener("click", () => {
        document.querySelector("[data-field='coordinate'] .options").hidden = false;
      });
      document.querySelectorAll("[data-field='coordinate'] [role='option']").forEach((option) => {
        option.addEventListener("click", () => {
          document.querySelector("[data-field='coordinate'] .trigger").textContent = option.textContent;
          document.querySelector("[data-field='coordinate'] .options").hidden = true;
        });
      });
      document.querySelector(".style-trigger").addEventListener("click", () => {
        document.querySelector(".marker-style-panel").hidden = false;
      });
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
          document.querySelector(".marker-style-panel").hidden = true;
        });
      });
      document.querySelector("[data-field='marker-size'] .trigger").addEventListener("click", () => {
        document.querySelector("[data-field='marker-size'] .options").hidden = false;
      });
      document.querySelectorAll("[data-field='marker-size'] [role='option']").forEach((option) => {
        option.addEventListener("click", () => {
          ${
            options.keepMediumSize
              ? ""
              : "document.querySelector(\"[data-field='marker-size'] .trigger\").textContent = option.textContent;"
          }
          document.querySelector("[data-field='marker-size'] .options").hidden = true;
        });
      });
      document.querySelector(".import-button").addEventListener("click", () => {
        document.body.setAttribute("data-import-clicked", "true");
      });
    </script>
  `;
}

function buildFlatNativeImportDialogHtml(): string {
  return `
    <!doctype html>
    <style>
      select { width: 180px; height: 32px; margin: 4px 16px 4px 4px; }
      .style-icon { width: 32px; height: 32px; display: inline-block; background: rgb(75, 128, 204); cursor: pointer; }
      .swatch { width: 24px; height: 24px; display: inline-block; }
      .blue { background-color: rgb(75, 128, 204); }
      .green { background-color: rgb(84, 179, 65); }
      .red { background-color: rgb(255, 0, 0); }
      .purple { background-color: rgb(160, 95, 176); }
      .orange { background-color: rgb(255, 112, 45); }
      .yellow { background-color: rgb(255, 188, 64); }
      .black { background-color: rgb(0, 0, 0); }
      [hidden] { display: none; }
    </style>
    <div role="dialog" aria-label="数据导入">
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
        <span class="style-icon" aria-label="标记样式图标"></span>
        <div class="ant-popover marker-style-panel" hidden>
          ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
            .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
            .join("")}
        </div>
      </div>
      <div>
        <span>标记大小：</span>
        <select data-kind="marker-size">
          <option>小</option>
          <option selected>中</option>
          <option>大</option>
        </select>
      </div>
      <label class="upload-zone">点击选择导入文件<input type="file" hidden /></label>
      <button class="import-button" type="button">导入</button>
    </div>
    <script>
      document.querySelector(".style-icon").addEventListener("click", () => {
        document.querySelector(".marker-style-panel").hidden = false;
      });
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
          document.querySelector(".marker-style-panel").hidden = true;
        });
      });
    </script>
  `;
}

function buildInlineTextImportDialogHtml(): string {
  return `
    <!doctype html>
    <style>
      .dialog-row { height: 38px; }
      select { width: 180px; height: 32px; margin-left: 8px; }
      .style-icon { width: 32px; height: 32px; display: inline-block; vertical-align: middle; background: rgb(75, 128, 204); cursor: pointer; margin-left: 8px; }
      .swatch { width: 24px; height: 24px; display: inline-block; }
      .blue { background-color: rgb(75, 128, 204); }
      .green { background-color: rgb(84, 179, 65); }
      .red { background-color: rgb(255, 0, 0); }
      .purple { background-color: rgb(160, 95, 176); }
      .orange { background-color: rgb(255, 112, 45); }
      .yellow { background-color: rgb(255, 188, 64); }
      .black { background-color: rgb(0, 0, 0); }
      [hidden] { display: none; }
    </style>
    <div role="dialog" aria-label="数据导入">
      <button role="tab">新增数据</button>
      <div class="dialog-row">
        坐标类型：<select data-kind="coordinate">
          <option selected>火星坐标（高德/腾讯/谷歌）</option>
          <option>百度坐标</option>
          <option>大地坐标</option>
        </select>
      </div>
      <div class="dialog-row">
        标记样式：<span class="style-icon" aria-label="标记样式图标"></span>
        <div class="ant-popover marker-style-panel" hidden>
          ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
            .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
            .join("")}
        </div>
      </div>
      <div class="dialog-row">
        标记大小：<select data-kind="marker-size">
          <option>小</option>
          <option selected>中</option>
          <option>大</option>
        </select>
      </div>
      <label class="upload-zone">点击选择导入文件<input type="file" hidden /></label>
      <button class="import-button" type="button">导入</button>
    </div>
    <script>
      document.querySelector(".style-icon").addEventListener("click", () => {
        document.querySelector(".marker-style-panel").hidden = false;
      });
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
          document.querySelector(".marker-style-panel").hidden = true;
        });
      });
    </script>
  `;
}

function buildWideMarkerStyleRowDialogHtml(): string {
  return `
    <!doctype html>
    <style>
      .dialog-row { width: 420px; height: 38px; position: relative; }
      .style-icon { position: absolute; left: 260px; top: 3px; width: 32px; height: 32px; display: inline-block; background: rgb(75, 128, 204); cursor: pointer; }
      .marker-style-panel { position: absolute; left: 120px; top: 48px; }
      .swatch { width: 24px; height: 24px; display: inline-block; }
      .blue { background-color: rgb(75, 128, 204); }
      .green { background-color: rgb(84, 179, 65); }
      .red { background-color: rgb(255, 0, 0); }
      .purple { background-color: rgb(160, 95, 176); }
      .orange { background-color: rgb(255, 112, 45); }
      .yellow { background-color: rgb(255, 188, 64); }
      .black { background-color: rgb(0, 0, 0); }
      [hidden] { display: none; }
    </style>
    <div role="dialog" aria-label="数据导入">
      <div class="dialog-row">
        标记样式：
        <span class="style-icon" aria-label="标记样式图标"></span>
      </div>
      <div class="ant-popover marker-style-panel" hidden>
        ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
          .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
          .join("")}
      </div>
    </div>
    <script>
      document.querySelector(".style-icon").addEventListener("click", () => {
        document.body.setAttribute("data-style-opened", "true");
        document.querySelector(".marker-style-panel").hidden = false;
      });
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
          document.querySelector(".marker-style-panel").hidden = true;
        });
      });
    </script>
  `;
}

function buildManuallyOpenedMarkerStyleDialogHtml(): string {
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
      <button role="tab">新增数据</button>
      <div>
        <span>标记样式：</span>
        <div class="ant-popover marker-style-panel">
          ${["blue", "green", "red", "purple", "orange", "yellow", "black"]
            .map((color) => `<span class="swatch ${color}" data-color="${color}"></span>`)
            .join("")}
        </div>
      </div>
    </div>
    <script>
      document.querySelectorAll(".swatch").forEach((swatch) => {
        swatch.addEventListener("click", () => {
          document.body.setAttribute("data-selected-color", swatch.getAttribute("data-color"));
        });
      });
    </script>
  `;
}
