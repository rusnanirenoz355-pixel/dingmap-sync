import { resumeYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { readJsonBody, requireCity, runtime, taskDependencies, taskErrorResponse, taskResponse } from "../shared";

export { runtime };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    return taskResponse(await resumeYouzhaoCollectionTask(requireCity(body), taskDependencies()));
  } catch (error) {
    return taskErrorResponse(error);
  }
}
