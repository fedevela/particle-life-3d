# AGENTS.md

This file applies to the entire repository.

## Core Mission: Deterministic GPU-in-E2E

`particle-life-3d` is contract-first. The key guarantee is not visual polish; it is deterministic behavior captured as text and enforced in tests.

The reference pattern is `hello-shader-world`: GPU state is stepped in WebGL, read back, serialized into stable text, and asserted against committed fixtures in Playwright. That loop is the platform.

## Canonical Deterministic Loop (`hello-shader-world`)

1. `app/routes/hello-shader-world.tsx` stays thin and only mounts the feature page.
2. `app/features/3d/hello-shader-world/hello-shader-world-page.tsx` resolves `testMode` + `seed` and exposes test APIs on `window` only in `testMode`.
3. `app/features/3d/hello-shader-world/hello-shader-world-scene.tsx` owns the WebGL scene and simulation lifecycle.
4. `app/features/3d/hello-shader-world/hello-shader-world-simulation.ts` steps GPU state with `GPUComputationRenderer` and captures milestone snapshots via `readRenderTargetPixels`.
5. `app/features/3d/hello-shader-world/hello-shader-world-contract.ts` converts readback buffers into deterministic contract text with stable checksums.
6. `tests/hello-shader-world/hello-shader-world.contract.spec.ts` reads that text through test globals and compares exact output to fixture text files.

Important clarification: app runtime does not write fixture files. Tests compare runtime-generated text with committed files under `tests/.../contracts/`.

## Runtime Surfaces You Must Preserve

- `hello-world`
  - SQLite (WASM + OPFS) persistence in a dedicated Web Worker.
  - Contract tests validate raw DB text after deterministic camera actions.
- `hello-shader-world`
  - GPU simulation with milestone text contracts at exact frames.
  - E2E validates GPU-derived text, not pixels.
- `random-walk-world`
  - Deterministic simulation with text contracts at exact millisecond milestones.
  - UI tests enforce input behavior, wheel-step behavior, clamp behavior, and camera continuity.

## Read Order Before Non-Trivial Changes

1. `README.md`
2. `app/routes.ts`
3. Route + feature + test files for the target surface
4. If touching GPU determinism, always read:
   - `app/routes/hello-shader-world.tsx`
   - `app/features/3d/hello-shader-world/hello-shader-world-page.tsx`
   - `app/features/3d/hello-shader-world/hello-shader-world-scene.tsx`
   - `app/features/3d/hello-shader-world/hello-shader-world-simulation.ts`
   - `app/features/3d/hello-shader-world/hello-shader-world-contract.ts`
   - `tests/hello-shader-world/hello-shader-world.contract.spec.ts`

## Guardrails

- Keep `app/routes/` modules thin; place behavior in `app/features/3d/` or lower layers.
- Preserve `testMode` query-param gates and test globals; these are deterministic seams, not test hacks.
- Never replace text contracts with image/pixel snapshots.
- Keep browser guards around `window`, `localStorage`, `Worker`, OPFS, and other browser-only APIs.
- UI must never call DB worker internals directly; use `app/db/client-bridge/bridge.ts`.
- Treat `app/db/worker/messages.ts` as the canonical main-thread/worker contract.
- Keep persisted data scoped by `projectId` to preserve test isolation.
- Extend typed seams; do not add side channels that bypass existing architecture.

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

### Fast GPU contract verification

```bash
npm run test:e2e:hello-shader-world
```

What this validates:

- route boots in `testMode`,
- shader test globals exist on `window`,
- simulation reset works,
- GPU milestone contracts match fixtures exactly:
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
  - globals: `__GET_RANDOM_WALK_CONTRACT_TEXT__`, `__GET_RANDOM_WALK_FRAME__`, `__RESET_RANDOM_WALK_SIM_FOR_TEST__`, `__GET_RANDOM_WALK_CAMERA_STATE__`

### Milestone constants (do not drift casually)

- `hello-shader-world` frame milestones: `0, 30, 60, 90`
- `random-walk-world` time milestones (ms): `0, 72, 144, 216, 288, 360`

### Fixture update policy

- Update fixtures only for intentional behavior changes and review the diff.
- Keep strict raw-text assertions unless a test explicitly allows `trimEnd()`.
- Do not relax deterministic contracts to “visual looks right.”
- Random-walk UI scenario contracts can be regenerated intentionally with:

```bash
UPDATE_RANDOM_WALK_CONTRACTS=1 npm run test:e2e:random-walk-world
```

Then rerun without the env var and confirm green.

## E2E Quirks That Matter

- Playwright uses `workers: 1` to reduce GPU nondeterminism.
- Playwright launches Chromium with SwiftShader flags for headless WebGL availability.
- Shader and random-walk suites poll for runtime globals before assertions.
- `hello-shader-world` controls are behind the sidebar submenu; tests open via nav.
- `hello-world` contracts require `__DELETE_PROJECT_DATA__` cleanup to prevent state bleed.

## Test Invariants (Non-Negotiable)

- `tests/hello-world/hello-world.contract.spec.ts` validates raw DB contract text.
- `tests/hello-shader-world/hello-shader-world.contract.spec.ts` validates deterministic GPU text contracts.
- `tests/random-walk-world/random-walk-world.contract.spec.ts` validates deterministic random-walk text contracts.
- `tests/random-walk-world/random-walk-world.ui.spec.ts` validates controls, seed determinism, camera continuity, and bounded frame progression.
- `tests/random-walk-world/random-walk-world.basic-universe.contract.spec.ts` validates baseline minimum-dot-count universe contracts.
- If route structure or route types drift, run `npm run typecheck`.

## High-Value Files

- `app/routes.ts`
- `app/routes/hello-shader-world.tsx`
- `app/features/3d/hello-world/particle-page.tsx`
- `app/features/3d/hello-world/camera-persistence-controls.tsx`
- `app/features/3d/hello-shader-world/hello-shader-world-page.tsx`
- `app/features/3d/hello-shader-world/hello-shader-world-scene.tsx`
- `app/features/3d/hello-shader-world/hello-shader-world-simulation.ts`
- `app/features/3d/hello-shader-world/hello-shader-world-contract.ts`
- `app/features/3d/random-walk-world/random-walk-world-page.tsx`
- `app/features/3d/random-walk-world/random-walk-world-simulation.ts`
- `app/features/3d/random-walk-world/simulation/random-walk-parameter-runtime.ts`
- `app/features/3d/random-walk-world/simulation/random-walk-simulation-contract.ts`
- `app/features/3d/random-walk-world/simulation/random-walk-simulation-rng.ts`
- `app/features/3d/random-walk-world/peer-influence/contracts.ts`
- `app/features/3d/random-walk-world/peer-influence/runtime.ts`
- `app/db/client-bridge/bridge.ts`
- `app/db/worker/messages.ts`
- `app/db/worker/worker.ts`
- `app/db/worker/sqlite-repository.ts`
- `playwright.config.ts`

## Local Repo Guides

- `skills/e2e_implementation.md`: raw DB-text contract testing for `hello-world`
- `skills/create_user_stories_from_repo.md`: repository-driven story extraction workflow
