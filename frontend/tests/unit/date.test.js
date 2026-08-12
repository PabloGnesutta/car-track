import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toYYYYMMDD, fromYYYYMMDD } from '../../js/lib/date.js';


test('toYYYYMMDD pads single-digit month/day with a leading zero', () => {
  assert.equal(toYYYYMMDD(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toYYYYMMDD(new Date(2026, 11, 25)), '2026-12-25');
});

test('fromYYYYMMDD parses as local midnight, not UTC midnight', () => {
  const date = fromYYYYMMDD('2026-03-15');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 2);
  assert.equal(date.getDate(), 15);
  assert.equal(date.getHours(), 0);
});

test('toYYYYMMDD and fromYYYYMMDD round-trip a date without drift', () => {
  const original = new Date(2026, 5, 30);
  const roundTripped = fromYYYYMMDD(toYYYYMMDD(original));
  assert.equal(roundTripped.getFullYear(), original.getFullYear());
  assert.equal(roundTripped.getMonth(), original.getMonth());
  assert.equal(roundTripped.getDate(), original.getDate());
});
