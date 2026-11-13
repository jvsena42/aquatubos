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
    // Screen transitions and the sheet animation are covered by unit tests; without motion the
    // end-to-end tests do not have to wait for them.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      name: 'chromium',
      testMatch: '**/stages.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // Phone and tablet projects run in Chromium with the device's viewport, pixel ratio, touch
    // and user agent, so CI only has to install one browser.
    { name: 'pixel-7', testMatch: '**/mobile.spec.ts', use: { ...devices['Pixel 7'] } },
    {
      name: 'iphone-14',
      testMatch: '**/mobile.spec.ts',
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'ipad-portrait',
      testMatch: '**/tablet.spec.ts',
      use: { ...devices['iPad (gen 7)'], defaultBrowserType: 'chromium' },
    },
    {
      name: 'ipad-landscape',
      testMatch: '**/tablet.spec.ts',
      use: { ...devices['iPad (gen 7) landscape'], defaultBrowserType: 'chromium' },
    },
    // Fit, overlay controls and labels at 360×640 and 390×844 (the spec sets the viewport).
    {
      name: 'phone-layout',
      testMatch: '**/layout.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    // Real WebKit (the engine of Safari). Local only: `npx playwright install webkit` first.
    { name: 'iphone-14-webkit', testMatch: '**/mobile.spec.ts', use: { ...devices['iPhone 14'] } },
    // Installability checks need the service worker, which the other projects block.
    {
      name: 'pwa',
      testMatch: '**/pwa.spec.ts',
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'allow' },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
