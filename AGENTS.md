# AGENTS.md

This file applies to the entire repository.

## Purpose

`particle-life-3d` is a React Router + React Three Fiber application with two main runtime surfaces:

- `hello-world`: persisted sprite and camera-state flow backed by SQLite WASM in a Web Worker.
- `hello-shader-world`: deterministic GPU simulation flow with text-based shader contract tests.

Agents should preserve those two behaviors and make changes through the existing architectural seams rather than bypassing them.

## Read First

Start here before making non-trivial changes:

1. `README.md`
2. `ARCHITECTURE.md`
3. `app/routes.ts`
4. The relevant route, feature, and test files for the area you are touching

## Working Rules

- Keep route modules in `app/routes/` thin. Put behavior in `app/features/3d/` or lower layers.
- Do not have UI code talk directly to the worker. Use `app/db/client-bridge/bridge.ts`.
- Treat `app/db/worker/messages.ts` as the shared contract between the main thread and worker.
- Preserve browser guards around `window`, `localStorage`, `Worker`, OPFS, and other browser-only APIs.
- Keep persisted data scoped by `projectId`. The Playwright contract tests depend on isolated project state.
- **3D World E2E Testing:** All 3D simulations (GPU or CPU) must expose a deterministic Test API.
    - **Determinism:** Use a seeded RNG (e.g., hash-based in shaders, Xorshift in JS) to ensure frames are repeatable.
    - **Milestones:** Validate state at fixed frames: 0 (initial), 30, 60, and 90.
    - **GPU Readback:** Use `renderer.readRenderTargetPixels` to pull state into a `Float32Array` for contract generation.
    - **Contract Structure:** Generate a stable text contract using `formatTwoDecimals`, a high-precision checksum (Fletcher-64 style), and representative samples.
    - **Test API:** Expose through `window.__GET_<NAME>_CONTRACT_TEXT__` and `window.__RESET_<NAME>_SIM_FOR_TEST__`.
    - **Fixtures:** Store in `tests/contracts/<name>.frame-XXX.txt` and compare using Playwright's `expect.poll`.
- Prefer extending existing typed flows over adding parallel ad hoc data paths.

## Safe Change Paths

When adding or changing persisted data, update the full path together:

1. `app/db/types.ts`
2. `app/db/worker/messages.ts`
3. `app/db/client-bridge/bridge.ts`
4. `app/db/worker/worker.ts`
5. `app/db/worker/sqlite-repository.ts`
6. The consuming hook or feature module under `app/hooks/` or `app/features/3d/`

When adding or changing pages:

1. Update `app/routes.ts`
2. Add or edit the route module in `app/routes/`
3. Keep page composition in `app/features/3d/`

## Test Invariants

- `tests/hello-world.contract.spec.ts` validates the persisted DB contract as raw text.
- `tests/hello-shader-world.contract.spec.ts` validates deterministic shader milestones as raw text.
- `tests/swarm-walk.contract.spec.ts` validates GPU-simulated swarm walk milestones as raw text.
- Do not replace those tests with image, pixel, or canvas snapshot assertions unless the repo direction changes explicitly.
- Update fixtures under `tests/contracts/` only when the behavior change is intentional and verified. Use the narrow update command: `npm run test:update-fixtures tests/<spec-file>.ts`.
- If route structure or types change, run `npm run typecheck` because it regenerates route types before `tsc`.

## Verification

Use the smallest relevant verification set first:

- `npm run typecheck`
- `npm run test:contract tests/<spec-file>.ts`
- `npm run test:ui tests/<ui-spec-file>.ts`
- `npm run build`

## High-Value Files

- `app/routes.ts`: route tree
- `app/features/3d/particle-page.tsx`: hello-world page and DB test API exposure
- `app/features/3d/hello-shader-world-page.tsx`: shader-world page and shader test API exposure
- `app/features/3d/camera-persistence-controls.tsx`: camera restore/persist behavior
- `app/features/3d/hello-shader-world-contract.ts`: deterministic shader contract text generation
- `app/db/client-bridge/bridge.ts`: main-thread persistence entry point
- `app/db/worker/worker.ts`: worker runtime and request handling
- `app/db/worker/sqlite-repository.ts`: schema and SQL operations
- `playwright.config.ts`: dev server and Playwright wiring

## Local Repo Guides

Use these only when relevant to the task:

- `skills/e2e_implementation.md`: hello-world raw DB-text contract testing approach
- `skills/create_user_stories_from_repo.md`: repository-based user story extraction workflow
