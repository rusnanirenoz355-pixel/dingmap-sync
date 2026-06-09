import { exportDingmapOneClickTemplate } from "../../../../../../packages/db/dingmap-export";
import { resolveDingmapPlatform } from "../../../../../../packages/browser-controller/dingmap-platforms";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      platform?: unknown;
      exportName?: unknown;
    };
    const platform = resolveDingmapPlatform(body.platform);
    const exportName =
      typeof body.exportName === "string" && body.exportName.trim()
        ? body.exportName.trim()
        : undefined;
    const result = await exportDingmapOneClickTemplate({
      platformLabel: platform.label,
      exportName,
    });
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
