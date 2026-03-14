# AGENTS.md

This file applies to the entire repository.

## Mission

`particle-life-3d` is a contract-first 3D app. Every meaningful behavior is expected to be:

1. deterministic enough to describe as text, and
2. testable through typed seams instead of UI scraping hacks.

Protect those properties first. Fancy rendering is a feature; reproducible behavior is the platform.

## Runtime Surfaces You Must Preserve

- `hello-world`
  - SQLite (WASM + OPFS) persistence in a dedicated Web Worker.
  - Contract tests validate raw database text after deterministic camera actions.
- `hello-shader-world`
  - GPU simulation with milestone contracts at exact frames.
  - Contract tests validate deterministic shader output text, not pixels.
- `random-walk-world`
  - Deterministic random walk simulation with text contracts at exact millisecond milestones.
  - UI tests enforce input, wheel-step, and clamp behavior.

## Read Order Before Non-Trivial Changes

1. `README.md`
2. `ARCHITECTURE.md`
3. `app/routes.ts`
4. The route + feature + test files for the target surface

## Guardrails

- Keep `app/routes/` modules thin. Put logic in `app/features/3d/` or lower layers.
- UI must never speak directly to the worker. Use `app/db/client-bridge/bridge.ts`.
- Treat `app/db/worker/messages.ts` as the canonical main-thread/worker contract.
- Preserve browser guards around `window`, `localStorage`, `Worker`, OPFS, and related browser-only APIs.
- Keep persisted data scoped by `projectId`; test isolation depends on this.
- Extend typed flows; do not add side channels that bypass the existing architecture.
- Preserve `testMode` query-param gates for test-only globals.

## Safe Change Paths

### Persisted data path (update end-to-end, always)

1. `app/db/types.ts`
2. `app/db/worker/messages.ts`
3. `app/db/client-bridge/bridge.ts`
4. `app/db/worker/worker.ts`
5. `app/db/worker/sqlite-repository.ts`
6. Consuming hook/feature under `app/hooks/` or `app/features/3d/`

### Page or route path

1. Update `app/routes.ts`
2. Add/edit route module in `app/routes/`
3. Keep page composition in `app/features/3d/`

## E2E Contract Runbook

### Baseline verification sequence

```bash
npm run typecheck
npm run test:e2e:hello-world
npm run test:e2e:hello-shader-world
npm run test:e2e:random-walk-world
npm run build
```

### Shader contract focus (fastest relevant pass)

```bash
npm run test:e2e:hello-shader-world
```

What this actually validates:

- route boots in `testMode`,
- shader test APIs are exposed on `window`,
- simulation reset works,
- milestone contracts exactly match fixtures in:
  - `tests/hello-shader-world/contracts/hello-shader-world.frame-000.txt`
  - `tests/hello-shader-world/contracts/hello-shader-world.frame-030.txt`
  - `tests/hello-shader-world/contracts/hello-shader-world.frame-060.txt`
  - `tests/hello-shader-world/contracts/hello-shader-world.frame-090.txt`

### Required query params and globals

- `hello-world`
  - URL params: `?testMode=true&projectId=<id>&seed=<seed>`
  - globals: `__GET_DB_CONTRACT_TEXT__`, `__APPLY_CAMERA_ACTION_FOR_TEST__`, `__DELETE_PROJECT_DATA__`
- `hello-shader-world`
  - URL params: `?testMode=true&seed=<seed>`
  - globals: `__GET_SHADER_CONTRACT_TEXT__`, `__GET_SHADER_FRAME__`, `__RESET_SHADER_SIM_FOR_TEST__`
- `random-walk-world`
  - URL params: `?testMode=true&seed=<seed>`
  - globals: `__GET_RANDOM_WALK_CONTRACT_TEXT__`, `__GET_RANDOM_WALK_FRAME__`, `__RESET_RANDOM_WALK_SIM_FOR_TEST__`

### Milestone constants (do not drift casually)

- `hello-shader-world` frame milestones: `0, 30, 60, 90`
- `random-walk-world` time milestones (ms): `0, 72, 144, 216, 288, 360`

### Fixture update policy

- Only update fixtures when behavior changes are intentional and reviewed.
- Keep raw-text comparisons intact. Do not replace with pixel/image/canvas snapshots.
- Random-walk UI scenario contracts can be regenerated intentionally with:

```bash
UPDATE_RANDOM_WALK_CONTRACTS=1 npm run test:e2e:random-walk-world
```

Then rerun without the env var and confirm green.

## E2E Quirks That Matter

- Playwright is intentionally single-worker (`workers: 1`) to reduce GPU nondeterminism.
- Playwright launches Chromium with SwiftShader flags to keep WebGL available in CI/headless contexts.
- Shader and random-walk tests poll for runtime globals before asserting contracts.
- `hello-shader-world` movement controls live behind the sidebar submenu; tests open via the nav link.
- `hello-world` contract tests require project cleanup via `__DELETE_PROJECT_DATA__` to avoid state bleed.

## Test Invariants (Non-Negotiable)

- `tests/hello-world/hello-world.contract.spec.ts` validates raw DB contract text.
- `tests/hello-shader-world/hello-shader-world.contract.spec.ts` validates deterministic shader text contracts.
- `tests/random-walk-world/random-walk-world.contract.spec.ts` validates deterministic random-walk text contracts.
- Contract assertions are strict text equality unless a test explicitly uses `trimEnd()`.
- If route structure or types change, run `npm run typecheck` (it regenerates route types).

## High-Value Files

- `app/routes.ts`: route tree
- `app/features/3d/hello-world/particle-page.tsx`: hello-world page + DB test API exposure
- `app/features/3d/hello-world/camera-persistence-controls.tsx`: camera restore/persist + test actions
- `app/features/3d/hello-shader-world/hello-shader-world-page.tsx`: shader page + test API wiring
- `app/features/3d/hello-shader-world/hello-shader-world-simulation.ts`: deterministic GPU stepping + milestone capture
- `app/features/3d/hello-shader-world/hello-shader-world-contract.ts`: shader contract text generation
- `app/features/3d/random-walk-world/random-walk-world-page.tsx`: random-walk page + test API wiring
- `app/db/client-bridge/bridge.ts`: browser-to-worker persistence seam
- `app/db/worker/messages.ts`: worker contract types
- `app/db/worker/worker.ts`: request handling and SQLite runtime
- `app/db/worker/sqlite-repository.ts`: schema, migration, deterministic contract text
- `playwright.config.ts`: web server, GPU flags, and runner behavior

## Local Repo Guides

Use when relevant:

- `skills/e2e_implementation.md`: raw DB-text contract testing approach for hello-world
- `skills/create_user_stories_from_repo.md`: repository-based user story extraction workflow
