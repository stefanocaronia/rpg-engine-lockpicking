import { defineConfig } from "vitest/config";

// The tests in test/, each running many of the engine's commands: a longer limit than vitest's 5 s.
export default defineConfig({
    test: { include: ["test/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 30_000 },
});
