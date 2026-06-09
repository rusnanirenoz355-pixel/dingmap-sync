import { readFileSync, statSync } from "node:fs";
import { resolveExistingDingmapExportFilePath } from "../../../../../../../packages/db/dingmap-export";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename: encodedFilename } = await context.params;

  try {
    const filename = decodeURIComponent(encodedFilename);
    const filePath = resolveExistingDingmapExportFilePath(filename);
    const fileStat = statSync(filePath);
    const file = readFileSync(filePath);
    return new Response(file, {
      headers: {
        "Content-Disposition": buildContentDisposition(filename),
        "Content-Length": String(fileStat.size),
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载导出文件失败。";
    if (message.includes("不存在")) {
      return Response.json({ error: "导出文件不存在。" }, { status: 404 });
    }

    return Response.json(
      {
        error: message,
      },
      { status: 400 },
    );
  }
}

function buildContentDisposition(filename: string): string {
  return `attachment; filename="dingmap-import.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
