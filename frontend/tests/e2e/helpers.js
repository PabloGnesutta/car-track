import { expect } from '@playwright/test';

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
 * form is expected to be open automatically on first navigation.
 * @param {import('@playwright/test').Page} page
 * @param {{ name?: string, mileage?: number }} [options]
 */
async function createFirstVehicle(page, { name = 'Auto de prueba', mileage = 10000 } = {}) {
  await gotoApp(page);
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

export { gotoApp, createFirstVehicle, createMaintenanceItem, daysAgoInputValue };
