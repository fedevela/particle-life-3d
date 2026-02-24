import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/dashboard-shell.tsx", [
    index("routes/dashboard-home.tsx"),
    route("hello-world", "routes/hello-world.tsx"),
  ]),
] satisfies RouteConfig;
