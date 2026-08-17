import { defineConfig } from '@playwright/test';
import { TEST_PORT } from './tests/testPort.js';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  globalTeardown: './tests/e2e/global-teardown.js',
  fullyParallel: true,
  // The backend is a minimal hand-rolled static file server (no framework,
  // no caching) — a large burst of concurrent requests right as it comes up
  // (many workers each loading ~15+ ES module files at once) can outpace it.
  // Capping workers keeps the suite reliable; bump this back up if the
  // backend ever gets a real static-file layer under it.
  workers: 2,
  timeout: 30000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run serve',
    cwd: '../backend',
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    // Isolates the e2e backend from a manually-run dev server: its own
    // port (so Playwright never mistakes/reuses a dev server for its test
    // server) and its own sqlite file (so wiping it for a clean test run
    // can never touch real local dev data). See tests/testPort.js.
    env: {
      PORT: TEST_PORT,
      DB_NAME: 'cartrack.test.db',
    },
  },
});
