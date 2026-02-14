import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/tests/**/*.test.ts"],
    exclude: ["apps/web/e2e/**", "**/node_modules/**", "**/dist/**"],
  },
});
