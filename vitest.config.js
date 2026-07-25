import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.js", "server/**/*.test.js"],
    exclude: ["server/__tests__/live-services.test.js", "node_modules/**"],
    environment: "node",
  },
});
