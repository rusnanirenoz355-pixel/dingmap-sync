import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { clickDataImportMenuItem, clickLayerMoreButtonForLayer } from "./dingmap-upload";

describe("DingMap layer more button targeting", () => {
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

  it("clicks the more button on the requested layer row", async () => {
    await page.setContent(`
      <!doctype html>
      <style>
        .row { display: flex; align-items: center; gap: 20px; height: 48px; }
      </style>
      <aside>
        <h2>图层列表</h2>
        ${["其他点", "商超点", "淘宝点", "美团点", "买菜点", "面试点"]
          .map(
            (layer) => `
              <div class="row">
                <span class="name">${layer}</span>
                <button type="button">数据列表(0)</button>
                <button type="button">分享</button>
                <button type="button" data-layer="${layer}">更多</button>
              </div>
            `,
          )
          .join("")}
      </aside>
      <script>
        document.querySelectorAll("[data-layer]").forEach((button) => {
          button.addEventListener("click", () => {
            document.body.setAttribute("data-clicked-layer", button.getAttribute("data-layer"));
          });
        });
      </script>
    `);

    const clicked = await clickLayerMoreButtonForLayer(page, "美团点");

    expect(clicked).toBe(true);
    await expect(page.locator("body").getAttribute("data-clicked-layer")).resolves.toBe("美团点");
  });

  it("clicks a visible data import menu item even when it is plain menu text", async () => {
    await page.setContent(`
      <!doctype html>
      <div role="menu">
        <div role="menuitem">设为默认</div>
        <div role="menuitem" data-action="import">数据导入</div>
        <div role="menuitem">数据导出</div>
      </div>
      <script>
        document.querySelector("[data-action='import']").addEventListener("click", () => {
          document.body.setAttribute("data-import-menu-clicked", "true");
        });
      </script>
    `);

    const clicked = await clickDataImportMenuItem(page);

    expect(clicked).toBe(true);
    await expect(page.locator("body").getAttribute("data-import-menu-clicked")).resolves.toBe("true");
  });
});
