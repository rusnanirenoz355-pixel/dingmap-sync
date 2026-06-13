import { openYouzhaoLoginSession } from "@dingmap-sync/browser-controller/youzhao-session";
import { httpStatusForYouzhaoStatus } from "../../params";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const result = await openYouzhaoLoginSession();
    return Response.json(result, { status: httpStatusForYouzhaoStatus(result.status) });
  } catch (error) {
    return Response.json(
      {
        status: "failed",
        authenticated: false,
        error: error instanceof Error ? error.message : "打开优招登录窗口失败。",
      },
      { status: 400 },
    );
  }
}
