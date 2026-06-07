import type { ImportPreviewRow } from "@dingmap-sync/shared";
import { importManualPaste } from "../../../../../../packages/db/manual-paste";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { rows?: unknown };
  const rows = Array.isArray(body.rows) ? (body.rows as ImportPreviewRow[]) : [];
  const result = importManualPaste(rows);

  return Response.json(result);
}
