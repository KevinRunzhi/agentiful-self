import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: ["node_modules", "dist", ".next"],
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
