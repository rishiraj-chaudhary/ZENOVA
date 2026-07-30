import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Mongo-backed suites share one in-memory server, so they must not run
    // against the same collections concurrently.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    setupFiles: ["tests/setup.js"],
  },
});
