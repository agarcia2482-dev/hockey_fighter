import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { generateFighter, rollStats, rollRarity } from '../js/core/fighter.js';
import {
  ATTRIBUTE_KEYS,
  STAT_MIN,
  STAT_MAX,
  computeOverall,
} from '../js/core/attributes.js';

test('generateFighter produces a well-formed fighter', () => {
  const f = generateFighter(makeRng(42));
  assert.ok(f.id, 'has id');
  assert.ok(f.name.full.includes(' '), 'has full name');
  assert.ok(f.team.abbr, 'has team');
  assert.ok(f.palette.jersey, 'has jersey color');
  assert.ok(Number.isInteger(f.number) && f.number >= 1 && f.number <= 99);
  assert.deepEqual(f.record, { wins: 0, losses: 0 });
});

test('all attributes stay within [STAT_MIN, STAT_MAX]', () => {
  for (let i = 0; i < 500; i++) {
    const f = generateFighter(makeRng(i));
    for (const key of ATTRIBUTE_KEYS) {
      const v = f.stats[key];
      assert.ok(
        Number.isInteger(v) && v >= STAT_MIN && v <= STAT_MAX,
        `stat ${key}=${v} out of range`,
      );
    }
  }
});

test('overall matches computeOverall and lands in 0..99', () => {
  for (let i = 0; i < 200; i++) {
    const f = generateFighter(makeRng(i * 3 + 1));
    assert.equal(f.overall, computeOverall(f.stats));
    assert.ok(f.overall >= 0 && f.overall <= 99);
  }
});

test('higher rarity yields higher average overall', () => {
  const sample = (rarity) => {
    let sum = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      sum += generateFighter(makeRng(i + rarity.length * 1000), { rarity }).overall;
    }
    return sum / N;
  };
  const common = sample('common');
  const legendary = sample('legendary');
  assert.ok(legendary > common + 20, `legendary=${legendary} common=${common}`);
});

test('forced rarity is respected', () => {
  const f = generateFighter(makeRng(5), { rarity: 'epic' });
  assert.equal(f.rarity, 'epic');
});

test('generation is deterministic for the same seed', () => {
  const a = generateFighter(makeRng(999));
  const b = generateFighter(makeRng(999));
  assert.deepEqual(a.stats, b.stats);
  assert.equal(a.name.full, b.name.full);
  assert.equal(a.overall, b.overall);
});

test('rollStats returns all six attributes', () => {
  const stats = rollStats(makeRng(1), 'rare');
  assert.deepEqual(Object.keys(stats).sort(), [...ATTRIBUTE_KEYS].sort());
});

test('rollRarity only returns known tiers', () => {
  const r = makeRng(77);
  const valid = new Set(['common', 'rare', 'epic', 'legendary']);
  for (let i = 0; i < 200; i++) assert.ok(valid.has(rollRarity(r)));
});

test('bias shifts stats upward', () => {
  const base = generateFighter(makeRng(123), { rarity: 'common' });
  const boosted = generateFighter(makeRng(123), { rarity: 'common', bias: 15 });
  assert.ok(boosted.overall >= base.overall, `${boosted.overall} >= ${base.overall}`);
});
