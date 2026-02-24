# E2E Implementation Instructions: DB-Contract Testing for Hello World

## Goal

Implement deterministic, contract-driven end-to-end testing for the current `hello-world` scene using Playwright, validating only database state (plain text contract output), including:

- initial sprite state (one seeded sprite),
- camera persistence state,
- camera action coverage for 10 basic movements.

## Non-Goals

Do **not** implement any of the following:

- frame-loop override or clock override,
- simulation fast-forward/backward sequencing,
- `window.__IS_AWAITING_DB__`,
- canvas screenshot/pixel/baseline comparisons,
- visual snapshot contracts.

## Required Behaviors

1. Tests must be project-isolated via `projectId` so parallel tests do not interfere.
2. App test mode is enabled by URL query params.
3. Test assertions compare deterministic plain-text DB contract output to fixture text.
4. Camera movements are triggered through a deterministic test API path (not flaky UI gestures).
5. Tests wait on real persistence completion (promise-based), not arbitrary sleeps.

---

## Runtime Test Mode and URL Params

Use route URL params:

- `testMode=true|false`
- `projectId=<string>`
- `seed=<string>` (optional now; reserved for deterministic randomness integration)

Recommended route for tests:
- `/hello-world?testMode=true&projectId=<unique>&seed=<value>`

---

## Test API Path (Window Globals)

Expose globals only when `testMode=true`:

- `window.__GET_DB_CONTRACT_TEXT__(projectId?: string, scope?: "all" | "sprites" | "variables"): Promise<string>`
- `window.__APPLY_CAMERA_ACTION_FOR_TEST__(action: CameraAction, projectId?: string): Promise<{ position: [number, number, number]; target: [number, number, number] }>`
- `window.__DELETE_PROJECT_DATA__(projectId?: string): Promise<void>`

`CameraAction` values (10 total):

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

### Contract for `__APPLY_CAMERA_ACTION_FOR_TEST__`

- Applies camera/control movement in deterministic increments.
- Calls persistence through existing DB bridge path.
- Awaits DB persistence completion before returning.
- Returns resulting camera `{position, target}` for optional debugging.

---

## Project Isolation and Persistence Scope

### Requirement

All persisted reads/writes used by tests must be scoped by `projectId`.

### Strategy

- Add `project_id` support for sprite data.
- Scope camera persistence by project without broad risky migration:
  - either `variables.project_id`,
  - or stable scoped variable name convention, e.g. `camera_state::<projectId>`.

Use one approach consistently across bridge/worker/repository.

### Seeded Sprite Behavior

On first load for a given `projectId`, if no sprite exists for that project, seed exactly one sprite at origin.

---

## Exact Contract-Text Formatting Function Spec

Implement DB exporter in worker/repository with deterministic byte-stable output.

### Function

`getProjectContractText(projectId: string, scope: "all" | "sprites" | "variables" = "all"): string`

### Validation Rules

- `projectId` must be non-empty after trimming.
- Throw on malformed/non-finite numeric values.
- Query only rows for this `projectId`.

### Field Normalization Rules

#### Number formatting

- Use `toFixed(6)`.
- Normalize `-0.000000` to `0.000000`.

#### JSON canonicalization

For `metadata` and variable `value`:

- If valid JSON:
  - recursively sort object keys lexicographically,
  - preserve array order,
  - serialize compact (`JSON.stringify` no spaces).
- If not valid JSON:
  - keep raw string unchanged.

#### Field escaping

Apply in order:

- `\` -> `\\`
- `|` -> `\|`
- newline (`\n`) -> `\\n`

### Sorting Rules

#### Sprites section sort key

`(type, xFormatted, yFormatted, zFormatted, metadataCanonicalEscaped)`

#### Variables section sort key

`(nameEscaped, valueCanonicalEscaped)`

### Output Format (LF only, no trailing newline)

If `scope = "all"`:

```txt
[sprites]
count=<N>
0|<type>|<x>|<y>|<z>|<metadata>
1|...

[variables]
count=<M>
0|<name>|<value>
1|...
```

If `scope = "sprites"`: output only `[sprites]` block.  
If `scope = "variables"`: output only `[variables]` block.

### Determinism Constraints

Do **not** include:

- IDs/UUIDs,
- rowid,
- timestamps,
- nondeterministic fields.

Same DB state must produce byte-identical text across runs.

---

## Camera State Coverage Plan (10 Actions)

Use test API path to avoid flaky pointer simulation while still persisting via real DB pipeline.

For each action:

1. call `__APPLY_CAMERA_ACTION_FOR_TEST__(action, projectId)`,
2. call/poll `__GET_DB_CONTRACT_TEXT__(projectId, "all")`,
3. assert exact match against corresponding fixture.

Recommended deterministic increments (implementation constants):

- zoom delta: fixed scalar,
- orbit delta: fixed angle in radians,
- pan delta: fixed world-space amount.

Keep constants stable and shared across implementation/tests.

---

## Playwright Test Suite Plan

### Files

- `playwright.config.ts`
- `tests/hello-world.contract.spec.ts`
- `tests/contracts/hello-world.initial.txt`
- `tests/contracts/hello-world.camera.step-01.txt` ... `step-10.txt` (or a naming variant with action names)

### Test Flow

1. Generate unique `projectId` per test.
2. Navigate to hello-world URL with `testMode=true`.
3. Assert initial contract fixture:
   - one seeded sprite at origin,
   - no camera state row yet (or expected default, based on implementation choice).
4. Execute 10 camera actions in defined order via test API path.
5. After each action, assert full contract equals fixture.
6. Cleanup project data via `__DELETE_PROJECT_DATA__`.

### Synchronization

- Primary: await promises returned by test APIs.
- Secondary safety: `expect.poll` around contract fetch.
- Avoid fixed sleeps (`waitForTimeout`) except temporary debugging.

---

## Playwright-CLI Usage (During Development)

Use `playwright-cli` for manual verification while implementing:

- open route with test params,
- run-code/eval to invoke test globals,
- inspect returned camera state and contract text quickly.

Example workflow:

1. Open page with test mode and project id.
2. Evaluate `window.__GET_DB_CONTRACT_TEXT__(...)`.
3. Apply a camera action via `window.__APPLY_CAMERA_ACTION_FOR_TEST__(...)`.
4. Re-read contract and verify change.
5. Cleanup via `window.__DELETE_PROJECT_DATA__(...)`.

Note: final pass/fail remains in `@playwright/test` specs.

---

## Expected File Touch Points

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
- `package.json` (scripts + playwright dev dependency)

---

## Suggested Scripts

Add npm scripts:

- `test:e2e`: run Playwright tests
- `test:e2e:hello-world`: run only hello-world contract spec

---

## Verification Checklist

1. Typecheck passes.
2. Hello-world e2e contract spec passes locally.
3. Contract output is deterministic between repeated runs.
4. Tests pass with parallel workers due to project isolation.
5. No non-goal mechanisms were introduced (frame override, visual baseline, etc.).

---

## Acceptance Criteria

- Visiting hello-world with `testMode=true` exposes required test globals.
- Initial contract validates one seeded sprite in project scope.
- Camera contract updates persist deterministically for all 10 actions.
- Fixtures are strict-equality matched as plain text.
- Tests are stable and green without arbitrary waits.

---

## Notes on Timing Races

Persistence races are avoided by design when the test API:

- applies a camera action,
- awaits DB persistence completion,
- only then resolves.

This is more reliable than waiting fixed debounce durations.
