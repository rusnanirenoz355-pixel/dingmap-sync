import { exportDingmapOneClickTemplate } from "../../../../../../packages/db/dingmap-export";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const result = await exportDingmapOneClickTemplate();
    const { filePath: _filePath, ...payload } = result;
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "导出钉图模板失败。",
      },
      { status: 400 },
    );
  }
}
