import { listYouzhaoExportCities } from "@dingmap-sync/db/youzhao-dingmap-export";

export const runtime = "nodejs";

export function GET(): Response {
  try {
    return Response.json({ cities: listYouzhaoExportCities() });
  } catch (error) {
    return Response.json(
      {
        cities: [],
        error: error instanceof Error ? error.message : "读取优招导出城市失败。",
      },
      { status: 500 },
    );
  }
}
