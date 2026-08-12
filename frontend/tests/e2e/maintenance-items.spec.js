import { test, expect } from '@playwright/test';
import { createFirstVehicle, createMaintenanceItem, daysAgoInputValue } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await createFirstVehicle(page, { name: 'Auto de prueba', mileage: 10000 });
});

test('a freshly-created item with a distant interval shows as "Al día"', async ({ page }) => {
  await createMaintenanceItem(page, { name: 'Rotación de neumáticos', intervalKm: 10000 });

  const row = page.locator('.row[data-item-key]');
  await expect(row).toHaveAttribute('data-status', 'ok');
  await expect(row.locator('.status-badge')).toHaveText('Al día');
  await expect(row.locator('.itemName')).toHaveText('Rotación de neumáticos');
});

test('an item whose day interval has already elapsed shows as overdue and raises the reminders banner', async ({ page }) => {
  await createMaintenanceItem(page, {
    name: 'Cambio de aceite',
    intervalDays: 1,
    lastServiceDate: daysAgoInputValue(30),
  });

  const row = page.locator('.row[data-item-key]');
  await expect(row).toHaveAttribute('data-status', 'overdue');
  await expect(row.locator('.status-badge')).toHaveText('Vencido');

  const banner = page.locator('#maintenanceListView .reminders-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('data-status', 'overdue');
  await expect(banner.locator('.reminders-text')).toHaveText('1 vencido');
});

test('an item within the due-soon window shows as "Por vencer", not overdue', async ({ page }) => {
  await createMaintenanceItem(page, {
    name: 'Filtro de aire',
    intervalDays: 30,
    lastServiceDate: daysAgoInputValue(20), // 10 days remaining, under the 14-day due-soon window
  });

  const row = page.locator('.row[data-item-key]');
  await expect(row).toHaveAttribute('data-status', 'due-soon');
  await expect(row.locator('.status-badge')).toHaveText('Por vencer');

  const banner = page.locator('#maintenanceListView .reminders-banner');
  await expect(banner).toHaveAttribute('data-status', 'due-soon');
  await expect(banner.locator('.reminders-text')).toHaveText('1 por vencer');
});

test('the reminders banner stays hidden when nothing is due', async ({ page }) => {
  await createMaintenanceItem(page, { name: 'Correa de distribución', intervalKm: 60000 });
  await expect(page.locator('#maintenanceListView .reminders-banner')).toBeHidden();
});

test('search filters the item list by name', async ({ page }) => {
  await createMaintenanceItem(page, { name: 'Cambio de aceite', intervalKm: 10000 });
  await createMaintenanceItem(page, { name: 'Rotación de neumáticos', intervalKm: 10000 });

  await page.fill('#searchItem', 'aceite');

  await expect(page.locator('.row:has-text("Cambio de aceite")')).toBeVisible();
  await expect(page.locator('.row:has-text("Rotación de neumáticos")')).toHaveClass(/display-none/);
});

test('opening a single item shows its detail view', async ({ page }) => {
  await createMaintenanceItem(page, { name: 'Cambio de aceite', intervalKm: 10000, lastServiceMileage: 10000 });

  await page.click('.row[data-item-key]');

  await expect(page.locator('#singleItemView .name')).toHaveText('Cambio de aceite');
  await expect(page.locator('#singleItemView .status-badge')).toHaveText('Al día');
});
