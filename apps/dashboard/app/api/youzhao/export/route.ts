import { exportYouzhaoDingmapTemplates } from "@dingmap-sync/db/youzhao-dingmap-export";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const city = typeof body.city === "string" ? body.city : "";
    if (!city.trim()) {
      return Response.json({ error: "必须选择一个城市后再导出。" }, { status: 400 });
    }

    const result = await exportYouzhaoDingmapTemplates(
      body.partial === true ? { city, partial: true } : { city },
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
