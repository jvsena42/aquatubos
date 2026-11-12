import { defineConfig } from 'vitest/config';

// Runs maintenance scripts written in TypeScript through Vitest's transformer, so they can
// import the engine directly. Used by `npm run reference`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.script.ts'],
    testTimeout: 600_000,
  },
});
