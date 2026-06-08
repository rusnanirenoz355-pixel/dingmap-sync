import { getDingmapUploadStatus } from "../../../../../../../packages/db/dingmap-upload-job";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json(getDingmapUploadStatus());
}
