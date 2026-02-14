import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["apps/**/tests/**/*.test.ts", "packages/**/tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "apps/web/e2e/**",
      "apps/api/tests/integration/grant.test.ts",
      "apps/api/tests/integration/permission.test.ts",
      "apps/api/tests/integration/visibility.test.ts",
      "apps/api/tests/integration/group-permissions.test.ts",
      "apps/api/tests/performance/rbac-performance.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        ".next/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/types/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@agentifui/shared": resolve(__dirname, "./packages/shared/src"),
      "@agentifui/db": resolve(__dirname, "./packages/db/src"),
      "@agentifui/ui": resolve(__dirname, "./packages/ui/src"),
    },
  },
});
