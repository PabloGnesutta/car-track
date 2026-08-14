import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeFuelEfficiency, averageFuelEfficiency } from '../../js/lib/fuelEconomy.js';


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

describe('averageFuelEfficiency', () => {
  test('returns null when there is only one fill-up (nothing computable)', () => {
    const points = computeFuelEfficiency([{ mileage: 10000, liters: 40, date: new Date(2026, 0, 1) }]);
    assert.equal(averageFuelEfficiency(points), null);
  });

  test('averages liters/distance across all fill-ups, not a plain mean of per-fillup values', () => {
    // 400km/40L then 600km/30L -> combined 1000km/70L = 7 L/100km,
    // NOT the plain average of 10 and 5 (which would wrongly give 7.5).
    const points = computeFuelEfficiency([
      { mileage: 0, liters: 40, date: new Date(2026, 0, 1) },
      { mileage: 400, liters: 40, date: new Date(2026, 0, 8) },
      { mileage: 1000, liters: 30, date: new Date(2026, 0, 20) },
    ]);
    assert.ok(Math.abs(averageFuelEfficiency(points) - 7) < 1e-9);
  });

  test('returns null for an empty points list', () => {
    assert.equal(averageFuelEfficiency([]), null);
  });
});
