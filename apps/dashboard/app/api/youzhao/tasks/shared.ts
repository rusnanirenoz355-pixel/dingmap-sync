import { checkYouzhaoLoginSession, fetchWithYouzhaoSession } from "@dingmap-sync/browser-controller/youzhao-session";
import {
  type YouzhaoCollectionTaskDependencies,
  type YouzhaoCollectionTaskState,
} from "@dingmap-sync/db/youzhao-collection-task";
import { importCleanMarkers } from "@dingmap-sync/db/import-clean-markers";
import { previewYouzhaoPositionsForImport } from "@dingmap-sync/db/youzhao-import";

export const runtime = "nodejs";

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => ({}));
  return isRecord(body) ? body : {};
}

export function requireCity(body: Record<string, unknown>): string {
  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city) {
    throw new Error("city is required");
  }
  return city;
}

export function taskDependencies(): YouzhaoCollectionTaskDependencies {
  return {
    collectPage: async ({ city, page, pageSize, limit }) => {
      const result = await previewYouzhaoPositionsForImport(
        { city, page, pageSize, limit },
        { fetchImpl: fetchWithYouzhaoSession },
      );
      return {
        status: result.status,
        total: result.total,
        rawRows: result.rawRows,
        rows: result.rows,
        filteredNonRecruiting: result.filteredNonRecruiting,
      };
    },
    importRows: async (rows, options) => importCleanMarkers(rows, options),
    sessionCheck: async () => {
      const result = await checkYouzhaoLoginSession(
        {},
        { fetchImpl: fetchWithYouzhaoSession },
      );
      return result.status;
    },
  };
}

export function taskResponse(state: YouzhaoCollectionTaskState): Response {
  return Response.json(state, { status: httpStatusForTaskStatus(state.status) });
}

export function taskErrorResponse(error: unknown): Response {
  return Response.json(
    {
      status: "failed",
      error: error instanceof Error ? error.message : "youzhao task failed",
    },
    { status: 400 },
  );
}

function httpStatusForTaskStatus(status: YouzhaoCollectionTaskState["status"]): number {
  if (status === "requires_login") {
    return 401;
  }
  if (status === "forbidden") {
    return 403;
  }
  if (
    status === "failed" ||
    status === "blocked" ||
    status === "schema_changed" ||
    status === "timeout" ||
    status === "count_mismatch"
  ) {
    return 400;
  }
  return 200;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
