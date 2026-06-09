import { openDingmapAutomationBrowser } from "../../../../../../packages/db/dingmap-upload-job";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    return Response.json(await openDingmapAutomationBrowser());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "打开自动化 Chrome 失败。",
      },
      { status: 400 },
    );
  }
}
