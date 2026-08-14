import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeCostBreakdown, formatMonthLabel } from '../../js/lib/costAnalytics.js';


describe('computeCostBreakdown', () => {
  test('sums total cost across entries', () => {
    const result = computeCostBreakdown([
      { itemName: 'Cambio de aceite', cost: 100, date: new Date(2026, 0, 5) },
      { itemName: 'Rotación de neumáticos', cost: 50, date: new Date(2026, 0, 10) },
    ]);
    assert.equal(result.total, 150);
  });

  test('groups by item name, sorted highest spend first', () => {
    const result = computeCostBreakdown([
      { itemName: 'Aceite', cost: 100, date: new Date(2026, 0, 1) },
      { itemName: 'Frenos', cost: 300, date: new Date(2026, 0, 2) },
      { itemName: 'Aceite', cost: 50, date: new Date(2026, 1, 1) },
    ]);
    assert.deepEqual(result.byItem, [
      { name: 'Frenos', total: 300 },
      { name: 'Aceite', total: 150 },
    ]);
  });

  test('groups by month key, sorted chronologically regardless of input order', () => {
    const result = computeCostBreakdown([
      { itemName: 'A', cost: 10, date: new Date(2026, 2, 1) }, // 2026-03
      { itemName: 'B', cost: 20, date: new Date(2026, 0, 1) }, // 2026-01
      { itemName: 'C', cost: 30, date: new Date(2026, 0, 15) }, // 2026-01, same month as B
    ]);
    assert.deepEqual(result.byMonth, [
      { month: '2026-01', total: 50 },
      { month: '2026-03', total: 10 },
    ]);
  });

  test('skips entries with no cost, zero cost, or negative cost', () => {
    const result = computeCostBreakdown([
      { itemName: 'A', cost: undefined, date: new Date(2026, 0, 1) },
      { itemName: 'B', cost: null, date: new Date(2026, 0, 1) },
      { itemName: 'C', cost: 0, date: new Date(2026, 0, 1) },
      { itemName: 'D', cost: -5, date: new Date(2026, 0, 1) },
      { itemName: 'E', cost: 40, date: new Date(2026, 0, 1) },
    ]);
    assert.equal(result.total, 40);
    assert.deepEqual(result.byItem, [{ name: 'E', total: 40 }]);
  });

  test('returns zeroed/empty breakdown for no entries', () => {
    const result = computeCostBreakdown([]);
    assert.equal(result.total, 0);
    assert.deepEqual(result.byItem, []);
    assert.deepEqual(result.byMonth, []);
  });
});

describe('formatMonthLabel', () => {
  // The exact Spanish phrasing (e.g. "marzo de 2026" vs "marzo 2026") depends
  // on ICU data, which can vary by environment — same caveat as date.test.js's
  // km-separator note. Derive the expected label the same way rather than
  // hard-coding it, and just check the capitalization transform + that the
  // right month/year come out (guards the classic month-index off-by-one bug).
  const expectedLabel = (year, monthIndex) => {
    const raw = new Date(year, monthIndex, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  test('capitalizes the first letter of the locale-formatted label', () => {
    assert.equal(formatMonthLabel('2026-03'), expectedLabel(2026, 2));
  });

  test('handles January correctly (month index 0 off-by-one is the classic bug here)', () => {
    assert.equal(formatMonthLabel('2026-01'), expectedLabel(2026, 0));
  });

  test('handles December correctly', () => {
    assert.equal(formatMonthLabel('2026-12'), expectedLabel(2026, 11));
  });
});
