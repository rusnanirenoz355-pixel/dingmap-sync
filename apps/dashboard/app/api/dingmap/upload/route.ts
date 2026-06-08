import { createDingmapUploadJob } from "../../../../../../packages/db/dingmap-upload-job";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      filename?: unknown;
      timeoutMs?: unknown;
    };
    const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : undefined;
    const timeoutMs =
      typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs)
        ? body.timeoutMs
        : undefined;

    return Response.json({
      job: createDingmapUploadJob({
        filename,
        timeoutMs,
      }),
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "创建钉图上传任务失败。",
      },
      { status: 400 },
    );
  }
}
