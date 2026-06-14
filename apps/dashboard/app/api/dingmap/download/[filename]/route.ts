import { existsSync, readFileSync } from "node:fs";
import { resolveDingmapExportFilePath } from "../../../../../../../packages/db/dingmap-export";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await context.params;

  try {
    const filePath = resolveDingmapExportFilePath(filename);
    if (!existsSync(filePath)) {
      return Response.json({ error: "导出文件不存在。" }, { status: 404 });
    }

    const file = readFileSync(filePath);
    return new Response(file, {
      headers: {
        "Content-Disposition": buildContentDisposition(filename),
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "下载导出文件失败。",
      },
      { status: 400 },
    );
  }
}

function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
