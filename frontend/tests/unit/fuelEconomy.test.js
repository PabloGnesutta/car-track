import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeFuelEfficiency, averageKmPerLiter, averageCostPerKm } from '../../js/lib/fuelEconomy.js';


describe('computeFuelEfficiency', () => {
  test('the first entry has no distance/efficiency (no prior reading to compare against)', () => {
    const points = computeFuelEfficiency([{ mileage: 10000, liters: 40, date: new Date(2026, 0, 1) }]);
    assert.equal(points.length, 1);
    assert.equal(points[0].distance, null);
    assert.equal(points[0].litersPer100Km, null);
  });

  test('computes L/100km as liters-at-fillup / distance-since-previous * 100', () => {
    const points = computeFuelEfficiency([
      { mileage: 10000, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 10500, liters: 45, date: new Date(2026, 0, 15) }, // 500km, 45L -> 9 L/100km
    ]);
    assert.equal(points[1].distance, 500);
    assert.equal(points[1].litersPer100Km, 9);
  });

  test('chains correctly across more than two fill-ups', () => {
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, date: new Date(2026, 0, 8) }, // 400km, 40L -> 10 L/100km
      { mileage: 1000, liters: 30, date: new Date(2026, 0, 20) }, // 600km, 30L -> 5 L/100km
    ]);
    assert.equal(points[1].litersPer100Km, 10);
    assert.equal(points[2].litersPer100Km, 5);
  });

  test('returns null efficiency (not Infinity/NaN) when mileage did not increase', () => {
    const points = computeFuelEfficiency([
      { mileage: 10000, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 10000, liters: 20, date: new Date(2026, 0, 5) }, // same mileage — odometer glitch/typo
    ]);
    assert.equal(points[1].distance, 0);
    assert.equal(points[1].litersPer100Km, null);
  });

  test('returns an empty array for no entries', () => {
    assert.deepEqual(computeFuelEfficiency([]), []);
  });
});

describe('averageKmPerLiter', () => {
  test('returns null when there is only one fill-up (nothing computable)', () => {
    const points = computeFuelEfficiency([{ mileage: 10000, liters: 40, date: new Date(2026, 0, 1) }]);
    assert.equal(averageKmPerLiter(points), null);
  });

  test('averages distance/liters across all fill-ups, not a plain mean of per-fillup values', () => {
    // 400km/40L (10 km/L) then 600km/30L (20 km/L) -> combined 1000km/70L ~ 14.29 km/L,
    // NOT the plain average of 10 and 20 (which would wrongly give 15).
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, date: new Date(2026, 0, 8) },
      { mileage: 1000, liters: 30, date: new Date(2026, 0, 20) },
    ]);
    assert.ok(Math.abs(averageKmPerLiter(points) - 1000 / 70) < 1e-9);
  });

  test('returns null for an empty points list', () => {
    assert.equal(averageKmPerLiter([]), null);
  });
});

describe('averageCostPerKm', () => {
  test('returns null when there is only one fill-up', () => {
    const points = computeFuelEfficiency([{ mileage: 10000, liters: 40, cost: 50000, date: new Date(2026, 0, 1) }]);
    assert.equal(averageCostPerKm(points), null);
  });

  test("divides total cost by total distance, ignoring the first fill-up's cost", () => {
    // First fill-up's cost has no prior distance to attribute it to.
    // 400km for $40000 + 600km for $30000 -> $70000 / 1000km = $70/km.
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, cost: 99999, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, cost: 40000, date: new Date(2026, 0, 8) },
      { mileage: 1000, liters: 30, cost: 30000, date: new Date(2026, 0, 20) },
    ]);
    assert.ok(Math.abs(averageCostPerKm(points) - 70) < 1e-9);
  });

  test('skips fill-ups without a recorded cost (and their distance)', () => {
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, cost: null, date: new Date(2026, 0, 8) },
      { mileage: 1000, liters: 30, cost: 30000, date: new Date(2026, 0, 20) },
    ]);
    assert.ok(Math.abs(averageCostPerKm(points) - 50) < 1e-9); // 30000 / 600
  });

  test('returns null when no fill-up has a cost', () => {
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, date: new Date(2026, 0, 8) },
    ]);
    assert.equal(averageCostPerKm(points), null);
  });
});
