import { getYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { runtime, taskResponse } from "../shared";

export { runtime };

export async function GET(): Promise<Response> {
  return taskResponse(getYouzhaoCollectionTask());
}
