# Particle Life React App

A React Router + React Three Fiber application for rendering and exploring a persisted 3D particle scene. The app stores scene state in SQLite (WASM + OPFS) through a Web Worker-backed data layer.

## Who this is for

This README is intended for incoming developers who need to:

- run the app locally,
- understand how the codebase is organized,
- and know where to make feature changes safely.

For a deeper system design guide, see `ARCHITECTURE.md`.

## Tech stack

- **Runtime:** Node.js + npm
- **Framework:** React Router v7 (file-based route config)
- **UI:** React 19, Tailwind CSS v4, Radix UI, Lucide icons
- **3D:** Three.js via React Three Fiber and Drei
- **State:** Zustand for UI state
- **Persistence:** SQLite WASM in a browser worker, backed by OPFS
- **Language:** TypeScript

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)
- A modern Chromium-based browser for full OPFS support during local development

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Available scripts

- `npm run dev` - Start the local development server.
- `npm run build` - Build the production server/client bundles.
- `npm run start` - Serve the built app from `build/server/index.js`.
- `npm run typecheck` - Run route type generation and TypeScript checks.

## Project structure

```text
app/
  db/
    client-bridge/      # Main-thread bridge that talks to worker
    worker/             # SQLite worker and repository
    types.ts            # Shared persistence and domain types
  features/3d/          # Canvas scene, camera controls, page shell
  hooks/                # Data hooks (live query + sprites mapping)
  routes/               # Route components used by React Router config
  state/                # Zustand UI store
  app.css               # Global styles and Tailwind theme tokens
  root.tsx              # Root layout and error boundary
  routes.ts             # Route tree definition
```

## Development workflow

1. Start with `app/routes.ts` to understand route-level entry points.
2. Follow route components into feature modules under `app/features/`.
3. For persistent data changes, modify both:
   - worker contract in `app/db/worker/messages.ts`, and
   - bridge/repository implementations in `app/db/client-bridge/` and `app/db/worker/`.
4. Run `npm run typecheck` before opening a PR.

## Persistence notes

- SQLite runs in a dedicated Web Worker.
- Scene data and camera state are persisted in OPFS (`particle-life.sqlite3`).
- If OPFS or `SharedArrayBuffer` are unavailable, DB initialization will fail with an explicit error.

## Common troubleshooting

- **Blank or failing scene on startup:** open DevTools and check worker errors first.
- **Camera not restoring:** ensure browser supports OPFS and no storage policy blocks worker persistence.
- **Type errors after route edits:** run `npm run typecheck` to regenerate route types.

## Additional docs

- Architecture and dependency details: `ARCHITECTURE.md`
