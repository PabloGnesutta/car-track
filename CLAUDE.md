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
- **Persistence** (`js/lib/indexedDb.js` + `js/local-db/*`): IndexedDB wrapper (db name `CarTrack`, versioned via `dbVersion` — bumping it wipes/upgrades stores) exposing `putOne/getOne/getAll/getOneWithIndex/getAllWithIndex/deleteOne/deleteMany/clearStore`. Four object stores: `vehicles`, `maintenanceItems` (indexed by `vehicleKey`), `serviceHistory` (indexed by `itemKey`), `mileageHistory` (indexed by `vehicleKey`). Per-store modules in `js/local-db/` (`vehicle-db.js`, `maintenance-db.js`, `service-db.js`, `mileage-db.js`, `backup-db.js`) wrap these generic functions with typed, store-specific calls. `backup-db.js` reads/writes *all* stores at once for JSON export/import (`exportAllData`/`restoreAllData`), reviving Date fields on import since JSON round-trips them to strings. `seed.js` can populate fake data for local testing (invoked manually from `app.js`, normally commented out).
- **UI** (`js/ui/*`): one module per feature area (`vehicle-ui.js`, `maintenance-ui.js`, `service-ui.js`, `mileage-ui.js`, `backup-ui.js`, `report-ui.js`) plus `ui.js` which wires up global button handlers and a single delegated click listener on `#app` keyed off `data-click-action` (see the `switch` in `initUi()` for the action → handler map — add new click actions there rather than attaching ad hoc listeners). `backup-ui.js` wires the footer's Exportar/Importar buttons to `backup-db.js`. `report-ui.js` builds a standalone printable HTML report of a vehicle's full history and shares it via the Web Share API (falls back to opening it in a new tab).
- **DOM helpers** (`js/lib/dom.js`): `$`/`$queryOne`/`$new`/`$button` etc. are the only way elements get created/queried — no direct `document.*` calls elsewhere. `$button()` builds the standard button markup (icon/label/overlay) used everywhere for visual consistency.
- **PWA/offline** (`cacheServiceWorker.js`, `js/initializeCache.js`): app-shell caching with a version banner (`#updateBanner`) prompting the user to refresh when a new cache version is deployed. `js/lib/badge.js` sets the installed PWA's home-screen icon badge (Badging API, feature-detected) to the combined overdue+due-soon maintenance count across all vehicles.
- **Due-item notifications** (`js/lib/notifications.js`, `js/ui/notifications-ui.js`): local (not server-pushed) notifications — there's no backend data API, so nothing server-side can know when an item becomes due. `notifyDueItemsOnce()` is called from `renderVehicleChips()` (same place `setAppBadge` is called) and shows a notification via `ServiceWorkerRegistration.showNotification` at most once per calendar day, throttled via a `localStorage` date stamp. `notifications-ui.js` adds the footer's "Activar notificaciones" button (`Notification.requestPermission()`, must run from a user gesture) and reflects granted/denied/default state in the button label. `cacheServiceWorker.js` has a `notificationclick` handler that focuses/opens the app. Only fires while the app is actually open/running (on load or whenever the vehicle chips re-render) — it cannot wake the app from fully closed, since that needs real server-triggered Web Push, which isn't compatible with this app's local-first/no-data-API design.
- **Maintenance status** (`js/lib/maintenanceStatus.js`): `computeStatus()` is the single source of truth for a maintenance item's `ok`/`due-soon`/`overdue` state; `STATUS_LABELS` (Spanish labels) and `formatDueDetail`/`formatRemindersBanner` are shared by the item rows, the single-item view, the maintenance-list reminders banner, and the shareable report — reuse these rather than re-deriving status elsewhere.
- **CSS** (`frontend/css/`): plain CSS, no preprocessor, split by concern (`style.css` base/layout, `classes.css` utility classes, `btn.css`, `input.css`, `service.css`, `vehicle-chips.css`, `toast.css`, `logger.css`, `cache-control.css`, `reminders.css`), all linked directly in `index.html`. View switching (`MaintenanceList` vs `SingleItem`) and form/modal visibility are driven by `data-*` attribute selectors matching `appState` fields set via `setStateField`, not by JS show/hide toggling classes per element.
- **Language**: all user-facing strings (labels, placeholders, button text) are in Spanish (`lang="es"` in `index.html`); keep new UI text consistent with that.

## Session handoff (2026-08-12, branch `feat/due-soon_json-bkp_history-report`)

Just implemented, tested end-to-end with Playwright (no console errors, backup/restore round-trip verified), not yet pushed:
- Due-soon reminders: banner atop the maintenance list + PWA icon badge.
- JSON backup/restore: footer buttons, full-database export/import.
- Shareable vehicle history report: standalone HTML, share sheet / new tab.
- Local (not server-pushed) notifications for due items: footer "Activar notificaciones" button, throttled to once/day. See `js/lib/notifications.js`. Tested end-to-end with Playwright (headed Chromium + `context.grantPermissions`, since headless Chromium always reports `Notification.permission` as `denied`) — permission flow, notification firing, and the once-per-day throttle all verified, no console errors.

Brainstormed but **not** implemented — good candidates for next session: device-to-device sync with no backend (WebRTC pairing), camera receipt OCR, voice-logged mileage, fuel economy tracking, cost analytics, multi-vehicle comparison dashboard.

(Delete this section once you're caught up on the other device — it's a handoff note, not durable doc.)
