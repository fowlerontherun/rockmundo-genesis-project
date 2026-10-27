import { configDefaults, defineConfig } from "vitest/config";
import { findNodeNativeTests } from "./scripts/native-test-discovery.mjs";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Node-native tests run separately using node --test; retain genuine
    // Vitest .test.mjs suites in this runner.
    exclude: [...configDefaults.exclude, ...findNodeNativeTests().map((p) => `**/${p}`)],
    // Vitest 2 leaves the pool minimum above a CLI --maxWorkers=1 unless the
    // minimum is explicit. Certification intentionally runs serially so that
    // touring/festival state leaks are reproducible rather than race-dependent.
    minWorkers: 1,
  },
});
