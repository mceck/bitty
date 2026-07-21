import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Ink (ink-testing-library) renders write to process.stdout/stdin-shaped
    // mocks that don't tolerate multiple test files rendering concurrently in
    // the same worker — running Button/Checkbox/TabButton/etc side-by-side
    // causes intermittent 5s timeouts that don't reproduce when a file runs
    // alone. The suite is small enough that serial file execution is cheap.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test-utils/**",
        "src/cli.tsx",
        "src/app.tsx",
      ],
    },
  },
});
