import { defineConfig } from '@playwright/test';
import { TEST_PORT } from './tests/testPort.js';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
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
  },
});
