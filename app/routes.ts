import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/** Define the application route tree used by React Router. */
export default [
  layout("routes/dashboard-shell.tsx", [
    index("routes/dashboard-home.tsx"),
    route("hello-world", "routes/hello-world.tsx"),
    route("hello-shader-world", "routes/hello-shader-world.tsx"),
    /** Issue #32 architecture route placement mapping: CH-001. */
    route("random-walk-world", "routes/random-walk-world.tsx"),
  ]),
] satisfies RouteConfig;
