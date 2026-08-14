import { test, expect } from '@playwright/test';
import { createFirstVehicle, createMaintenanceItem } from './helpers.js';

test('exported backup is a JSON file containing the vehicle and its maintenance items', async ({ page }) => {
  await createFirstVehicle(page, { name: 'Auto de prueba', mileage: 10000 });
  await createMaintenanceItem(page, { name: 'Cambio de aceite', intervalKm: 10000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar datos' }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^cartrack-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) { chunks.push(chunk); }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  expect(data.vehicles).toHaveLength(1);
  expect(data.vehicles[0].name).toBe('Auto de prueba');
  expect(data.maintenanceItems).toHaveLength(1);
  expect(data.maintenanceItems[0].name).toBe('Cambio de aceite');
});

test('export then import round-trips the data (survives the confirm/alert dialogs and reload)', async ({ page }) => {
  await createFirstVehicle(page, { name: 'Original', mileage: 10000 });
  await createMaintenanceItem(page, { name: 'Cambio de aceite', intervalKm: 10000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar datos' }).click(),
  ]);
  const backupPath = await download.path();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(backupPath);

  // Custom confirm dialog (replaces the native confirm()) for the destructive "replace all data" warning.
  await page.waitForSelector('#confirmDialog.show');
  await page.click('#confirmDialog .confirm-ok .btn');

  // Custom alert dialog (replaces the native alert()) for the success message, then the page reloads.
  await page.waitForSelector('#confirmDialog.show');
  await Promise.all([
    page.waitForEvent('load'),
    page.click('#confirmDialog .confirm-ok .btn'),
  ]);

  await expect(page.locator('.vehicle-chip.active .vehicleName')).toHaveText('Original');
  await expect(page.locator('.row:has-text("Cambio de aceite")')).toBeVisible();
});
