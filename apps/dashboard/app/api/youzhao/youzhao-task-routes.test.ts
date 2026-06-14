import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkYouzhaoLoginSession, fetchWithYouzhaoSession } from "@dingmap-sync/browser-controller/youzhao-session";
import {
  cancelYouzhaoCollectionTask,
  getYouzhaoCollectionTask,
  pauseYouzhaoCollectionTask,
  restartYouzhaoCollectionTask,
  resumeYouzhaoCollectionTask,
  startYouzhaoCollectionTask,
} from "@dingmap-sync/db/youzhao-collection-task";
import { POST as cancelPost } from "./tasks/cancel/route";
import { GET as currentGet } from "./tasks/current/route";
import { POST as pausePost } from "./tasks/pause/route";
import { POST as restartPost } from "./tasks/restart/route";
import { POST as resumePost } from "./tasks/resume/route";
import { POST as startPost } from "./tasks/start/route";

vi.mock("@dingmap-sync/browser-controller/youzhao-session", () => ({
  checkYouzhaoLoginSession: vi.fn(),
  fetchWithYouzhaoSession: vi.fn(),
}));

vi.mock("@dingmap-sync/db/youzhao-collection-task", () => ({
  cancelYouzhaoCollectionTask: vi.fn(),
  getYouzhaoCollectionTask: vi.fn(),
  pauseYouzhaoCollectionTask: vi.fn(),
  restartYouzhaoCollectionTask: vi.fn(),
  resumeYouzhaoCollectionTask: vi.fn(),
  startYouzhaoCollectionTask: vi.fn(),
}));

const hangzhou = "\u676d\u5dde";

describe("youzhao task API routes", () => {
  beforeEach(() => {
    vi.mocked(checkYouzhaoLoginSession).mockReset();
    vi.mocked(fetchWithYouzhaoSession).mockReset();
    vi.mocked(startYouzhaoCollectionTask).mockReset();
    vi.mocked(pauseYouzhaoCollectionTask).mockReset();
    vi.mocked(resumeYouzhaoCollectionTask).mockReset();
    vi.mocked(cancelYouzhaoCollectionTask).mockReset();
    vi.mocked(restartYouzhaoCollectionTask).mockReset();
    vi.mocked(getYouzhaoCollectionTask).mockReset();
  });

  it("starts a smoke task with fixed smoke boundaries and returns no rows", async () => {
    vi.mocked(startYouzhaoCollectionTask).mockResolvedValue(taskState({ status: "smoke_completed" }));

    const response = await startPost(jsonRequest({ city: hangzhou, mode: "smoke", pageSize: 50, maxPages: 99 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(startYouzhaoCollectionTask).toHaveBeenCalledWith(
      { city: hangzhou, mode: "smoke" },
      expect.objectContaining({
        collectPage: expect.any(Function),
        importRows: expect.any(Function),
      }),
    );
    expect(JSON.stringify(json)).not.toContain("rows");
    expect(JSON.stringify(json)).not.toContain("rawRows");
    expect(JSON.stringify(json)).not.toContain("cleanMarkers");
  });

  it("requires full confirmation fields to be passed through explicitly", async () => {
    vi.mocked(startYouzhaoCollectionTask).mockResolvedValue(
      taskState({ mode: "full", status: "failed", lastErrorStatus: "full_confirmation_required" }),
    );

    const response = await startPost(jsonRequest({ city: hangzhou, mode: "full", confirmed: false, confirmedTotal: 9858 }));
    const json = await response.json() as { status: string; lastErrorStatus?: string };

    expect(response.status).toBe(400);
    expect(json.lastErrorStatus).toBe("full_confirmation_required");
    expect(startYouzhaoCollectionTask).toHaveBeenCalledWith(
      { city: hangzhou, mode: "full", confirmed: false, confirmedTotal: 9858, pageSize: undefined },
      expect.any(Object),
    );
  });

  it("uses session check dependency when resuming", async () => {
    vi.mocked(resumeYouzhaoCollectionTask).mockResolvedValue(taskState({ status: "requires_login", nextPage: 2 }));

    const response = await resumePost(jsonRequest({ city: hangzhou }));

    expect(response.status).toBe(401);
    expect(resumeYouzhaoCollectionTask).toHaveBeenCalledWith(
      hangzhou,
      expect.objectContaining({
        collectPage: expect.any(Function),
        importRows: expect.any(Function),
        sessionCheck: expect.any(Function),
      }),
    );
  });

  it("routes pause cancel restart and current without business data", async () => {
    vi.mocked(pauseYouzhaoCollectionTask).mockReturnValue(taskState({ status: "running" }));
    vi.mocked(cancelYouzhaoCollectionTask).mockReturnValue(taskState({ status: "running" }));
    vi.mocked(restartYouzhaoCollectionTask).mockReturnValue(taskState({ status: "idle" }));
    vi.mocked(getYouzhaoCollectionTask).mockReturnValue(taskState({ status: "smoke_completed" }));

    const pause = await pausePost(jsonRequest({ city: hangzhou }));
    const cancel = await cancelPost(jsonRequest({ city: hangzhou }));
    const restart = await restartPost(jsonRequest({ city: hangzhou, confirmed: true }));
    const current = await currentGet();
    const serialized = JSON.stringify([
      await pause.json(),
      await cancel.json(),
      await restart.json(),
      await current.json(),
    ]);

    expect(pause.status).toBe(200);
    expect(cancel.status).toBe(200);
    expect(restart.status).toBe(200);
    expect(current.status).toBe(200);
    expect(restartYouzhaoCollectionTask).toHaveBeenCalledWith(hangzhou, { confirmed: true });
    expect(serialized).not.toContain("Synthetic Site");
    expect(serialized).not.toContain("19900000000");
    expect(serialized).not.toContain("rawRows");
    expect(serialized).not.toContain("cleanMarkers");
  });
});

function taskState(overrides: Record<string, unknown> = {}) {
  return {
    city: hangzhou,
    mode: "smoke",
    status: "running",
    currentPage: 1,
    nextPage: 1,
    pageSize: 20,
    maxPages: 2,
    maxItems: 40,
    processedPages: 0,
    processedItems: 0,
    totalFromApi: null,
    counts: {
      imported: 0,
      duplicate: 0,
      update_candidate: 0,
      invalid: 0,
      filteredNonRecruiting: 0,
    },
    targetLayerCounts: {},
    failedPages: [],
    ...overrides,
  } as never;
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/youzhao/tasks", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
