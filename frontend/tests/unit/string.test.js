import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matches } from '../../js/lib/string.js';


test('normalize trims and lowercases', () => {
  assert.equal(normalize('  Cambio de Aceite  '), 'cambio de aceite');
});

test('matches is case-insensitive', () => {
  assert.equal(matches('Cambio de Aceite', 'aceite'), true);
  assert.equal(matches('Cambio de Aceite', 'ACEITE'), true);
});

test('matches treats the pattern as a substring search', () => {
  assert.equal(matches('Rotación de neumáticos', 'rotaci'), true);
  assert.equal(matches('Rotación de neumáticos', 'frenos'), false);
});

test('matches returns false against an empty haystack unless the pattern is also empty', () => {
  assert.equal(matches('', 'aceite'), false);
  assert.equal(matches('', ''), true);
});
