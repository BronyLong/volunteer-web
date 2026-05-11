import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["**/*.js"],
      exclude: [
        "node_modules/**",
        "coverage/**",
        "tests/**",
        "vitest.config.js",
        "index.js",
      ],
    },
    thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
    },
  },
});
