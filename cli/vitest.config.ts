import { defineConfig } from 'vitest/config';

// Devnet tests share one chain and one funded genesis wallet, so they run one file at a time.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 15 * 60_000,
    hookTimeout: 15 * 60_000,
    fileParallelism: false,
    disableConsoleIntercept: true,
  },
});
