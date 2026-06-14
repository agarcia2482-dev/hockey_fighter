import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { generateFighter } from '../js/core/fighter.js';
import { simulateFight, estimateOdds } from '../js/core/fight.js';

function strong() {
  return generateFighter(makeRng('strong-seed'), { rarity: 'legendary' });
}
function weak() {
  return generateFighter(makeRng('weak-seed'), { rarity: 'common' });
}

test('simulateFight returns a valid result shape', () => {
  const res = simulateFight(strong(), weak(), makeRng(1));
  assert.ok(res.winner === 'a' || res.winner === 'b');
  assert.ok(res.method === 'KO' || res.method === 'DEC');
  assert.ok(Array.isArray(res.events) && res.events.length > 1);
  assert.ok(res.aMaxHp > 0 && res.bMaxHp > 0);
  assert.equal(res.events[0].type, 'intro');
});

test('a KO drives the loser to 0 hp and ends with a ko event', () => {
  // Try several seeds until we get a KO (the common outcome for a mismatch).
  let koRes = null;
  for (let i = 0; i < 50 && !koRes; i++) {
    const r = simulateFight(strong(), weak(), makeRng(i));
    if (r.method === 'KO') koRes = r;
  }
  assert.ok(koRes, 'expected at least one KO across seeds');
  const last = koRes.events[koRes.events.length - 1];
  assert.equal(last.type, 'ko');
  const loserHp = koRes.winner === 'a' ? last.bHp : last.aHp;
  assert.equal(loserHp, 0);
});

test('health never displays as negative in the event log', () => {
  for (let i = 0; i < 30; i++) {
    const res = simulateFight(strong(), weak(), makeRng(i * 7));
    for (const ev of res.events) {
      assert.ok(ev.aHp >= 0 && ev.bHp >= 0, `negative hp at ${JSON.stringify(ev)}`);
    }
  }
});

test('the stronger fighter wins clearly more often (but not always)', () => {
  const a = strong();
  const b = weak();
  let aWins = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    if (simulateFight(a, b, makeRng(i)).winner === 'a') aWins++;
  }
  const rate = aWins / N;
  assert.ok(rate > 0.7, `strong win rate too low: ${rate}`);
  assert.ok(rate < 1.0, `strong should not win literally every time: ${rate}`);
});

test('identical fighters split close to 50/50', () => {
  const f = generateFighter(makeRng('mirror'), { rarity: 'rare' });
  let aWins = 0;
  const N = 800;
  for (let i = 0; i < N; i++) {
    if (simulateFight(f, f, makeRng(i)).winner === 'a') aWins++;
  }
  const rate = aWins / N;
  assert.ok(rate > 0.4 && rate < 0.6, `mirror match not balanced: ${rate}`);
});

test('simulateFight is deterministic for the same seed', () => {
  const a = strong();
  const b = weak();
  const r1 = simulateFight(a, b, makeRng(2024));
  const r2 = simulateFight(a, b, makeRng(2024));
  assert.equal(r1.winner, r2.winner);
  assert.equal(r1.events.length, r2.events.length);
  assert.equal(r1.method, r2.method);
});

test('estimateOdds favors the higher overall and is symmetric', () => {
  const a = strong();
  const b = weak();
  const oddsA = estimateOdds(a, b);
  const oddsB = estimateOdds(b, a);
  assert.ok(oddsA > 0.5, `expected strong favored, got ${oddsA}`);
  assert.ok(Math.abs(oddsA + oddsB - 1) < 1e-9, 'odds should sum to 1');
});
