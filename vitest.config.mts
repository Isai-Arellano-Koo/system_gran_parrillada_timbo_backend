import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    hookTimeout: 120000,
    testTimeout: 30000,
    reporters: ["verbose"],
  },
});
