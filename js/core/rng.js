// Seeded, deterministic random number generation.
//
// Everything random in the game flows through here so that a given seed always
// produces the same fighters and the same fight. That makes the simulation
// reproducible and unit-testable, which matters because the *whole game* is a
// pile of weighted random rolls.

/**
 * Hash an arbitrary string/number into a 32-bit seed.
 * Lets us seed RNGs from things like fighter ids or "today".
 */
export function hashSeed(input) {
  const str = String(input);
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Create a fast, well-distributed PRNG (mulberry32) from a numeric or string
 * seed. Returns a function that yields floats in [0, 1).
 *
 * If no seed is given we fall back to a time/Math.random based seed so the
 * game still feels fresh each load.
 */
export function makeRng(seed) {
  let a;
  if (seed === undefined || seed === null) {
    a = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  } else if (typeof seed === 'number') {
    a = seed >>> 0;
  } else {
    a = hashSeed(seed);
  }
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [min, max). */
export function rfloat(rng, min, max) {
  return min + rng() * (max - min);
}

/** Integer in [min, max] inclusive. */
export function rint(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

/** True with probability p (0..1). */
export function chance(rng, p) {
  return rng() < p;
}

/** Pick a uniformly random element from an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Weighted pick. `items` is an array; `weightFn` maps an item to a positive
 * weight. Returns the chosen item. Items with higher weight are more likely.
 */
export function weightedPick(rng, items, weightFn) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  let roll = rng() * total;
  for (const it of items) {
    roll -= Math.max(0, weightFn(it));
    if (roll <= 0) return it;
  }
  return items[items.length - 1];
}

/**
 * Approximate a normal distribution (Box-Muller) clamped to [min, max].
 * Used to scatter fighter attributes around a rarity-based mean so that even
 * within a rarity you get variety.
 */
export function gauss(rng, mean, sd, min = -Infinity, max = Infinity) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return clamp(mean + n * sd, min, max);
}

/** Clamp a number to [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Fisher-Yates shuffle (returns a new array, does not mutate input). */
export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
