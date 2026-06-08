import { previewExcelImportBuffer } from "../../../../../../packages/db/excel-import";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sheetNameValue = formData.get("sheetName");

    if (!(file instanceof File)) {
      return Response.json({ error: "Missing Excel file." }, { status: 400 });
    }

    const filename = sanitizeExcelFilename(file.name);
    const sheetName = typeof sheetNameValue === "string" && sheetNameValue.trim() ? sheetNameValue : undefined;
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await previewExcelImportBuffer(buffer, {
      filename,
      sheetName,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function sanitizeExcelFilename(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!basename.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported.");
  }
  if (!/^[^<>:"|?*]+\.xlsx$/i.test(basename)) {
    throw new Error("Excel filename is invalid.");
  }
  return basename;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
