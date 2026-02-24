# E2E Implementation Instructions: Raw DB-Text Contract Testing (Hello World)

## Goal

Implement Playwright end-to-end testing for the current `hello-world` scene using only database text contracts.

The test suite must validate:

- one seeded sprite in DB,
- persisted camera state in DB,
- the 10 basic camera actions.

## Hard Rules

- Do not implement frame-loop overrides, clock overrides, or fast-forward/backward simulation.
- Do not use `window.__IS_AWAITING_DB__`.
- Do not add canvas/image/pixel/snapshot assertions.
- Do not add response-shaping, parsing, normalization, or validation logic for DB contract text.
- Treat DB text as the source of truth: fetch text, save fixture text, compare text directly.

## Core Approach

1. Run app in `testMode` using URL params.
2. Use project-scoped data (`projectId`) for isolation.
3. Expose test APIs on `window`.
4. For each test step:
   - call test API,
   - get raw DB contract text,
   - compare it directly to fixture text.

No extra handling of DB response content.

---

## Runtime Params

Use query params:

- `testMode=true`
- `projectId=<unique-id>`
- `seed=<string>` (optional)

Test URL example:

`/hello-world?testMode=true&projectId=<unique-id>&seed=hello`

---

## Required Test APIs (Window Globals)

Expose only when `testMode=true`:

- `window.__GET_DB_CONTRACT_TEXT__(projectId?: string): Promise<string>`
- `window.__APPLY_CAMERA_ACTION_FOR_TEST__(action: CameraAction, projectId?: string): Promise<void>`
- `window.__DELETE_PROJECT_DATA__(projectId?: string): Promise<void>`

`CameraAction` values:

1. `zoom_in`
2. `zoom_out`
3. `orbit_left`
4. `orbit_right`
5. `orbit_up`
6. `orbit_down`
7. `pan_left`
8. `pan_right`
9. `pan_up`
10. `pan_down`

Notes:

- `__APPLY_CAMERA_ACTION_FOR_TEST__` must persist through the real DB pipeline and resolve only after persistence completes.
- `__GET_DB_CONTRACT_TEXT__` must return DB text as-is, with no post-processing.

---

## Project Isolation

All reads/writes used by e2e must be scoped by `projectId`.

Implementation options (pick one and use consistently):

- add `project_id` columns and query filters,
- or keep schema and scope keys/names by `projectId`.

Expected behavior:

- each test project is isolated,
- one default sprite is seeded per new project,
- camera state is scoped per project.

---

## Raw Contract Text Requirement

The database layer must provide one plain-text contract string representing project state.

Important:

- do not parse/normalize/canonicalize the text in app test APIs,
- do not transform text in Playwright assertions,
- do not “handle” DB response beyond awaiting and returning the raw text string.

Test behavior:

- read raw text,
- save raw text to fixture,
- assert raw text equals fixture text.

---

## Playwright Suite Plan

### Files

- `playwright.config.ts`
- `tests/hello-world.contract.spec.ts`
- `tests/contracts/hello-world.initial.txt`
- `tests/contracts/hello-world.camera.step-01.txt` ... `tests/contracts/hello-world.camera.step-10.txt`

### Test flow

1. Create unique `projectId`.
2. Open hello-world in test mode.
3. Fetch raw DB contract text and assert against initial fixture.
4. Execute 10 camera actions in order via `__APPLY_CAMERA_ACTION_FOR_TEST__`.
5. After each action, fetch raw DB contract text and assert against matching fixture.
6. Cleanup project data.

### Assertion style

- Strict string equality only.
- No JSON conversion.
- No row parsing.
- No custom normalization.

---

## Timing and Synchronization

- Use promise-based synchronization from test APIs.
- `__APPLY_CAMERA_ACTION_FOR_TEST__` resolves after DB write is complete.
- Tests may use `expect.poll` for robustness, but still compare raw text only.
- Avoid fixed sleep timers as primary sync.

---

## Playwright-CLI Usage

Use `playwright-cli` during implementation for quick manual checks:

1. open test URL,
2. call `window.__GET_DB_CONTRACT_TEXT__` via `run-code`,
3. call `window.__APPLY_CAMERA_ACTION_FOR_TEST__`,
4. read DB text again,
5. copy raw text into fixture when needed.

Final verification still comes from `@playwright/test`.

---

## Expected Files to Update

- `app/features/3d/particle-page.tsx`
- `app/features/3d/camera-persistence-controls.tsx`
- `app/hooks/use-sprites.ts`
- `app/db/client-bridge/bridge.ts`
- `app/db/worker/messages.ts`
- `app/db/worker/worker.ts`
- `app/db/worker/sqlite-repository.ts`
- `playwright.config.ts`
- `tests/hello-world.contract.spec.ts`
- `tests/contracts/*`
- `package.json`

---

## Scripts

Add scripts:

- `test:e2e`
- `test:e2e:hello-world`

---

## Acceptance Criteria

- Hello-world in `testMode` exposes required test APIs.
- DB contract text is fetched as raw text.
- Fixture text is raw saved DB text.
- Tests compare raw DB text to fixture text directly.
- One sprite and camera-state coverage for all 10 actions are validated.
- Tests pass reliably with project isolation.
