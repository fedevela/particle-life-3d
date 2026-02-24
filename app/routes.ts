import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/** Define the application route tree used by React Router. */
export default [
  layout("routes/dashboard-shell.tsx", [
    index("routes/dashboard-home.tsx"),
    route("hello-world", "routes/hello-world.tsx"),
    route("hello-shader-world", "routes/hello-shader-world.tsx"),
  ]),
] satisfies RouteConfig;
