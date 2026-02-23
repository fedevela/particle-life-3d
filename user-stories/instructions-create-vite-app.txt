Act as an expert React frontend developer specializing in Vite, 3D web graphics, and high-performance, reactive local databases. I need you to guide me in building a React application structured with a data-driven rendering approach.

**Architectural & Output Constraints:**
* Apply strict Separation of Concerns (SoC) and the Single Responsibility Principle (SRP) from the SOLID guidelines. 
* Do not output monolithic files. Instead, enforce modularity by strictly separating the database initialization layer, the global UI state layer (Zustand), and the presentation layer (React/R3F).
* Prioritize clear textual descriptions of the architecture, file structure, and reactive data flow.
* Provide *narrow, highly focused code examples* only for the most critical integration points (e.g., configuring RxDB with OPFS, and subscribing to RxJS observables inside React). Assume I can wire up standard UI boilerplate.

**Tech Stack & Dependencies:**
* Build tool: Vite 7
* Framework: React 19, React Router DOM v7
* State Management: Zustand v5 (for ephemeral UI state)
* Styling: Tailwind CSS v3.4, `clsx`, `tailwind-merge`
* UI Primitives: Radix UI, `lucide-react` icons
* 3D Libraries: `three`, `@react-three/fiber`, `@react-three/drei`
* Database: `rxdb`, `rxjs`, and the RxDB OPFS Storage Adapter (`rxdb/plugins/storage-opfs`)

**Application Requirements:**

1. **High-Performance Reactive Database Layer (RxDB + OPFS):**
   * Initialize an RxDB instance utilizing the OPFS storage adapter for high-performance, worker-threaded local persistence.
   * Use the browser's native `crypto.randomUUID()` for generating all IDs.
   * **Database Schema (RxJsonSchema):** On initialization, ensure two collections exist:
     1. `variables`: A collection to hold generic state (e.g., `id` string UUID, `name` string unique, `value` object/JSON). 
     2. `sprites`: An entity collection (e.g., `id` string UUID, `type` string, `pos_x` number, `pos_y` number, `pos_z` number, `metadata` object). 
   * Pre-populate the `sprites` collection with a single document representing a "sphere" at the origin (0,0,0) if the collection is empty.

2. **Global Layout (App Shell):**
   * Create a standard dashboard-style layout. 
   * **Left Sidebar:** A collapsible/expandable navigation menu managed by Zustand (`isExpanded`). Include a toggle button with a Lucide icon.
   * **Menu Items:** Initially, just one item mapped to the `/` route: "Hello World".

3. **The "Hello World" Route (Data-Driven 3D Scene):**
   * The main content area renders a full-width/full-height React Three Fiber `<Canvas>`.
   * Include standard lighting (ambient + directional) and Drei's `<OrbitControls>`.
   * **Reactive Rendering:** Create a custom React hook that subscribes to the `sprites` collection's RxJS Observable (`db.sprites.find().$`). Map over this reactive data in the canvas to render the 3D objects using their UUIDs as React keys. Apply a simple, self-contained texture to the sphere.

4. **Connecting Camera State to RxDB:**
   * **Save Logic:** Listen to the `<OrbitControls>` `onChange` or `onEnd` events. Debounce the event, extract the camera's position and target, and execute an `upsert` into the `variables` collection for the document where `name` = `'camera_state'`.
   * **Load Logic:** On mount, query the `variables` collection for the `'camera_state'` document and apply it to the default camera. (Do not heavily bind the camera to the RxJS observable to avoid render loops; just read on mount and write on debounced change).

**Execution Plan:**
Please outline the recommended folder structure first, proving your adherence to Separation of Concerns. Then, walk me through the implementation step-by-step, providing narrow code snippets for:
1. The RxDB initialization file setting up the OPFS plugin and the JSON schemas for the collections.
2. The custom React hook for subscribing to RxJS observables and safely unsubscribing on unmount.
3. The React Three Fiber scene component demonstrating the data-driven rendering of the `sprites` and the save/load mechanism for the camera state.