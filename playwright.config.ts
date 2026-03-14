import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 5000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    launchOptions: {
      args: [
        "--ignore-gpu-blocklist",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
      ],
    },
    trace: "on-first-retry",
  },
  webServer: {
    command: "CHOKIDAR_USEPOLLING=1 npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
