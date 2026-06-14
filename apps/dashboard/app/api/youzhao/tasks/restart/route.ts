import { restartYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { readJsonBody, requireCity, runtime, taskErrorResponse, taskResponse } from "../shared";

export { runtime };

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonBody(request);
    return taskResponse(
      restartYouzhaoCollectionTask(requireCity(body), {
        confirmed: body.confirmed === true,
      }),
    );
  } catch (error) {
    return taskErrorResponse(error);
  }
}
