import {
  CleanMarkerManagementError,
  softDeleteCleanMarker,
  updateManagedCleanMarker,
} from "../../../../../../packages/db/clean-marker-management";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const markerId = await parseMarkerId(context);
    const body = (await request.json()) as Record<string, unknown>;
    return Response.json({
      marker: updateManagedCleanMarker(markerId, body),
    });
  } catch (error) {
    return handleManagementError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const markerId = await parseMarkerId(context);
    return Response.json({
      marker: softDeleteCleanMarker(markerId),
    });
  } catch (error) {
    return handleManagementError(error);
  }
}

async function parseMarkerId(context: RouteContext): Promise<number> {
  const { id } = await context.params;
  const markerId = Number(id);
  if (!Number.isInteger(markerId) || markerId <= 0) {
    throw new CleanMarkerManagementError("Clean Marker ID 无效。", 400);
  }
  return markerId;
}

function handleManagementError(error: unknown): Response {
  if (error instanceof CleanMarkerManagementError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Clean Marker 管理操作失败。" }, { status: 500 });
}
