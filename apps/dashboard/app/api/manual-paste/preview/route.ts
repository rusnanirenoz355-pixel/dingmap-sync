import { previewManualPaste } from "../../../../../../packages/db/manual-paste";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text : "";
  const result = previewManualPaste(text);

  return Response.json(result);
}
