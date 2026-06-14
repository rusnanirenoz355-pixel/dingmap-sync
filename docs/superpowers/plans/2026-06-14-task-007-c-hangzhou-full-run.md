# Task 007-C Hangzhou Full Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded single-city full collection support for Hangzhou with independent full checkpoints, Dashboard confirmation, export gating, and no automatic full execution.

**Architecture:** Extend the existing `youzhao-collection-task` service rather than creating a second runner. The service keeps smoke and full checkpoint files separate, tasks API accepts explicit full confirmations only, Dashboard fetches a fresh API total before full start, and full export is gated on a completed full task state.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, SQLite-backed import services, existing DingMap Excel writer.

---

### Task 1: Full Checkpoint Separation

**Files:**
- Modify: `packages/db/youzhao-collection-task.ts`
- Modify test: `packages/db/youzhao-collection-task.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving that smoke and full checkpoint paths differ, full starts from page 1 even after smoke, and full does not reuse smoke processed hashes.

- [ ] **Step 2: Run the test**

Run: `corepack pnpm test -- packages/db/youzhao-collection-task.test.ts`

- [ ] **Step 3: Implement checkpoint keying**

Add mode-aware checkpoint filenames: smoke uses `<safe-city>.json`; full uses `<safe-city>.full.json`.

- [ ] **Step 4: Re-run the test**

Run: `corepack pnpm test -- packages/db/youzhao-collection-task.test.ts`

### Task 2: Full Start Confirmation And Live Total

**Files:**
- Modify: `packages/db/youzhao-collection-task.ts`
- Modify: `apps/dashboard/app/api/youzhao/tasks/start/route.ts`
- Modify test: `apps/dashboard/app/api/youzhao/youzhao-task-routes.test.ts`
- Modify: `apps/dashboard/app/page.tsx`
- Modify test: `apps/dashboard/app/dashboard-youzhao-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Add route/UI tests proving full start receives `confirmedTotal`, `totalPages`, `pageSize=50`, and Dashboard contains the explicit confirmation summary text.

- [ ] **Step 2: Run focused tests**

Run: `corepack pnpm test -- apps/dashboard/app/api/youzhao/youzhao-task-routes.test.ts apps/dashboard/app/dashboard-youzhao-ui.test.ts`

- [ ] **Step 3: Implement live total probe before full**

Dashboard calls `POST /api/youzhao/probe` with `city=杭州`, `page=1`, `pageSize=50`, `limit=20`, then displays the confirmation text and only starts full after the user confirms.

- [ ] **Step 4: Re-run focused tests**

Run: `corepack pnpm test -- apps/dashboard/app/api/youzhao/youzhao-task-routes.test.ts apps/dashboard/app/dashboard-youzhao-ui.test.ts`

### Task 3: Current Task Query And Export Gate

**Files:**
- Modify: `packages/db/youzhao-collection-task.ts`
- Modify: `apps/dashboard/app/api/youzhao/tasks/current/route.ts`
- Modify: `apps/dashboard/app/api/youzhao/export/route.ts`
- Modify test: `apps/dashboard/app/api/youzhao/youzhao-export-routes.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `current?city=杭州` can load the full checkpoint and complete export is rejected unless `mode=full`, `status=completed`, and count consistency passed.

- [ ] **Step 2: Run focused tests**

Run: `corepack pnpm test -- packages/db/youzhao-collection-task.test.ts apps/dashboard/app/api/youzhao/youzhao-export-routes.test.ts`

- [ ] **Step 3: Implement current lookup and export gate**

Allow current route to accept city/mode query and gate non-partial exports by a completed full state.

- [ ] **Step 4: Re-run focused tests**

Run: `corepack pnpm test -- packages/db/youzhao-collection-task.test.ts apps/dashboard/app/api/youzhao/youzhao-export-routes.test.ts`

### Task 4: Verification And Manual Full Gate

**Files:**
- Modify: `docs/dev-log.md`
- Modify: `docs/task-cards/007-youzhao-collector.md`
- Modify: `docs/github-issues/task-007-issue.md`

- [ ] **Step 1: Run full verification**

Run: `corepack pnpm verify`

- [ ] **Step 2: Stop for Dashboard confirmation**

Do not call full start directly. Ask the user to click the Dashboard confirmation button.

- [ ] **Step 3: After user confirms, observe task current status**

Poll `GET /api/youzhao/tasks/current?city=杭州&mode=full` and report counts only.

- [ ] **Step 4: If full completed, run complete export**

Call the existing export route without `partial`; report filenames and counts only.
