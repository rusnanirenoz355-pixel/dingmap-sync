import { resetDingmapUploadJob } from "../../../../../../../packages/db/dingmap-upload-job";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    return Response.json(resetDingmapUploadJob());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "重置钉图上传任务失败。",
      },
      { status: 400 },
    );
  }
}
