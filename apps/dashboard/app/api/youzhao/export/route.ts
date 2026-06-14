import { exportYouzhaoDingmapTemplates } from "@dingmap-sync/db/youzhao-dingmap-export";
import { getYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const city = typeof body.city === "string" ? body.city : "";
    if (!city.trim()) {
      return Response.json({ error: "必须选择一个城市后再导出。" }, { status: 400 });
    }

    const partial = body.partial === true;
    const isAllCities = city.trim().toLowerCase() === "all";
    if (!partial && !isAllCities) {
      const task = getYouzhaoCollectionTask(undefined, { city: city.trim(), mode: "full" });
      if (task.mode !== "full" || task.status !== "completed" || task.countConsistencyPassed !== true) {
        return Response.json(
          {
            error: "complete full export requires a completed full task with passing count consistency",
            status: task.status,
          },
          { status: 400 },
        );
      }
    }

    const result = await exportYouzhaoDingmapTemplates(
      partial
        ? { city, targetLayer: body.targetLayer, partial: true }
        : { city, targetLayer: body.targetLayer },
    );
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "优招钉图模板导出失败。",
      },
      { status: 400 },
    );
  }
}
