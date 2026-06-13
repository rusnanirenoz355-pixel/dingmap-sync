import { fetchWithYouzhaoSession } from "@dingmap-sync/browser-controller/youzhao-session";
import { importYouzhaoPositions } from "@dingmap-sync/db/youzhao-import";
import { YouzhaoValidationError } from "@dingmap-sync/sources/youzhao";
import { httpStatusForYouzhaoStatus, pickYouzhaoCollectionParams } from "../params";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await importYouzhaoPositions(
      pickYouzhaoCollectionParams(body),
      { fetchImpl: fetchWithYouzhaoSession },
    );
    return Response.json(result, { status: httpStatusForYouzhaoStatus(result.status) });
  } catch (error) {
    return Response.json(
      {
        status: error instanceof YouzhaoValidationError ? error.status : "failed",
        error: error instanceof Error ? error.message : "优招导入失败。",
      },
      { status: 400 },
    );
  }
}
