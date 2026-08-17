import { expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { addAllowedEmail } from '../../../backend/src/db/allowedEmails.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Matches DB_NAME in playwright.config.js's webServer.env - the e2e suite's
// own database file, isolated from whatever a manually-run dev server uses.
const DB_PATH = join(__dirname, '../../../backend/data/cartrack.test.db');

/**
 * Whitelists a test email so the backend's signup allow-list doesn't reject
 * it. Opens its own short-lived connection rather than the backend's
 * src/db/db.js singleton, since that module is meant to live for the server
 * process's lifetime, not the test runner's.
 * @param {string} email
 */
function allowTestEmail(email) {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA busy_timeout = 5000');
  try {
    addAllowedEmail(db, email);
  } finally {
    db.close();
  }
}

/**
 * Signs up (never logs in) if the app is showing the auth screen. Every test
 * starts from a fresh browser context (empty IndexedDB, no cached session),
 * so this always runs on the very first navigation. Always creates a brand
 * new account with a unique email - the backend's sqlite file is NOT reset
 * between test runs the way a fresh context resets IndexedDB, so test
 * isolation has to come from the email being unique, not from a clean DB.
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string, password?: string }} [opts]
 */
async function ensureAuth(page, { email, password = 'e2e-test-password' } = {}) {
  const emailInput = page.locator('#authForm input[name="authEmail"]');
  if (!(await emailInput.isVisible().catch(() => false))) { return; }

  const uniqueEmail = email || `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  allowTestEmail(uniqueEmail);

  // The form opens in login mode (no name field) - switch to signup first.
  await page.click('#authModeToggle');
  await emailInput.fill(uniqueEmail);
  await page.fill('#authForm input[name="authPassword"]', password);
  await page.getByRole('button', { name: 'Crear Cuenta' }).click();
  await page.waitForSelector('#authForm', { state: 'hidden' });
}

/**
 * Navigates to the app and waits for IndexedDB + the service worker to be
 * ready, so subsequent actions don't race the app's async startup.
 * @param {import('@playwright/test').Page} page
 */
async function gotoApp(page) {
  await page.goto('/');
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return true;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && !!reg.active;
  });
}

/**
 * Completes the onboarding "new vehicle" form. Every Playwright test gets a
 * fresh, isolated browser context (no IndexedDB from prior tests), so this
 * form is expected to be open automatically on first navigation, right
 * after signing up.
 * @param {import('@playwright/test').Page} page
 * @param {{ name?: string, mileage?: number }} [options]
 */
async function createFirstVehicle(page, { name = 'Auto de prueba', mileage = 10000 } = {}) {
  await gotoApp(page);
  await ensureAuth(page);
  await page.fill('input[name="vehicleName"]', name);
  await page.fill('input[name="vehicleMileage"]', String(mileage));
  await page.getByRole('button', { name: 'Agregar Vehículo' }).click();
  await expect(page.locator('#maintenanceListView')).toBeVisible();
}

/**
 * Creates a maintenance item via the "+" button and item form. Assumes a
 * vehicle is already active (see `createFirstVehicle`).
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   name: string,
 *   intervalKm?: number,
 *   intervalDays?: number,
 *   lastServiceMileage?: number,
 *   lastServiceDate?: string,
 * }} options
 */
async function createMaintenanceItem(page, { name, intervalKm, intervalDays, lastServiceMileage, lastServiceDate }) {
  await page.click('#newItemBtn');
  await page.waitForSelector('#itemForm input[name="itemName"]', { state: 'visible' });
  await page.fill('input[name="itemName"]', name);
  if (intervalKm != null) { await page.fill('input[name="intervalKm"]', String(intervalKm)); }
  if (intervalDays != null) { await page.fill('input[name="intervalDays"]', String(intervalDays)); }
  if (lastServiceMileage != null) { await page.fill('input[name="lastServiceMileage"]', String(lastServiceMileage)); }
  if (lastServiceDate != null) { await page.fill('input[name="lastServiceDate"]', lastServiceDate); }
  await page.getByRole('button', { name: 'Crear Mantenimiento' }).click();
  await expect(page.locator('#itemForm')).toBeHidden();
}

/** @returns {string} today's date minus `days`, as "YYYY-MM-DD" */
function daysAgoInputValue(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export { gotoApp, ensureAuth, allowTestEmail, createFirstVehicle, createMaintenanceItem, daysAgoInputValue };
