import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "unit",
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./tests/helpers/unit-setup.ts"],
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/features/*/domain/**/*.ts",
        "src/features/number-click/client/game-reducer.ts",
        "src/lib/time/**/*.ts",
        "src/lib/auth/return-to.ts",
        "src/lib/auth/discord-profile.ts",
      ],
      thresholds: { lines: 95, branches: 90 },
    },
  },
});
