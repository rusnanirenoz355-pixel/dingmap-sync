import { listManagedCleanMarkers } from "../../../../../../packages/db/clean-marker-management";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  return Response.json(
    listManagedCleanMarkers({
      page: parseNumberParam(url.searchParams.get("page")),
      pageSize: parseNumberParam(url.searchParams.get("pageSize")),
      search: url.searchParams.get("search") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      anomalyOnly: url.searchParams.get("anomalyOnly") === "true",
      includeDeleted: url.searchParams.get("includeDeleted") === "true",
      deletedOnly: url.searchParams.get("deletedOnly") === "true",
    }),
  );
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
