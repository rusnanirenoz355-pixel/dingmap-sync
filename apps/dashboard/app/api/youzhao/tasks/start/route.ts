import { startYouzhaoCollectionTask, type YouzhaoCollectionTaskInput } from "@dingmap-sync/db/youzhao-collection-task";
import { readJsonBody, runtime, taskDependencies, taskErrorResponse, taskResponse } from "../shared";

export { runtime };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    const mode = body.mode === "full" ? "full" : "smoke";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const input: YouzhaoCollectionTaskInput = mode === "smoke"
      ? { city, mode }
      : {
          city,
          mode,
          confirmed: body.confirmed === true,
          confirmedTotal: typeof body.confirmedTotal === "number" ? body.confirmedTotal : undefined,
          pageSize: typeof body.pageSize === "number" ? body.pageSize : undefined,
        };
    return taskResponse(await startYouzhaoCollectionTask(input, taskDependencies()));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
