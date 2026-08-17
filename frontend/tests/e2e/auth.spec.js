import { test, expect } from '@playwright/test';
import { gotoApp, allowTestEmail } from './helpers.js';

/**
 * Onboarding's vehicle-creation modal blocks dismissal (and covers the
 * footer, where the logout button lives) until a first vehicle exists - so
 * any test that needs to reach the footer post-signup has to clear
 * onboarding first.
 * @param {import('@playwright/test').Page} page
 */
async function completeOnboarding(page) {
  await page.fill('input[name="vehicleName"]', 'Auto de prueba');
  await page.fill('input[name="vehicleMileage"]', '10000');
  await page.getByRole('button', { name: 'Agregar Vehículo' }).click();
  await expect(page.locator('#maintenanceListView')).toBeVisible();
}

test('signup succeeds for a whitelisted email and reaches onboarding', async ({ page }) => {
  await gotoApp(page);
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  allowTestEmail(email);

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'e2e-test-password');
  await page.getByRole('button', { name: 'Crear Cuenta' }).click();

  await expect(page.locator('#authForm')).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-onboarding', 'true');
});

test('signup is rejected for a non-whitelisted email', async ({ page }) => {
  await gotoApp(page);
  const email = `not-allowed-${Date.now()}@test.local`;

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'e2e-test-password');
  await page.getByRole('button', { name: 'Crear Cuenta' }).click();

  // Rejected server-side - stays on the auth screen, no account/session created.
  await expect(page.locator('#authForm')).toBeVisible();
  await expect(page.locator('#app')).not.toHaveAttribute('data-auth-stage', 'ready');
});

test('login with the wrong password is rejected', async ({ page }) => {
  await gotoApp(page);
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  allowTestEmail(email);

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'the-real-password');
  await page.getByRole('button', { name: 'Crear Cuenta' }).click();
  await expect(page.locator('#authForm')).toBeHidden();
  await completeOnboarding(page);

  // Log out, then try logging back in with the wrong password.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.locator('#authForm')).toBeVisible();

  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'a-wrong-password');
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  await expect(page.locator('#authForm')).toBeVisible();
});

test('logout returns to the auth screen and clears localStorage', async ({ page }) => {
  await gotoApp(page);
  const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  allowTestEmail(email);

  await page.click('#authModeToggle');
  await page.fill('#authForm input[name="authEmail"]', email);
  await page.fill('#authForm input[name="authPassword"]', 'e2e-test-password');
  await page.getByRole('button', { name: 'Crear Cuenta' }).click();
  await expect(page.locator('#authForm')).toBeHidden();
  await completeOnboarding(page);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page.locator('#authForm')).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  expect(token).toBeNull();
});
