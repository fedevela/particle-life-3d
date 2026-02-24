import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const chromeDevtoolsProbePath =
  "/.well-known/appspecific/com.chrome.devtools.json";

const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function applyCrossOriginIsolationHeaders(res: {
  setHeader: (name: string, value: string) => void;
}) {
  for (const [name, value] of Object.entries(crossOriginIsolationHeaders)) {
    res.setHeader(name, value);
  }
}

const enforceCrossOriginIsolation: Plugin = {
  name: "enforce-cross-origin-isolation",
  configureServer(server) {
    server.middlewares.use((_, res, next) => {
      applyCrossOriginIsolationHeaders(res);
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_, res, next) => {
      applyCrossOriginIsolationHeaders(res);
      next();
    });
  },
};

const handleChromeDevtoolsProbe: Plugin = {
  name: "handle-chrome-devtools-probe",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      applyCrossOriginIsolationHeaders(res);

      if (req.url?.split("?")[0] === chromeDevtoolsProbePath) {
        res.statusCode = 204;
        res.end();
        return;
      }

      next();
    });
  },
};

export default defineConfig({
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    enforceCrossOriginIsolation,
    handleChromeDevtoolsProbe,
  ],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
});
