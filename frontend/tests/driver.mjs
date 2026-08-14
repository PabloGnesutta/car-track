#!/usr/bin/env node
/**
 * Driver for CarTrack (backend/ + frontend/, one deployable web app).
 *
 * Lives here (not under .claude/skills/) because it needs @playwright/test,
 * which is only installed in frontend/node_modules — Node resolves bare
 * imports relative to the importing file's location, not cwd, so this file
 * has to sit inside frontend/ to find it at all. See
 * .claude/skills/run-car-track/SKILL.md for how it's used.
 *
 * Launches the real backend (a hand-rolled Node static file server), drives
 * a real Chromium via Playwright, and exercises one full user flow:
 * onboarding -> create vehicle -> create maintenance item -> open it ->
 * screenshot each step.
 *
 * Usage (run from frontend/):
 *   node tests/driver.mjs
 *   node tests/driver.mjs --headed        # see the browser
 *   node tests/driver.mjs --out <dir>     # screenshot dir (default: OS temp)
 *
 * Exit code is non-zero if any console error was observed in the page, or
 * if the flow itself threw.
 */

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { TEST_PORT } from './testPort.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = join(__dirname, '../../backend');
const BASE_URL = `http://localhost:${TEST_PORT}`;

const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx !== -1 ? args[outIdx + 1] : join(tmpdir(), 'cartrack-driver-screenshots');
mkdirSync(OUT_DIR, { recursive: true });

/** Spawns `npm run serve` in backend/ and resolves once it's actually answering HTTP requests. */
async function startBackend() {
  const proc = spawn('npm run serve', {
    cwd: BACKEND_DIR,
    shell: true,
    stdio: 'pipe',
  });
  proc.stdout.on('data', d => { if (process.env.DRIVER_VERBOSE) { console.log('[backend]', d.toString().trim()); } });
  proc.stderr.on('data', d => console.error('[backend:err]', d.toString().trim()));

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL + '/');
      if (res.ok) { return proc; }
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 300));
  }
  proc.kill();
  throw new Error(`Backend did not respond on ${BASE_URL} within 15s`);
}

/**
 * `shell: true` on Windows spawns a wrapper (cmd.exe) whose child
 * (node/nodemon) survives a plain proc.kill() — same story on POSIX once
 * nodemon forks. taskkill /T kills the whole tree; SIGKILL is the POSIX path.
 */
function stopBackend(proc) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F']);
  } else {
    proc.kill('SIGKILL');
  }
}

/**
 * Fills the onboarding "new vehicle" form, which opens automatically on
 * first launch (fresh IndexedDB — every new browser context starts empty).
 */
async function createFirstVehicle(page, { name = 'Auto de prueba', mileage = 45000 } = {}) {
  await page.waitForSelector('#vehicleForm', { state: 'visible' });
  await page.fill('input[name="vehicleName"]', name);
  await page.fill('input[name="vehicleMileage"]', String(mileage));
  await page.click('#vehicleForm .submit .btn');
  await page.waitForSelector('#maintenanceListView .empty-state');
}

/** Creates a maintenance item via the "+" FAB. Assumes a vehicle is active. */
async function createMaintenanceItem(page, { name, intervalKm, lastServiceMileage }) {
  await page.click('#newItemBtn');
  await page.waitForSelector('#itemForm', { state: 'visible' });
  await page.fill('input[name="itemName"]', name);
  if (intervalKm != null) { await page.fill('input[name="intervalKm"]', String(intervalKm)); }
  if (lastServiceMileage != null) { await page.fill('input[name="lastServiceMileage"]', String(lastServiceMileage)); }
  await page.click('#itemForm .submit .btn');
  await page.waitForSelector('#itemForm', { state: 'hidden' });
}

async function main() {
  const consoleErrors = [];
  let step = 0;
  const shot = async (page, label) => {
    step += 1;
    const path = join(OUT_DIR, `${String(step).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path });
    console.log('screenshot:', path);
    return path;
  };

  console.log(`Starting backend on ${BASE_URL} ...`);
  const backend = await startBackend();

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 420, height: 800 } });
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') { consoleErrors.push(msg.text()); } });
  page.on('pageerror', err => { consoleErrors.push(err.message); });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await shot(page, 'onboarding');

    await createFirstVehicle(page, { name: 'Honda Civic', mileage: 45000 });
    await shot(page, 'empty-list');

    await createMaintenanceItem(page, { name: 'Cambio de aceite', intervalKm: 5000, lastServiceMileage: 44800 });
    await page.waitForTimeout(200);
    await shot(page, 'list-with-item');

    await page.click('.row[data-item-key]');
    await page.waitForSelector('#singleItemView', { state: 'visible' });
    await shot(page, 'single-item');

    console.log('\nFlow completed successfully.');
  } finally {
    await browser.close();
    stopBackend(backend);
  }

  if (consoleErrors.length) {
    console.error('\nConsole errors observed:', consoleErrors);
    process.exitCode = 1;
  } else {
    console.log('\nNo console errors observed.');
  }
}

// Exported for reuse/extension by other driver scripts.
export { startBackend, stopBackend, createFirstVehicle, createMaintenanceItem, BASE_URL };

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(e => {
    console.error('DRIVER_FAILED:', e);
    process.exitCode = 1;
  });
}
