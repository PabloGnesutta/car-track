---
name: run-car-track
description: Build, run, and drive CarTrack (backend/ + frontend/, one deployable local-first PWA). Use when asked to start CarTrack, run its tests, take a screenshot of its UI, or interact with the running app.
---

CarTrack is a single web app: a hand-rolled Node static file server (`backend/`) serving a vanilla-JS PWA (`frontend/`) with zero data API — all app state lives in the browser's IndexedDB. Drive it via `frontend/tests/driver.mjs`, a Playwright script that launches the real backend and a real Chromium (no `chromium-cli` in this environment, so this script is the harness).

All paths below are relative to repo root.

## Prerequisites

Nothing beyond Node.js — this is a zero-dependency frontend and a near-zero-dependency backend. No `apt-get`/system packages needed; verified on Windows (this environment) and should work identically on Linux/macOS.

## Setup

One-time, from `frontend/`:

```bash
cd frontend
npm install                     # pulls in @playwright/test
npx playwright install chromium # downloads the browser binary (not bundled)
```

No env vars required. The backend reads its port from `backend/.env` (`PORT=3000` by default) — `frontend/tests/testPort.js` reads the same file, so the driver and the e2e suite always agree with whatever `backend/.env` says without needing to be told.

## Build

No build step. Frontend is plain ES modules loaded directly by the browser; backend is plain Node `http`.

## Run (agent path)

```bash
cd frontend
node tests/driver.mjs                    # headless, screenshots to the OS temp dir
node tests/driver.mjs --headed           # same, but with a visible browser window
node tests/driver.mjs --out <dir>        # write screenshots to <dir> instead
```

The driver starts `backend/`'s dev server itself (waits for it to actually respond, not just for the process to spawn), drives Chromium through: onboarding → create a vehicle → create a maintenance item → open its detail view, screenshotting each step, and prints any browser console errors it observed. It shuts the backend down cleanly on exit (`taskkill /T /F` on Windows — plain `kill` leaves an orphaned nodemon child otherwise). Exit code is non-zero on any console error or thrown exception.

It also exports its helpers (`startBackend`, `stopBackend`, `createFirstVehicle`, `createMaintenanceItem`, `BASE_URL`) for reuse — write a new short script alongside it that imports these and drives a different flow (e.g. swipe-to-delete, the confirm dialog, backup/restore) rather than duplicating the boilerplate. `tests/e2e/helpers.js` has the same `createFirstVehicle`/`createMaintenanceItem` shape used by the real test suite — match that API if you extend either.

**Direct invocation** — most of this session's actual feature work (status computation, cost/fuel math, the Spanish number parser, backup validation) is pure logic with no DOM dependency, importable directly without launching anything:

```bash
cd frontend
node -e "import('./js/lib/spanishNumbers.js').then(m => console.log(m.parseSpanishNumber('cincuenta mil trescientos')))"
# → 50300
```

Swap in any `js/lib/*.js` module that doesn't import `lib/logger.js` (directly or via `lib/indexedDb.js`) — those touch `document` at module scope and throw outside a browser.

## Run (human path)

```bash
cd backend
npm run serve   # → http://localhost:<PORT from .env>, Ctrl-C to stop
```

Open the URL in a browser. Useless for an agent (no way to see the window), but this is what a human runs.

## Test

```bash
cd frontend
npm run test:unit   # tests/unit/*.test.js, Node's built-in test runner, no browser — 75 passing
npm run test:e2e    # tests/e2e/*.spec.js, Playwright + real browser + IndexedDB — 21 passing
npm test            # both, in order
```

---

## Gotchas

- **`backend/.env`'s `PORT` is the only place the port is configured.** It used to disagree with a hardcoded `:4000` in `playwright.config.js`, causing e2e runs to silently time out after 30s unless you knew to override `PORT=4000`. Fixed — both now read `frontend/tests/testPort.js`, which reads `backend/.env`. If you ever hardcode a port anywhere for this project, you've reintroduced the bug.
- **A driver script here can't live under `.claude/skills/`.** `@playwright/test` is only installed in `frontend/node_modules`, and Node resolves bare `import` specifiers relative to the *importing file's own location* (walking up its directory tree), not `cwd`. A script under `.claude/skills/run-car-track/` has no path to `frontend/node_modules` in its ancestry, so the import fails outright. That's why `driver.mjs` lives in `frontend/tests/` instead.
- **`spawn(..., { shell: true })` on Windows leaves an orphaned child on a plain `.kill()`.** `npm run serve` spawns `nodemon`, which spawns `node` — `shell:true` wraps the whole thing in `cmd.exe`, and killing just the top process leaves the real server running and the port held. Use `taskkill /pid <pid> /T /F` on Windows (`/T` = kill the whole tree); plain `SIGKILL` is fine on POSIX where there's no shell-wrapper layer in between.
- **Native `confirm()`/`alert()` never fire** — they're replaced by a custom in-page dialog (`#confirmDialog`, shown via a `.show` class). If you're scripting a flow that deletes a vehicle or imports a backup, click `#confirmDialog .confirm-ok .btn` / `.confirm-cancel .btn` — don't wait on a `dialog` event, it never comes.
- **Fresh IndexedDB → onboarding, every time.** Each new Playwright browser context starts with no data, so `#vehicleForm` opens automatically and can't be dismissed until a vehicle is created. Any driver flow has to start with `createFirstVehicle()` (or equivalent) before anything else on screen is reachable.

## Troubleshooting

- **`EADDRINUSE` on driver/test startup**: a previous run's backend didn't get cleaned up. Find and kill it: `netstat -ano | grep ':<port>' | grep LISTENING` then `taskkill /pid <pid> /F` (Windows) or `kill <pid>` (POSIX).
- **`(node:####) [DEP0190] DeprecationWarning` from `spawn`**: passing an args array together with `shell: true` triggers this. Pass the whole command as one string instead (`spawn('npm run serve', { shell: true, ... })`), not `spawn('npm', ['run', 'serve'], { shell: true })`.
