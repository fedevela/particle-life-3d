# Architecture

This document describes how the application is structured, how dependencies are used, and how UI and persistence layers interact.

## System overview

The app is a client-rendered React Router application with a dashboard shell and a 3D scene page. It persists scene data and camera state in SQLite running inside a Web Worker.

High-level flow:

1. React route renders `ParticlePage`.
2. `ParticleScene` requests sprite data via hooks.
3. Hook calls the client DB bridge.
4. Bridge sends typed messages to the worker.
5. Worker reads/writes SQLite in OPFS and returns results.
6. Scene renders sprites and persists camera movement events.

## Dependency architecture

## Runtime and framework

- `react`, `react-dom`: UI runtime.
- `react-router`, `@react-router/node`, `@react-router/serve`: routing, app build/runtime integration.

## UI and styling

- `tailwindcss` + `@tailwindcss/vite`: utility-first styling with Vite integration.
- `@radix-ui/react-collapsible`: sidebar collapse/expand primitive.
- `lucide-react`: icon set.
- `clsx` + `tailwind-merge`: class composition helper (`app/lib/cn.ts`).

## 3D rendering

- `three`: low-level 3D engine.
- `@react-three/fiber`: React renderer for Three.js.
- `@react-three/drei`: ready-made helpers (`OrbitControls`).

## State and persistence

- `zustand`: local UI state (sidebar expanded/collapsed).
- `@sqlite.org/sqlite-wasm`: SQLite engine running in a dedicated worker.

## Build and toolchain

- `vite`: dev/build tool.
- `typescript`: static typing.
- `vite-tsconfig-paths`: TS path aliases in Vite.

## UI architecture

## Route layer

- `app/routes.ts` defines one layout route (`dashboard-shell.tsx`) with:
  - index route (`dashboard-home.tsx`)
  - `hello-world` route (`hello-world.tsx`)

Both current routes render the same 3D feature page (`ParticlePage`).

## Layout and shell

- `app/root.tsx` provides the HTML layout, app-level scripts/meta, and the error boundary.
- `app/routes/dashboard-shell.tsx` renders:
  - collapsible sidebar,
  - nav links,
  - `Outlet` content region.

Sidebar state is held in Zustand (`app/state/ui-store.ts`).

## Feature layer (3D)

- `app/features/3d/particle-page.tsx`
  - owns the full-screen `Canvas` and camera defaults.
- `app/features/3d/particle-scene.tsx`
  - loads sprite entities through `useSprites`,
  - validates supported sprite type(s),
  - renders scene helpers/lights/meshes,
  - mounts `CameraPersistenceControls`.
- `app/features/3d/camera-persistence-controls.tsx`
  - restores saved camera state on mount,
  - throttles camera save operations on control end.

## Data architecture

## Main-thread bridge

`app/db/client-bridge/bridge.ts` is the only place UI code should interact with worker persistence.

Responsibilities:

- lazily create and cache the worker,
- track pending request/response pairs by `requestId`,
- expose typed methods (`fetchSprites`, `persistCameraState`, etc.),
- route worker table update events to subscribers.

## Worker + repository

- `app/db/worker/worker.ts`
  - initializes SQLite WASM,
  - opens OPFS database file (`particle-life.sqlite3`),
  - handles typed worker requests,
  - emits table update events,
  - seeds an initial sphere when DB is empty.
- `app/db/worker/sqlite-repository.ts`
  - centralizes SQL schema and CRUD operations,
  - validates row shapes and scalar values before returning data.
- `app/db/worker/messages.ts`
  - defines the worker message contract shared by main thread and worker.

## Hook layer

- `app/hooks/use-live-table-query.ts`
  - generic hook for init + query + subscription refresh cycle.
- `app/hooks/use-sprites.ts`
  - converts raw DB rows into typed, validated sprite entities.

## Styling architecture

- `app/app.css` imports Tailwind and sets global theme tokens.
- Base app styles ensure full-height layout and dark background.
- Component-level Tailwind classes define visuals for shell and scene containers.

## Error handling strategy

- Boundary-level: `app/root.tsx` catches and displays route/render errors.
- Hook-level: data hooks throw typed errors to be caught by React boundaries.
- Bridge-level: request errors are normalized and pending requests are rejected on worker failures.
- Worker-level: invalid payloads or persistence failures return structured error responses.

## Domain language & terminology

This project uses specific terminology to describe its 3D, simulation, and testing components.

- **Scene**: The top-level 3D container managed by React Three Fiber (`<Canvas>`). It encompasses the camera, lights, and all rendered entities.
- **3D**: The spatial dimension of the simulations. While the logic may be 2D or 3D, all rendering occurs in a 3D coordinate system (X, Y, Z).
- **Swarm**: A collection of autonomous particles (agents) that exhibit collective behavior. In this project, "Swarm Walk" refers to a GPU-accelerated simulation of these agents.
- **Peer**: An individual agent or particle within a population. "Peer-to-peer" interactions (like attraction or repulsion) drive the emergent behavior of the swarm.
- **Deterministic Simulation**: A simulation designed to produce identical results given the same input seed and frame number. This is critical for contract testing.
- **Contract Tests**: E2E tests that verify the "contract" of the application state (e.g., SQLite row content or GPU buffer readbacks) against stable text fixtures.
- **WebGL / GLSL**: The technology stack used for hardware-accelerated rendering and compute. GLSL (OpenGL Shading Language) is used to write the vertex, fragment, and "compute" shaders.
- **E2E Tests**: In this project, E2E (End-to-End) refers to Playwright tests that run against the full application, including the UI, 3D scene, and persistence layers.
- **OPFS (Origin Private File System)**: A high-performance browser storage API used by the SQLite WASM worker to persist data locally.
- **GPU Readback**: The process of pulling simulation data from the graphics card's memory back to the CPU (as a `Float32Array`) for verification in tests.

## Testing architecture

The application uses Playwright for both UI functional testing and deterministic contract testing of 3D simulations and the persistence layer.

### Contract testing

Contract tests validate that the internal state of the application (e.g., SQLite data or GPU simulation milestones) remains consistent across changes.

- **Determinism:** Simulations use seeded RNGs to ensure repeatable results at specific frames (0, 30, 60, 90).
- **Test APIs:** Features expose their internal state through standardized global APIs like `window.__GET_<NAME>_CONTRACT_TEXT__` and `window.__RESET_<NAME>_SIM_FOR_TEST__`.
- **Fixtures:** Stable text-based contracts are stored in `tests/contracts/`.
- **Fixture Management:** A shared `fixture-helper.ts` utility handles reading, comparing, and updating these fixtures.
- **Workflow:** Fixtures are updated explicitly using `npm run test:update-fixtures <test-file>`.

### UI testing

UI tests (`tests/*.ui.spec.ts`) verify navigation, component mounting, and basic interaction patterns using Playwright's standard assertions.

## Extension points for new features

When adding new persisted entities:

1. Add shared types in `app/db/types.ts`.
2. Extend message contract in `app/db/worker/messages.ts`.
3. Implement worker handlers in `app/db/worker/worker.ts`.
4. Add SQL operations in `app/db/worker/sqlite-repository.ts`.
5. Add bridge helpers in `app/db/client-bridge/bridge.ts`.
6. Consume via feature-specific hooks in `app/hooks/`.
7. **Add contract tests** in `tests/` to ensure the new persistence logic is stable.

When adding new UI pages:

1. Add route entries in `app/routes.ts`.
2. Create route modules in `app/routes/`.
3. Compose with feature modules in `app/features/`.
4. **Add UI tests** to verify navigation and basic rendering.

When adding new 3D simulations:

1. Implement deterministic logic with seeded RNG.
2. Expose the `__GET_..._CONTRACT_TEXT__` and `__RESET_...__` APIs.
3. Create a `.contract.spec.ts` test and generate initial fixtures.
