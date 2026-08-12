import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStatus, formatDueDetail, formatRemindersBanner, STATUS_LABELS,
} from '../../js/lib/maintenanceStatus.js';


describe('computeStatus', () => {
  test('is "ok" when both km and day intervals still have plenty of room', () => {
    const item = { intervalKm: 10000, intervalDays: 365, lastServiceMileage: 10000, lastServiceDate: new Date(2026, 0, 1) };
    const result = computeStatus(item, 12000, new Date(2026, 1, 1));
    assert.equal(result.status, 'ok');
    assert.equal(result.kmRemaining, 8000);
    assert.equal(result.daysRemaining, 334);
  });

  test('is "due-soon" when within DUE_SOON_KM (500km) of the km interval', () => {
    const item = { intervalKm: 10000, intervalDays: null, lastServiceMileage: 10000, lastServiceDate: null };
    const result = computeStatus(item, 19600, new Date());
    assert.equal(result.status, 'due-soon');
    assert.equal(result.kmRemaining, 400);
  });

  test('is "due-soon" when within DUE_SOON_DAYS (14 days) of the day interval', () => {
    const item = { intervalKm: null, intervalDays: 30, lastServiceMileage: null, lastServiceDate: new Date(2026, 0, 1) };
    const result = computeStatus(item, 0, new Date(2026, 0, 20));
    assert.equal(result.status, 'due-soon');
    assert.equal(result.daysRemaining, 11);
  });

  test('is "overdue" once the km interval has elapsed', () => {
    const item = { intervalKm: 10000, intervalDays: null, lastServiceMileage: 10000, lastServiceDate: null };
    const result = computeStatus(item, 20001, new Date());
    assert.equal(result.status, 'overdue');
    assert.equal(result.kmRemaining, -1);
  });

  test('is "overdue" once the day interval has elapsed, even if km remaining is fine', () => {
    const item = { intervalKm: 10000, intervalDays: 30, lastServiceMileage: 0, lastServiceDate: new Date(2026, 0, 1) };
    const result = computeStatus(item, 100, new Date(2026, 1, 1));
    assert.equal(result.status, 'overdue');
    assert.ok(result.kmRemaining > 0, 'km remaining should still be positive');
  });

  test('due EITHER by km or by days, not requiring both', () => {
    const kmOnlyOverdue = computeStatus(
      { intervalKm: 5000, intervalDays: null, lastServiceMileage: 0, lastServiceDate: null },
      5001,
      new Date(),
    );
    assert.equal(kmOnlyOverdue.status, 'overdue');

    const daysOnlyOverdue = computeStatus(
      { intervalKm: null, intervalDays: 30, lastServiceMileage: null, lastServiceDate: new Date(2026, 0, 1) },
      0,
      new Date(2026, 1, 5),
    );
    assert.equal(daysOnlyOverdue.status, 'overdue');
  });

  test('kmRemaining/daysRemaining are null when the item has no interval configured for that dimension', () => {
    const result = computeStatus({ intervalKm: null, intervalDays: null, lastServiceMileage: null, lastServiceDate: null }, 100, new Date());
    assert.equal(result.status, 'ok');
    assert.equal(result.kmRemaining, null);
    assert.equal(result.daysRemaining, null);
  });

  test('day-based due date ignores time-of-day (only whole calendar days count)', () => {
    const lastServiceDate = new Date(2026, 0, 1, 23, 59);
    const item = { intervalKm: null, intervalDays: 10, lastServiceMileage: null, lastServiceDate };
    const currentDate = new Date(2026, 0, 11, 0, 1);
    const result = computeStatus(item, 0, currentDate);
    assert.equal(result.daysRemaining, 0);
    assert.equal(result.status, 'overdue');
  });
});

describe('formatDueDetail', () => {
  test('formats remaining km/days as "en X km / en Y días"', () => {
    // Km is grouped via Number.toLocaleString('es'), whose separator can vary
    // by ICU data across environments — derive the expected fragment the same
    // way rather than hard-coding a separator that may not match here.
    const expectedKm = (2300).toLocaleString('es');
    assert.equal(formatDueDetail({ kmRemaining: 2300, daysRemaining: 12 }), `en ${expectedKm} km / en 12 días`);
  });

  test('formats overdue km/days as "vencido hace X km / hace Y días"', () => {
    assert.equal(formatDueDetail({ kmRemaining: -50, daysRemaining: -3 }), 'vencido hace 50 km / vencido hace 3 días');
  });

  test('omits a dimension entirely when it is null', () => {
    assert.equal(formatDueDetail({ kmRemaining: 100, daysRemaining: null }), 'en 100 km');
    assert.equal(formatDueDetail({ kmRemaining: null, daysRemaining: 5 }), 'en 5 días');
  });

  test('falls back to "Sin datos" when both dimensions are null', () => {
    assert.equal(formatDueDetail({ kmRemaining: null, daysRemaining: null }), 'Sin datos');
  });
});

describe('formatRemindersBanner', () => {
  test('pluralizes "vencido(s)" correctly', () => {
    assert.equal(formatRemindersBanner(1, 0), '1 vencido');
    assert.equal(formatRemindersBanner(2, 0), '2 vencidos');
  });

  test('joins overdue and due-soon counts with " · "', () => {
    assert.equal(formatRemindersBanner(2, 1), '2 vencidos · 1 por vencer');
  });

  test('returns an empty string when there is nothing to report', () => {
    assert.equal(formatRemindersBanner(0, 0), '');
  });
});

test('STATUS_LABELS covers all three statuses with Spanish labels', () => {
  assert.deepEqual(STATUS_LABELS, { ok: 'Al día', 'due-soon': 'Por vencer', overdue: 'Vencido' });
});
