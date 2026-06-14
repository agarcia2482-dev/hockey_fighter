import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng,
  hashSeed,
  rint,
  rfloat,
  chance,
  pick,
  weightedPick,
  gauss,
  clamp,
  shuffle,
} from '../js/core/rng.js';

test('makeRng is deterministic for a given seed', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('makeRng yields floats in [0, 1)', () => {
  const r = makeRng('seed-string');
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('different seeds give different streams', () => {
  const a = makeRng(1)();
  const b = makeRng(2)();
  assert.notEqual(a, b);
});

test('hashSeed is stable and numeric', () => {
  assert.equal(hashSeed('hello'), hashSeed('hello'));
  assert.notEqual(hashSeed('hello'), hashSeed('world'));
  assert.equal(typeof hashSeed('x'), 'number');
});

test('rint stays within inclusive bounds', () => {
  const r = makeRng(7);
  for (let i = 0; i < 2000; i++) {
    const v = rint(r, 3, 9);
    assert.ok(Number.isInteger(v) && v >= 3 && v <= 9, `bad rint ${v}`);
  }
});

test('rfloat stays within [min, max)', () => {
  const r = makeRng(8);
  for (let i = 0; i < 2000; i++) {
    const v = rfloat(r, -2, 5);
    assert.ok(v >= -2 && v < 5, `bad rfloat ${v}`);
  }
});

test('chance(0) is never true and chance(1) is always true', () => {
  const r = makeRng(9);
  for (let i = 0; i < 50; i++) {
    assert.equal(chance(r, 0), false);
    assert.equal(chance(r, 1), true);
  }
});

test('pick returns an element of the array', () => {
  const r = makeRng(10);
  const arr = ['x', 'y', 'z'];
  for (let i = 0; i < 100; i++) assert.ok(arr.includes(pick(r, arr)));
});

test('weightedPick respects weights statistically', () => {
  const r = makeRng(11);
  const items = [
    { id: 'rare', w: 1 },
    { id: 'common', w: 9 },
  ];
  const counts = { rare: 0, common: 0 };
  const N = 10000;
  for (let i = 0; i < N; i++) counts[weightedPick(r, items, (it) => it.w).id]++;
  // common should be roughly 9x rare; allow generous tolerance.
  assert.ok(counts.common > counts.rare * 5, `common=${counts.common} rare=${counts.rare}`);
});

test('gauss respects clamp bounds', () => {
  const r = makeRng(12);
  for (let i = 0; i < 5000; i++) {
    const v = gauss(r, 50, 30, 20, 99);
    assert.ok(v >= 20 && v <= 99, `gauss out of clamp ${v}`);
  }
});

test('clamp clamps', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(99, 0, 10), 10);
});

test('shuffle keeps the same elements and does not mutate input', () => {
  const r = makeRng(13);
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(r, input);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort((x, y) => x - y), [1, 2, 3, 4, 5]);
});
