import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserManagerOptions {
  headless?: boolean;
  storageStatePath?: string;
}

export interface ManagedBrowser {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function openManagedBrowser(options: BrowserManagerOptions = {}): Promise<ManagedBrowser> {
  const headless = options.headless ?? process.env.PLAYWRIGHT_HEADLESS === "true";
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(
    options.storageStatePath ? { storageState: options.storageStatePath } : {},
  );
  const page = await context.newPage();

  return { browser, context, page };
}

export interface LoginCheckResult {
  ok: boolean;
  reason?: string;
}
