import ExcelJS from "exceljs";

export const DINGMAP_UPLOAD_MAX_DATA_ROWS = 2_000;

export interface DingmapUploadRowLimitResult {
  allowed: true;
  dataRows: number;
  maxRows: number;
}

export class DingmapUploadRowLimitError extends Error {
  readonly stage = "row-limit";
  readonly dataRows: number;
  readonly maxRows: number;

  constructor(dataRows: number, maxRows = DINGMAP_UPLOAD_MAX_DATA_ROWS) {
    super(`钉图单次导入最多支持 ${maxRows} 条，请分批导入。`);
    this.name = "DingmapUploadRowLimitError";
    this.dataRows = dataRows;
    this.maxRows = maxRows;
  }
}

export async function readDingmapExportDataRowCount(filePath: string): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return 0;
  }

  return Math.max(0, worksheet.actualRowCount - 1);
}

export async function assertDingmapUploadRowLimit(
  filePath: string,
): Promise<DingmapUploadRowLimitResult> {
  const dataRows = await readDingmapExportDataRowCount(filePath);
  if (dataRows > DINGMAP_UPLOAD_MAX_DATA_ROWS) {
    throw new DingmapUploadRowLimitError(dataRows);
  }

  return {
    allowed: true,
    dataRows,
    maxRows: DINGMAP_UPLOAD_MAX_DATA_ROWS,
  };
}
