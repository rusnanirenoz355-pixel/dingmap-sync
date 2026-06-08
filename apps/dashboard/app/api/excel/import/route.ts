import type { RawImportRow } from "../../../../../../packages/sources/import-pipeline";
import { importExcelRows } from "../../../../../../packages/db/excel-import";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { rows?: unknown };
    if (!Array.isArray(body.rows)) {
      return Response.json({ error: "Rows are required." }, { status: 400 });
    }

    return Response.json(importExcelRows(body.rows as RawImportRow[]));
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
