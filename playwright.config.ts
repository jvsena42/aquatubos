import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Must match `base` in vite.config.ts.
const BASE_URL = `http://localhost:${PORT}/aquatubos/`;

// End-to-end tests run against the production build served by `vite preview`.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
