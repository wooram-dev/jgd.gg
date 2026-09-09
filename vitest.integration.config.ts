import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["./tests/helpers/integration-global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
