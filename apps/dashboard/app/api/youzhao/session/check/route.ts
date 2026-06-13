import { checkYouzhaoLoginSession, fetchWithYouzhaoSession } from "@dingmap-sync/browser-controller/youzhao-session";
import { httpStatusForYouzhaoStatus } from "../../params";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  void request;
  try {
    const result = await checkYouzhaoLoginSession(
      {},
      { fetchImpl: fetchWithYouzhaoSession },
    );
    return Response.json(result, { status: httpStatusForYouzhaoStatus(result.status) });
  } catch (error) {
    return Response.json(
      {
        status: "failed",
        authenticated: false,
        error: error instanceof Error ? error.message : "检查优招登录状态失败。",
      },
      { status: 400 },
    );
  }
}
