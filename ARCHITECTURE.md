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

## Extension points for new features

When adding new persisted entities:

1. Add shared types in `app/db/types.ts`.
2. Extend message contract in `app/db/worker/messages.ts`.
3. Implement worker handlers in `app/db/worker/worker.ts`.
4. Add SQL operations in `app/db/worker/sqlite-repository.ts`.
5. Add bridge helpers in `app/db/client-bridge/bridge.ts`.
6. Consume via feature-specific hooks in `app/hooks/`.

When adding new UI pages:

1. Add route entries in `app/routes.ts`.
2. Create route modules in `app/routes/`.
3. Compose with feature modules in `app/features/`.
