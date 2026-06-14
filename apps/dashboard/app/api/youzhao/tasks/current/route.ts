import { getYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { runtime, taskResponse } from "../shared";

export { runtime };

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const city = url.searchParams.get("city")?.trim() || undefined;
  const modeParam = url.searchParams.get("mode");
  const mode = modeParam === "full" || modeParam === "smoke" ? modeParam : undefined;
  return taskResponse(getYouzhaoCollectionTask(undefined, { city, mode }));
}
