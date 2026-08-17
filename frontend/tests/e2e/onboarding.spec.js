import { test, expect } from '@playwright/test';
import { gotoApp, ensureAuth, createFirstVehicle } from './helpers.js';

test('first launch opens the onboarding vehicle form and blocks dismissal', async ({ page }) => {
  await gotoApp(page);
  await ensureAuth(page);
  await expect(page.locator('#app')).toHaveAttribute('data-onboarding', 'true');
  await expect(page.locator('input[name="vehicleName"]')).toBeVisible();
});

test('creating the first vehicle opens the maintenance list with an empty state', async ({ page }) => {
  await createFirstVehicle(page, { name: 'Corolla', mileage: 45000 });

  await expect(page.locator('#app')).toHaveAttribute('data-onboarding', 'false');
  await expect(page.locator('.vehicle-chip.active .vehicleName')).toHaveText('Corolla');
  await expect(page.locator('#maintenanceListView .vehicle-summary .mileage .value')).toHaveText('45.000');
  await expect(page.locator('#maintenanceListView .list .empty-state')).toBeVisible();
});

test('console has no errors through onboarding', async ({ page }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') { errors.push(msg.text()); } });
  page.on('pageerror', err => errors.push(err.message));

  await createFirstVehicle(page);

  expect(errors).toEqual([]);
});
