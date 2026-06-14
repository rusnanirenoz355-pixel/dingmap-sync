import { pauseYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { readJsonBody, requireCity, runtime, taskErrorResponse, taskResponse } from "../shared";

export { runtime };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    return taskResponse(pauseYouzhaoCollectionTask(requireCity(body)));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
