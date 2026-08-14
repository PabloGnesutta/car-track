import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpanishNumber } from '../../js/lib/spanishNumbers.js';


describe('parseSpanishNumber - digit tokens', () => {
  test('parses a plain digit string', () => {
    assert.equal(parseSpanishNumber('50300'), 50300);
  });

  test('parses digits with a dot as thousands separator', () => {
    assert.equal(parseSpanishNumber('50.300'), 50300);
  });

  test('parses digits with a comma as thousands separator', () => {
    assert.equal(parseSpanishNumber('50,300'), 50300);
  });

  test('parses "0" as zero, not null', () => {
    assert.equal(parseSpanishNumber('0'), 0);
  });

  test('ignores "km"/"kilómetros" trailing the number', () => {
    assert.equal(parseSpanishNumber('50300 km'), 50300);
    assert.equal(parseSpanishNumber('50300 kilómetros'), 50300);
  });
});

describe('parseSpanishNumber - Spanish number words', () => {
  test('parses "cero" as zero', () => {
    assert.equal(parseSpanishNumber('cero'), 0);
  });

  test('parses a simple tens+units compound with "y"', () => {
    assert.equal(parseSpanishNumber('treinta y dos'), 32);
  });

  test('parses fused twenty-compounds', () => {
    assert.equal(parseSpanishNumber('veintiuno'), 21);
    assert.equal(parseSpanishNumber('veintinueve'), 29);
  });

  test('parses hundreds ("cien" and "ciento" both mean 100)', () => {
    assert.equal(parseSpanishNumber('cien'), 100);
    assert.equal(parseSpanishNumber('ciento treinta'), 130);
  });

  test('parses "mil" alone as 1000', () => {
    assert.equal(parseSpanishNumber('mil'), 1000);
  });

  test('parses "cincuenta mil trescientos" as 50300 (the example from the odometer use case)', () => {
    assert.equal(parseSpanishNumber('cincuenta mil trescientos'), 50300);
  });

  test('parses "cincuenta mil trescientos kilómetros" (with the trailing unit word)', () => {
    assert.equal(parseSpanishNumber('cincuenta mil trescientos kilómetros'), 50300);
  });

  test('parses a full three-part number with "y"', () => {
    assert.equal(parseSpanishNumber('ochenta y siete mil quinientos veinte'), 87520);
  });

  test('parses "cien mil" as 100000', () => {
    assert.equal(parseSpanishNumber('cien mil'), 100000);
  });

  test('parses "un millón doscientos mil" as 1200000', () => {
    assert.equal(parseSpanishNumber('un millón doscientos mil'), 1200000);
  });

  test('is accent-insensitive ("dieciséis" and "dieciseis" both work)', () => {
    assert.equal(parseSpanishNumber('dieciséis'), 16);
    assert.equal(parseSpanishNumber('dieciseis'), 16);
  });

  test('is case-insensitive', () => {
    assert.equal(parseSpanishNumber('CINCUENTA MIL'), 50000);
  });
});

describe('parseSpanishNumber - mixed digit/word input (real speech-to-text is inconsistent)', () => {
  test('handles a mix of a digit token and a word token', () => {
    assert.equal(parseSpanishNumber('50 mil 300'), 50300);
  });
});

describe('parseSpanishNumber - unrecognized input', () => {
  test('returns null for empty string', () => {
    assert.equal(parseSpanishNumber(''), null);
  });

  test('returns null for whitespace-only input', () => {
    assert.equal(parseSpanishNumber('   '), null);
  });

  test('returns null for null/undefined', () => {
    // @ts-ignore - deliberately testing non-string input from a flaky STT result
    assert.equal(parseSpanishNumber(null), null);
    // @ts-ignore
    assert.equal(parseSpanishNumber(undefined), null);
  });

  test('returns null for text with no recognizable number', () => {
    assert.equal(parseSpanishNumber('no se entendió nada'), null);
  });

  test('skips unrelated filler words around a real number rather than failing entirely', () => {
    assert.equal(parseSpanishNumber('el auto tiene cincuenta mil kilómetros'), 50000);
  });
});
