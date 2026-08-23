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
There is no `npm install` step tracked beyond what's already in `backend/node_modules`; there are no lint or build scripts in either `backend/` or `frontend/`.

Frontend has no build step — it's plain ES modules loaded directly by the browser (`<script type="module">` in `frontend/index.html`). Serve it either via the backend (`npm run serve`, uses `frontend/` as `PUBLIC_DIR`) or via VS Code Live Server (`.vscode/settings.json` sets `liveServer.settings.port`). It does have a `package.json`, but only for test tooling (see below) — the shipped app still has zero dependencies/bundler.

Tests (`frontend/`):
```
cd frontend
npm install        # one-time, pulls in @playwright/test
npm test           # unit tests, then e2e (starts/stops the backend itself)
npm run test:unit  # tests/unit/ — Node's built-in test runner (node --test), no browser, no deps
npm run test:e2e   # tests/e2e/ — Playwright against a real browser + IndexedDB + service worker
```
- **Unit tests** cover pure-logic modules with no DOM dependency: `maintenanceStatus.js` (`computeStatus` — the status source of truth), `date.js`, `string.js`, `backupValidation.js`, `costAnalytics.js`, `fuelEconomy.js`, `spanishNumbers.js`. Modules that import `lib/logger.js` (directly, or transitively via `lib/indexedDb.js`) can't be unit-tested this way — it touches `document`/`window` at module scope (real DOM elements, `window.onerror`), so importing it outside a browser throws; that's why `backup-db.js`'s validation/date-revival logic lives in the dependency-free `backupValidation.js` instead of inline. Those are covered by e2e tests instead, not by e.g. jsdom-stubbing logger.js's DOM calls.
- **E2e tests** (`playwright.config.js`) spin up the real backend (`webServer` config) and drive Chromium. Each test gets a fresh, isolated browser context, so IndexedDB starts empty every time — no manual cleanup between tests. `workers: 2` and a `globalSetup` warm-up (`tests/e2e/global-setup.js`) are both there because the backend is a minimal hand-rolled static file server with no caching: a cold burst of concurrent requests from more/unwarmed workers reliably times out the first test or two. Bump workers back up if the backend ever gets a real static-file layer. The e2e backend runs on its own port and its own sqlite file (`tests/testPort.js`'s `TEST_PORT`, and `DB_NAME=cartrack.test.db` passed via `webServer.env` in `playwright.config.js`), deliberately isolated from a manually-run `npm run serve` (which uses `backend/.env`'s `PORT` and the default `cartrack.db`) — they used to share both, so resetting the e2e database for a clean run (or Playwright's `reuseExistingServer` picking up whatever was already listening) could wipe or hijack real local dev/test data. `tests/e2e/helpers.js`'s `allowTestEmail`/`global-teardown.js` open `cartrack.test.db` directly and must be kept in sync with `DB_NAME` if it ever changes.
- Headless Chromium always reports `Notification.permission` as `"denied"` and ignores `context.grantPermissions(['notifications'])` — a known headless-mode limitation, not a bug in the app. `tests/e2e/notifications.spec.js` works around it by replacing `window.Notification` with a controllable fake via `page.addInitScript` before the app loads, and by recording (rather than letting through) calls to `ServiceWorkerRegistration.showNotification`, so the suite stays headless-friendly and deterministic.

**Local dev caveat**: `frontend/cacheServiceWorker.js` serves everything cache-first, so a browser tab left open while editing keeps serving the pre-last-commit cached version. Use devtools' "Disable cache" (or Application tab → Service Workers → "Update on reload") while iterating, or flip `cacheServiceWorker.js`'s `BYPASS_CACHE` to `true` locally (never commit it that way — see "Service worker caching" below and `frontend/js/README.md`).

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
- **Persistence** (`js/lib/indexedDb.js` + `js/local-db/*`): IndexedDB wrapper (db name `CarTrack`, versioned via `dbVersion` — bumping it wipes/upgrades stores) exposing `putOne/getOne/getAll/getOneWithIndex/getAllWithIndex/deleteOne/deleteMany/clearStore`. Five object stores: `vehicles`, `maintenanceItems` (indexed by `vehicleKey`), `serviceHistory` (indexed by `itemKey`), `mileageHistory` (indexed by `vehicleKey`), `fuelHistory` (indexed by `vehicleKey`). Per-store modules in `js/local-db/` (`vehicle-db.js`, `maintenance-db.js`, `service-db.js`, `mileage-db.js`, `fuel-db.js`, `backup-db.js`) wrap these generic functions with typed, store-specific calls. `backup-db.js` reads/writes *all* stores at once for JSON export/import (`exportAllData`/`restoreAllData`); its shape-validation and Date-revival logic lives in the dependency-free `js/lib/backupValidation.js` (see Tests below for why) — `fuelHistory` is treated as optional there so pre-fuel-tracking backups still import cleanly. `seed.js` can populate fake data for local testing (invoked manually from `app.js`, normally commented out).
- **UI** (`js/ui/*`): one module per feature area (`vehicle-ui.js`, `maintenance-ui.js`, `service-ui.js`, `mileage-ui.js`, `fuel-ui.js`, `backup-ui.js`, `report-ui.js`, `analytics-ui.js`, `confirm-ui.js`) plus `ui.js` which wires up global button handlers and a single delegated click listener on `#app` keyed off `data-click-action` (see the `switch` in `initUi()` for the action → handler map — add new click actions there rather than attaching ad hoc listeners). `backup-ui.js` wires the footer's export/import icon buttons to `backup-db.js`. `report-ui.js` builds a standalone printable HTML report of a vehicle's full history and shares it via the Web Share API (falls back to opening it in a new tab). `analytics-ui.js` aggregates service-record costs (see `js/lib/costAnalytics.js`) into a total/by-item/by-month breakdown shown in a modal. `fuel-ui.js` logs fill-ups and shows L/100km trend (see `js/lib/fuelEconomy.js` — assumes every fill-up tops off the tank, the standard simplifying assumption for computing efficiency from odometer readings alone). `confirm-ui.js` is an app-themed, Promise-based replacement for the native `confirm()`/`alert()` (`showConfirm`/`showAlert`) — use these instead of the native dialogs so destructive actions stay visually consistent; e2e tests interact with `#confirmDialog.show` + `.confirm-ok`/`.confirm-cancel .btn` rather than Playwright's `page.on('dialog', ...)`, since no native dialog ever fires.
- **DOM helpers** (`js/lib/dom.js`): `$`/`$queryOne`/`$new`/`$button` etc. are the only way elements get created/queried — no direct `document.*` calls elsewhere. `$button()` builds the standard button markup (icon/label/overlay) used everywhere for visual consistency.
- **PWA/offline** (`cacheServiceWorker.js`, `js/initializeCache.js`): cache-first app-shell caching (see "Service worker caching" below) with a version banner (`#updateBanner`) prompting the user to refresh when a new cache version is deployed. `js/lib/badge.js` sets the installed PWA's home-screen icon badge (Badging API, feature-detected) to the combined overdue+due-soon maintenance count across all vehicles. A shimmering `#loadingSkeleton` overlay (see `app.js`) covers the app until `IndexedDbInited` fires (or an 8s safety-net timeout elapses), instead of a blank flash.
- **Due-item notifications** (`js/lib/notifications.js`, `js/ui/notifications-ui.js`): local (not server-pushed) notifications — there's no backend data API, so nothing server-side can know when an item becomes due. `notifyDueItemsOnce()` is called from `renderVehicleChips()` (same place `setAppBadge` is called) and shows a notification via `ServiceWorkerRegistration.showNotification` at most once per calendar day, throttled via a `localStorage` date stamp. `notifications-ui.js` adds a footer button (`Notification.requestPermission()`, must run from a user gesture) whose label reflects granted/denied/default permission state. `cacheServiceWorker.js` has a `notificationclick` handler that focuses/opens the app. Only fires while the app is actually open/running (on load or whenever the vehicle chips re-render) — it cannot wake the app from fully closed, since that needs real server-triggered Web Push, which isn't compatible with this app's local-first/no-data-API design.
- **Maintenance status** (`js/lib/maintenanceStatus.js`): `computeStatus()` is the single source of truth for a maintenance item's `ok`/`due-soon`/`overdue` state; `STATUS_LABELS`, `statusBadgeHtml()` (icon+label, shared by the item rows and single-item view), and `formatDueDetail`/`formatRemindersBanner` are shared by the item rows, the single-item view, the maintenance-list reminders banner, and the shareable report — reuse these rather than re-deriving status elsewhere.
- **Haptics** (`js/lib/haptics.js`): `haptic(pattern?)` wraps the Vibration API, feature-detected/best-effort. Called on mark-serviced, item delete (including via swipe), and the confirm dialog's OK button — meaningful action-completed moments, not every tap.
- **Voice-logged mileage** (`js/lib/spanishNumbers.js`, `js/lib/speechRecognition.js`, `js/ui/voice-mileage-ui.js`): a mic button next to the mileage input (feature-detected, hidden where the Web Speech API is unsupported — Chromium-only, no Firefox, patchy Safari, and needs a secure context) dictates the reading instead of typing it. `parseSpanishNumber()` is the important part — it's a from-scratch Spanish number-word parser (digits, thousands-separated digits, and full word grammar up to millions, token-by-token so mixed digit/word transcripts work too) rather than trusting the speech engine's own formatting, and is kept dependency-free/pure for unit testing. The result always lands in the input for the user to review and confirm — it's never auto-submitted. Headless Chromium can't do real speech recognition (no mic/network path), so `tests/e2e/voice-mileage.spec.js` replaces `window.SpeechRecognition`/`webkitSpeechRecognition` with a controllable fake via `page.addInitScript`, same approach as the `Notification` stub in `notifications.spec.js`.
- **Page transitions**: `MaintenanceList`/`SingleItem` are both always in the DOM (`.views .page` is `position: absolute; inset: 0`); `SingleItem` slides in over the list from the right and back out again (native push/pop feel) rather than an instant `display: none` swap — see the "Views state" rules in `style.css`. `MaintenanceList` itself never moves. A side effect: `.views` now has a fixed height instead of growing with content, so the header/footer stay pinned and each page scrolls its own content internally (`.page { overflow-y: auto }`) instead of the whole document scrolling.
- **Swipe-to-act on maintenance rows**: each row is `.row` (outer, clips + positions two `.swipe-action` color layers) wrapping `.row-content` (the visible card, which translates on drag) — see the pointerdown/move/up handlers in `maintenance-ui.js`. Swiping right past the threshold opens the mark-as-serviced form; left past threshold deletes (existing undo toast). A plain tap (movement under the threshold) is left alone so normal click-navigation still fires. If you touch this, know that `#maintenanceListView .list .row`/`.row-content` intentionally override the *generic* `.list .row` rule used by the (unrelated, unwrapped) service/mileage/fuel history lists — don't merge them back together.
- **CSS** (`frontend/css/`): plain CSS, no preprocessor, split by concern (`style.css` base/layout, `classes.css` utility classes, `btn.css`, `input.css`, `service.css`, `vehicle-chips.css`, `toast.css`, `logger.css`, `cache-control.css`, `reminders.css`, `skeleton.css`, `confirm.css`, `analytics.css`), all linked directly in `index.html`. View switching and form/modal visibility are driven by `data-*` attribute selectors matching `appState` fields set via `setStateField`, not by JS show/hide toggling classes per element.
- **Language**: all user-facing strings (labels, placeholders, button text) are in Spanish (`lang="es"` in `index.html`); keep new UI text consistent with that.

## Service worker caching (`frontend/cacheServiceWorker.js`, `.githooks/pre-commit`)

Ported from the sibling `fridge-track`/`sonar` projects' own take on this same problem. Everything
the backend's static-asset paths serve (`index.html`, `css/**`, `js/**`, `static/**` — icons/
manifest.json/favicon.ico) is served **cache-first**: the app loads instantly from cache, network
is only hit on a cache miss. This used to be off entirely (an `INTERCEPT_FETCH_REQUESTS` flag,
permanently `false` since nothing ever flipped it before a release) specifically because a
hand-maintained cache version is easy to forget to bump — shipping stale cached JS to a real user
is worse than no caching at all. That risk is what's actually gone now, not the tradeoff being
ignored: the single cache's name embeds a version (`cacheVersion`, a `cacheServiceWorker.js`-top
const) that's a **content hash of exactly the files it covers, computed and written automatically
by `.githooks/pre-commit`** on every commit — never hand-maintained, so it can't be forgotten. One
cache (`appCache`), not split by file type like sonar's `jsCache`/`wavCache` — car-track has no
equivalent large-binary asset type worth a separate, longer-lived cache.

**One-time setup**: `.githooks/pre-commit` isn't `.git/hooks/pre-commit` (that directory isn't
tracked by git) — `frontend/package.json`'s `"prepare"` script runs `git config core.hooksPath
.githooks` automatically on `npm install`, so a normal `cd frontend && npm install` wires it up
with no extra step. (If that's ever skipped, running `git config core.hooksPath .githooks` from
anywhere inside the repo does the same thing by hand.)

**Local dev**: because the version only changes when the hook runs (i.e. on commit), a browser tab
left open while actively editing files *without* committing keeps serving the cache-first version
from before your last commit — the classic "PWA + service worker" dev annoyance, not something
specific to this setup. Standard mitigation: check "Disable cache" (or Application tab → Service
Workers → "Update on reload") in devtools while iterating, or flip `cacheServiceWorker.js`'s
`BYPASS_CACHE` to `true` locally (never commit it that way — it defeats cache-first serving for
real users).

`js/initializeCache.js`'s update banner is what actually gets an already-open client onto a new
version: it listens for the browser detecting that the `cacheServiceWorker.js` *script itself*
changed bytes (which it always does whenever the hook bumps `cacheVersion`, since that's literally
part of the script's own source), deletes stale caches, and prompts a refresh. This is a separate
detection path from `appCache`'s own cache-first serving — browsers already re-check a service
worker's script on every navigation regardless of caching strategy, so it doesn't depend on
`appCache` being fresh at all. On a genuinely first-ever install, `initializeCache.js` also does
one silent reload once the new service worker actually takes control (`controllerchange`) —
without that, this exact first visit's own page load never goes through the SW (nothing controlled
it yet), so offline support wouldn't start working until a separate, later visit.

The existing `notificationclick` handler (focuses/opens the app — see "Due-item notifications"
above) and the cache-first `fetch` handler are independent; neither depends on the other's state.

## Security

`backend/src/http/securityHeaders.js` exports `SECURITY_HEADERS` (CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), merged into every response in `requestHandler.js`/`httpResponses.js`. The CSP is strict (`default-src 'self'`, no `unsafe-inline`) because the app has zero inline scripts/styles and zero third-party resources — if you ever add either, the CSP will need loosening or the new code moved to be CSP-compliant (external `<script src>`/stylesheet, or `element.style.x = y` via the CSSOM which CSP doesn't restrict, rather than a `style="..."` attribute).
