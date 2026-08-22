import { test, expect } from '@playwright/test';
import { createFirstVehicle, createMaintenanceItem, daysAgoInputValue, clickHeaderMenuItem } from './helpers.js';

/**
 * Headless Chromium's real Notification backend always reports
 * `Notification.permission` as "denied" and can't be overridden via
 * context.grantPermissions (a known headless-mode limitation, verified while
 * writing this suite) — so a real permission prompt can't be driven headless.
 * We replace `window.Notification` with a controllable fake before any app
 * script runs, and later record (rather than let through) calls to the
 * service worker's `showNotification`, so this stays deterministic and fast
 * without needing a headed browser.
 */
async function stubNotificationApi(page) {
  await page.addInitScript(() => {
    let permission = 'default';
    // @ts-ignore
    window.Notification = {
      get permission() { return permission; },
      requestPermission: () => { permission = 'granted'; return Promise.resolve('granted'); },
    };
  });
}

async function spyOnShowNotification(page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore
    window.__shownNotifications = [];
    reg.showNotification = (title, options) => {
      // @ts-ignore
      window.__shownNotifications.push({ title, body: options && options.body });
      return Promise.resolve();
    };
  });
}

test.beforeEach(async ({ page }) => {
  await stubNotificationApi(page);
});

test('clicking the notifications menu item requests permission and updates its state', async ({ page }) => {
  await createFirstVehicle(page);

  const btn = page.locator('.notifications-toggle-btn');
  await expect(btn).toHaveAttribute('data-permission', 'default');
  await expect(btn).toHaveAttribute('aria-label', 'Activar notificaciones');

  await clickHeaderMenuItem(page, '.notifications-toggle-btn');

  await expect(btn).toHaveAttribute('data-permission', 'granted');
  await expect(btn).toHaveAttribute('aria-label', 'Notificaciones activadas');
});

test('granting permission with an overdue item shows a local notification, once per day', async ({ page }) => {
  await createFirstVehicle(page, { name: 'Auto de prueba' });
  await spyOnShowNotification(page);

  await createMaintenanceItem(page, {
    name: 'Cambio de aceite',
    intervalDays: 1,
    lastServiceDate: daysAgoInputValue(30),
  });

  // Granting permission re-renders the vehicle chips, which is what triggers the check
  await clickHeaderMenuItem(page, '.notifications-toggle-btn');

  await expect.poll(() => page.evaluate(() => window.__shownNotifications.length)).toBe(1);
  const shown = await page.evaluate(() => window.__shownNotifications[0]);
  expect(shown.title).toBe('Tenés mantenimiento vencido');
  expect(shown.body).toBe('Auto de prueba: 1 vencido');

  // Throttled: creating another overdue item the same day must not notify again
  await createMaintenanceItem(page, {
    name: 'Filtro de aire',
    intervalDays: 1,
    lastServiceDate: daysAgoInputValue(30),
  });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__shownNotifications.length)).toBe(1);
});

test('no notification is shown when nothing is due', async ({ page }) => {
  await createFirstVehicle(page);
  await spyOnShowNotification(page);

  await createMaintenanceItem(page, { name: 'Correa de distribución', intervalKm: 60000 });
  await clickHeaderMenuItem(page, '.notifications-toggle-btn');

  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__shownNotifications.length)).toBe(0);
});
