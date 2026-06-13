import {
  YouzhaoValidationError,
  probeYouzhaoPositions,
  type YouzhaoApiStatus,
} from "../../../../../../packages/sources/youzhao/client";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await probeYouzhaoPositions(body, {
      headers: buildForwardHeaders(request),
    });
    return Response.json(result, { status: httpStatusForYouzhaoStatus(result.status) });
  } catch (error) {
    return Response.json(
      {
        status: error instanceof YouzhaoValidationError ? error.status : "failed",
        error: error instanceof Error ? error.message : "优招接口探测失败。",
      },
      { status: 400 },
    );
  }
}

function buildForwardHeaders(request: Request): HeadersInit {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  const authorization = request.headers.get("authorization");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return headers;
}

function httpStatusForYouzhaoStatus(status: YouzhaoApiStatus): number {
  if (status === "success") {
    return 200;
  }
  if (status === "requires_login") {
    return 401;
  }
  if (status === "forbidden") {
    return 403;
  }
  return 400;
}
