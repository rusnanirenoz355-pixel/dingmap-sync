import { continueDingmapUploadJob } from "../../../../../../../packages/db/dingmap-upload-job";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    return Response.json({
      job: continueDingmapUploadJob(),
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "继续钉图上传任务失败。",
      },
      { status: 400 },
    );
  }
}
