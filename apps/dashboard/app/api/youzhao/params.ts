import type { YouzhaoApiStatus, YouzhaoQueryInput } from "@dingmap-sync/sources/youzhao";
import type { YouzhaoSessionStatus } from "@dingmap-sync/browser-controller/youzhao-session";

export function pickYouzhaoCollectionParams(input: Record<string, unknown>): YouzhaoQueryInput {
  const params: YouzhaoQueryInput = {};
  if ("city" in input) {
    params.city = input.city;
  }
  if ("page" in input) {
    params.page = input.page;
  }
  if ("pageSize" in input) {
    params.pageSize = input.pageSize;
  }
  if ("limit" in input) {
    params.limit = input.limit;
  }
  return params;
}

export function httpStatusForYouzhaoStatus(status: YouzhaoApiStatus | YouzhaoSessionStatus): number {
  if (status === "success" || status === "authenticated" || status === "opened") {
    return 200;
  }
  if (status === "requires_login") {
    return 401;
  }
  if (status === "forbidden") {
    return 403;
  }
  return 400;
}
