# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CarTrack — a local-first PWA (Spanish UI) for tracking vehicle maintenance, mileage, and service history. No framework, no build step, no bundler. All app data lives in the browser's IndexedDB; the backend only serves static files (it has no data API).

## Commands

Backend (dev server, serves the `frontend/` directory over HTTP):
```
cd backend
npm run serve      # nodemon ./src/index.js, reads PORT from backend/.env
```
There is no `npm install` step tracked beyond what's already in `backend/node_modules`; there are no lint, build, or test scripts in either `backend/` or `frontend/` (no test suite exists in this repo).

Frontend has no package.json and no build step — it's plain ES modules loaded directly by the browser (`<script type="module">` in `frontend/index.html`). Serve it either via the backend (`npm run serve`, uses `frontend/` as `PUBLIC_DIR`) or via VS Code Live Server (`.vscode/settings.json` sets `liveServer.settings.port`).

**Local dev caveat**: `frontend/cacheServiceWorker.js` has an `INTERCEPT_FETCH_REQUESTS` flag. Set it to `false` while developing so hot-reloaded changes are visible instead of the cached service-worker version; set it back to `true` before release along with bumping the cache version numbers (see `frontend/js/README.md`).

## Architecture

### Backend (`backend/src`)
Minimal Node http server, no framework:
- `index.js` — loads `.env`, starts `createServer(handleRequest)`.
- `http/requestHandler.js` — hand-rolled static file router. Maps `/`, `/css/*`, `/js/*`, `/static/icons/*`, `/static/manifest.json`, `/cacheServiceWorker.js`, `/favicon.ico` to files under `frontend/`, streamed via `fs.createReadStream`. Anything else is a 404. There are no data/CRUD routes — all persistence is client-side.
- `http/httpResponses.js`, `http/types.js` — response helpers and JSDoc types (`ApiRequest`/`ApiResponse`).
- `logger/logger.js` — server-side logging.

### Frontend (`frontend/`)
Vanilla JS, ES modules, no framework. Single-page app with `data-*` attributes on `#app` driving CSS-based view switching (no virtual DOM/diffing).

- **Entry point**: `js/app.js` — initializes cache, IndexedDB, app state, and UI, then reacts to the `IndexedDbInited` event to load the current vehicle (or open onboarding if none exists).
- **State** (`js/common/state.js`): three plain objects — `appState` (UI flags like `showVehicleForm`, `currentView`), `dataState` (`currentVehicle`, `currentItem`), `dbStore` (in-memory cache of DB records). `setStateField()` mirrors `appState` fields onto `#app`'s `dataset`, so CSS drives show/hide via attribute selectors — there's no reactive re-render framework.
- **Event bus** (`js/lib/utils.js`): tiny pub/sub (`eventBus.on/off/emit`), currently used for the `IndexedDbInited` startup signal.
- **Persistence** (`js/lib/indexedDb.js` + `js/local-db/*`): IndexedDB wrapper (db name `CarTrack`, versioned via `dbVersion` — bumping it wipes/upgrades stores) exposing `putOne/getOne/getAll/getOneWithIndex/getAllWithIndex/deleteOne/deleteMany`. Four object stores: `vehicles`, `maintenanceItems` (indexed by `vehicleKey`), `serviceHistory` (indexed by `itemKey`), `mileageHistory` (indexed by `vehicleKey`). Per-store modules in `js/local-db/` (`vehicle-db.js`, `maintenance-db.js`, `service-db.js`, `mileage-db.js`) wrap these generic functions with typed, store-specific calls. `seed.js` can populate fake data for local testing (invoked manually from `app.js`, normally commented out).
- **UI** (`js/ui/*`): one module per feature area (`vehicle-ui.js`, `maintenance-ui.js`, `service-ui.js`, `mileage-ui.js`) plus `ui.js` which wires up global button handlers and a single delegated click listener on `#app` keyed off `data-click-action` (see the `switch` in `initUi()` for the action → handler map — add new click actions there rather than attaching ad hoc listeners).
- **DOM helpers** (`js/lib/dom.js`): `$`/`$queryOne`/`$new`/`$button` etc. are the only way elements get created/queried — no direct `document.*` calls elsewhere. `$button()` builds the standard button markup (icon/label/overlay) used everywhere for visual consistency.
- **PWA/offline** (`cacheServiceWorker.js`, `js/initializeCache.js`): app-shell caching with a version banner (`#updateBanner`) prompting the user to refresh when a new cache version is deployed.
- **CSS** (`frontend/css/`): plain CSS, no preprocessor, split by concern (`style.css` base/layout, `classes.css` utility classes, `btn.css`, `input.css`, `service.css`, `vehicle-chips.css`, `toast.css`, `logger.css`, `cache-control.css`), all linked directly in `index.html`. View switching (`MaintenanceList` vs `SingleItem`) and form/modal visibility are driven by `data-*` attribute selectors matching `appState` fields set via `setStateField`, not by JS show/hide toggling classes per element.
- **Language**: all user-facing strings (labels, placeholders, button text) are in Spanish (`lang="es"` in `index.html`); keep new UI text consistent with that.
