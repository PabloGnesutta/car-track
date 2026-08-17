/**
 * Fixed port dedicated to the e2e suite's own backend instance, deliberately
 * decoupled from whatever PORT is in backend/.env (used by `npm run serve`
 * for manual dev). playwright.config.js passes this to the webServer it
 * spawns via `env: { PORT: ... }`, so the e2e backend always listens here
 * regardless of .env - this used to read PORT from backend/.env instead,
 * which meant e2e runs and a manually-running dev server were the same
 * process on the same port talking to the same database file. Resetting the
 * database for a clean e2e run (or Playwright's `reuseExistingServer`
 * picking up "whatever's already listening") could then wipe or hijack real
 * local dev data. Pick a different value here if this one ever collides
 * with something else on your machine.
 */
export const TEST_PORT = '3999';
