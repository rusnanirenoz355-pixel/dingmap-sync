import { listCleanMarkers } from "../../../../../packages/db/manual-paste";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json({
    cleanMarkers: listCleanMarkers(),
  });
}
