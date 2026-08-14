import { test, expect } from '@playwright/test';
import { createFirstVehicle } from './helpers.js';

/**
 * Headless Chromium has no real microphone/network path for actual speech
 * recognition (and no consistent way to fake real audio input). We replace
 * window.SpeechRecognition/webkitSpeechRecognition with a controllable fake
 * before any app script runs — same approach as notifications.spec.js's
 * Notification stub — and expose the live instance on
 * window.__lastSpeechRecognition so tests can fire onresult/onerror/onend
 * directly, keeping this deterministic and headless-friendly.
 */
async function stubSpeechRecognition(page) {
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      constructor() {
        // @ts-ignore
        window.__lastSpeechRecognition = this;
      }
      start() { /* no-op; tests trigger the callbacks manually */ }
      stop() { if (this.onend) { this.onend(); } }
    }
    // @ts-ignore
    window.SpeechRecognition = FakeSpeechRecognition;
    // @ts-ignore
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} transcript
 */
async function fireSpeechResult(page, transcript) {
  await page.evaluate(t => {
    // @ts-ignore
    const rec = window.__lastSpeechRecognition;
    rec.onresult({ results: [[{ transcript: t }]] });
    rec.onend();
  }, transcript);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} errorCode
 */
async function fireSpeechError(page, errorCode) {
  await page.evaluate(code => {
    // @ts-ignore
    const rec = window.__lastSpeechRecognition;
    rec.onerror({ error: code });
    rec.onend();
  }, errorCode);
}

test.beforeEach(async ({ page }) => {
  await stubSpeechRecognition(page);
});

test('mic button is visible when the Web Speech API is available', async ({ page }) => {
  await createFirstVehicle(page);
  await page.click('#logMileageBtn');
  await expect(page.locator('#voiceMileageBtn')).toBeVisible();
});

test('dictating a Spanish number fills the mileage input and shows a confirmation', async ({ page }) => {
  await createFirstVehicle(page, { mileage: 10000 });
  await page.click('#logMileageBtn');
  await page.waitForSelector('#mileageForm', { state: 'visible' });

  await page.click('#voiceMileageBtn');
  await expect(page.locator('.voice-status')).toHaveText('Escuchando…');

  await fireSpeechResult(page, 'cincuenta mil trescientos kilómetros');

  await expect(page.locator('input[name="mileage"]')).toHaveValue('50300');
  await expect(page.locator('.voice-status')).toContainText('50.300 km');
});

test('submitting the dictated value updates the vehicle mileage', async ({ page }) => {
  await createFirstVehicle(page, { mileage: 10000 });
  await page.click('#logMileageBtn');
  await page.waitForSelector('#mileageForm', { state: 'visible' });

  await page.click('#voiceMileageBtn');
  await fireSpeechResult(page, 'quince mil');
  await page.click('#mileageForm .submit .btn');

  await expect(page.locator('.vehicle-summary .mileage .value')).toHaveText('15.000');
});

test('an unrecognized transcript shows an error and leaves the input untouched', async ({ page }) => {
  await createFirstVehicle(page, { mileage: 10000 });
  await page.click('#logMileageBtn');
  await page.waitForSelector('#mileageForm', { state: 'visible' });

  await page.click('#voiceMileageBtn');
  await fireSpeechResult(page, 'no se entendió nada de esto');

  await expect(page.locator('input[name="mileage"]')).toHaveValue('10000');
  await expect(page.locator('.voice-status')).toContainText('No se entendió');
});

test('a speech recognition error shows a friendly message', async ({ page }) => {
  await createFirstVehicle(page, { mileage: 10000 });
  await page.click('#logMileageBtn');
  await page.waitForSelector('#mileageForm', { state: 'visible' });

  await page.click('#voiceMileageBtn');
  await fireSpeechError(page, 'no-speech');

  await expect(page.locator('.voice-status')).toHaveText('No se detectó voz. Probá de nuevo.');
});

test('reopening the mileage form clears a stale status message from a previous attempt', async ({ page }) => {
  await createFirstVehicle(page, { mileage: 10000 });
  await page.click('#logMileageBtn');
  await page.waitForSelector('#mileageForm', { state: 'visible' });

  await page.click('#voiceMileageBtn');
  await fireSpeechError(page, 'no-speech');
  await expect(page.locator('.voice-status')).not.toHaveText('');

  await page.click('.close-modal');
  await page.click('#logMileageBtn');

  await expect(page.locator('.voice-status')).toHaveText('');
});
