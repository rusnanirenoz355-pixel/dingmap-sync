import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@dingmap-sync/db": fileURLToPath(new URL("./packages/db", import.meta.url)),
      "@dingmap-sync/dingmap": fileURLToPath(new URL("./packages/dingmap", import.meta.url)),
      "@dingmap-sync/normalizer": fileURLToPath(
        new URL("./packages/normalizer", import.meta.url),
      ),
      "@dingmap-sync/shared": fileURLToPath(new URL("./packages/shared/index.ts", import.meta.url)),
      "@dingmap-sync/sources": fileURLToPath(new URL("./packages/sources", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
  },
});
