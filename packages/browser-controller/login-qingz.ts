import type { Page } from "playwright";
import type { LoginCheckResult } from "./browser-manager";

export async function ensureQingzLogin(_page: Page): Promise<LoginCheckResult> {
  return {
    ok: false,
    reason: "TODO：第一版仅保留优招登录检测入口，不执行真实登录。",
  };
}
