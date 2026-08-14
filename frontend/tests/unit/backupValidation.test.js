import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidBackupData, reviveDates } from '../../js/lib/backupValidation.js';


describe('isValidBackupData', () => {
  const emptyShape = { vehicles: [], maintenanceItems: [], serviceHistory: [], mileageHistory: [] };

  test('accepts a well-shaped backup with empty stores', () => {
    assert.equal(isValidBackupData(emptyShape), true);
  });

  test('accepts a backup missing fuelHistory (older export, from before fuel tracking existed)', () => {
    assert.equal(isValidBackupData(emptyShape), true); // fuelHistory intentionally absent from emptyShape
  });

  test('accepts a well-shaped backup with populated stores, ignoring extra fields', () => {
    assert.equal(isValidBackupData({
      app: 'CarTrack',
      backupVersion: 1,
      vehicles: [{ name: 'Auto' }],
      maintenanceItems: [{ name: 'Aceite' }],
      serviceHistory: [{ mileage: 100 }],
      mileageHistory: [{ mileage: 100 }],
    }), true);
  });

  test('rejects null and undefined', () => {
    assert.equal(isValidBackupData(null), false);
    assert.equal(isValidBackupData(undefined), false);
  });

  test('rejects non-object primitives', () => {
    assert.equal(isValidBackupData('a string'), false);
    assert.equal(isValidBackupData(42), false);
    assert.equal(isValidBackupData(true), false);
  });

  test('rejects when any required store array is missing', () => {
    const { vehicles, ...rest } = emptyShape;
    assert.equal(isValidBackupData(rest), false);
  });

  test('rejects when a required field is present but not an array', () => {
    assert.equal(isValidBackupData({ ...emptyShape, vehicles: {} }), false);
    assert.equal(isValidBackupData({ ...emptyShape, maintenanceItems: 'oops' }), false);
    assert.equal(isValidBackupData({ ...emptyShape, serviceHistory: null }), false);
  });

  test('rejects an empty object', () => {
    assert.equal(isValidBackupData({}), false);
  });
});

describe('reviveDates', () => {
  test('turns an ISO date string field into a Date instance', () => {
    const obj = { date: '2026-01-15T00:00:00.000Z' };
    reviveDates(obj, ['date']);
    assert.ok(obj.date instanceof Date);
    assert.equal(obj.date.toISOString(), '2026-01-15T00:00:00.000Z');
  });

  test('revives multiple fields independently', () => {
    const obj = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z', name: 'kept as-is' };
    reviveDates(obj, ['createdAt', 'updatedAt']);
    assert.ok(obj.createdAt instanceof Date);
    assert.ok(obj.updatedAt instanceof Date);
    assert.equal(obj.name, 'kept as-is');
  });

  test('leaves fields not in the field list untouched', () => {
    const obj = { date: '2026-01-15T00:00:00.000Z', notes: 'not a date' };
    reviveDates(obj, ['date']);
    assert.equal(obj.notes, 'not a date');
  });

  test('skips missing, null, or undefined fields without throwing', () => {
    const obj = { date: null, other: undefined };
    assert.doesNotThrow(() => reviveDates(obj, ['date', 'other', 'missingField']));
    assert.equal(obj.date, null);
    assert.equal(obj.other, undefined);
  });

  test('mutates the object in place rather than returning a new one', () => {
    const obj = { date: '2026-01-15T00:00:00.000Z' };
    const result = reviveDates(obj, ['date']);
    assert.equal(result, undefined);
    assert.ok(obj.date instanceof Date);
  });
});
