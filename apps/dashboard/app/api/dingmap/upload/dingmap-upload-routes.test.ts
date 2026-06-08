import { describe, expect, it } from "vitest";
import { POST as continuePost } from "./continue/route";
import { POST as uploadPost } from "./route";
import { GET as statusGet } from "./status/route";

describe("dingmap upload API routes", () => {
  it("rejects export filenames that include path traversal", async () => {
    const response = await uploadPost(
      new Request("http://localhost/api/dingmap/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "../dingmap-import-20260608-093000.xlsx" }),
      }),
    );
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("导出文件名无效");
  });

  it("returns current status and recent export metadata", async () => {
    const response = await statusGet();
    const json = (await response.json()) as {
      job: unknown;
      recentExports: unknown;
    };

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("job");
    expect(Array.isArray(json.recentExports)).toBe(true);
  });

  it("does not continue when there is no login-waiting upload job", async () => {
    const response = await continuePost();
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("没有可继续的钉图上传任务");
  });
});
