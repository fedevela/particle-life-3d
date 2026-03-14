# particle-life-3d

`particle-life-3d` is a contract-first React Router + React Three Fiber application.

The core idea is simple: if behavior matters, it should be expressible as deterministic text and enforceable in E2E tests. Rendering quality is important, but contract stability is the foundation.

## Runtime Surfaces

1. `hello-world`
   Persistent sprite + camera state through SQLite WASM in a Web Worker.
2. `hello-shader-world`
   Deterministic GPU simulation validated by text contracts at fixed frame milestones.
3. `random-walk-world`
   Deterministic random-walk simulation validated by text contracts at fixed time milestones, including UI clamp/wheel behaviors.

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)
- Chromium-based browser for OPFS + WebGL local behavior parity

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Script Reference

- `npm run dev` starts local dev server
- `npm run build` builds server/client bundles
- `npm run start` serves build output
- `npm run typecheck` runs route typegen + TypeScript checks
- `npm run test:e2e` runs all Playwright tests
- `npm run test:e2e:hello-world` runs hello-world E2E tests
- `npm run test:e2e:hello-shader-world` runs shader-world E2E tests
- `npm run test:e2e:random-walk-world` runs random-walk E2E tests

## E2E First: Contract Runbook

Smallest high-signal verification sequence:

```bash
npm run typecheck
npm run test:e2e:hello-world
npm run test:e2e:hello-shader-world
npm run test:e2e:random-walk-world
npm run build
```

Fast shader-contract pass:

```bash
npm run test:e2e:hello-shader-world
```

What shader contract tests validate:

- route boots in `testMode`,
- shader test globals are available,
- simulation reset works,
- exact contracts match fixtures at frames `0`, `30`, `60`, and `90`.

Shader fixtures live in:

- `tests/hello-shader-world/contracts/hello-shader-world.frame-000.txt`
- `tests/hello-shader-world/contracts/hello-shader-world.frame-030.txt`
- `tests/hello-shader-world/contracts/hello-shader-world.frame-060.txt`
- `tests/hello-shader-world/contracts/hello-shader-world.frame-090.txt`

## Determinism Conventions

### Query params used by tests

- hello-world: `?testMode=true&projectId=<id>&seed=<seed>`
- hello-shader-world: `?testMode=true&seed=<seed>`
- random-walk-world: `?testMode=true&seed=<seed>`

### Test globals exposed in `testMode`

- hello-world:
  - `window.__GET_DB_CONTRACT_TEXT__`
  - `window.__APPLY_CAMERA_ACTION_FOR_TEST__`
  - `window.__DELETE_PROJECT_DATA__`
- hello-shader-world:
  - `window.__GET_SHADER_CONTRACT_TEXT__`
  - `window.__GET_SHADER_FRAME__`
  - `window.__RESET_SHADER_SIM_FOR_TEST__`
- random-walk-world:
  - `window.__GET_RANDOM_WALK_CONTRACT_TEXT__`
  - `window.__GET_RANDOM_WALK_FRAME__`
  - `window.__RESET_RANDOM_WALK_SIM_FOR_TEST__`

### Milestones used in contract suites

- hello-shader-world frames: `0`, `30`, `60`, `90`
- random-walk-world times (ms): `0`, `72`, `144`, `216`, `288`, `360`

## Fixture Policy

- Contract fixtures are source-of-truth outputs, not snapshots of rendered pixels.
- Update fixtures only when behavior changes are intentional and reviewed.
- Random-walk scenario fixtures can be regenerated intentionally with:

```bash
UPDATE_RANDOM_WALK_CONTRACTS=1 npm run test:e2e:random-walk-world
```

Then rerun without `UPDATE_RANDOM_WALK_CONTRACTS` to confirm stability.

## Architecture in One Flow

1. Route renders a feature page under `app/features/3d/`.
2. Feature uses typed APIs in `app/db/client-bridge/bridge.ts`.
3. Bridge sends typed messages from `app/db/worker/messages.ts`.
4. Worker handles requests in `app/db/worker/worker.ts`.
5. Repository executes SQL + deterministic formatting in `app/db/worker/sqlite-repository.ts`.
6. Tests assert raw contract text from deterministic seams.

For full architecture details, read `ARCHITECTURE.md`.

## Safe Change Paths

When changing persisted data, update this full path together:

1. `app/db/types.ts`
2. `app/db/worker/messages.ts`
3. `app/db/client-bridge/bridge.ts`
4. `app/db/worker/worker.ts`
5. `app/db/worker/sqlite-repository.ts`
6. consuming hook or feature module

When adding or changing pages:

1. update `app/routes.ts`
2. keep route module in `app/routes/` thin
3. place runtime behavior in `app/features/3d/`

## Project Layout

```text
app/
  db/
    client-bridge/      # main-thread -> worker typed seam
    worker/             # worker runtime + sqlite repository
    types.ts            # shared persistence/domain types
  features/3d/          # runtime surfaces (hello-world/shader/random-walk)
  hooks/                # query and mapping hooks
  routes/               # thin route modules
  state/                # Zustand UI and control state
  routes.ts             # route tree
tests/
  hello-world/
  hello-shader-world/
  random-walk-world/
```

## Runtime Quirks Worth Knowing

- Playwright runs with `workers: 1` to reduce GPU nondeterminism.
- Playwright launches Chromium with SwiftShader flags for headless WebGL stability.
- Shader and random-walk controls are in the sidebar submenus.
- `hello-world` test isolation depends on project-scoped persistence and cleanup.
- If OPFS or `SharedArrayBuffer` is unavailable, worker DB initialization fails loudly by design.

## Troubleshooting

- Scene fails to initialize: check browser console for worker errors first.
- Camera state not restoring: verify OPFS availability and storage policy.
- E2E shader failures in headless: confirm Playwright uses configured launch args.
- Route/type drift after route edits: run `npm run typecheck`.

## Additional Docs

- `ARCHITECTURE.md` for system-level design and seams
- `AGENTS.md` for contributor/agent workflow rules and E2E invariants
