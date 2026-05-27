import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    isolate: true,
    testTimeout: 60000,
    hookTimeout: 60000
  }
});
