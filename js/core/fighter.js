// Procedural fighter ("card") generation.
//
// A fighter is just data: an identity, a rarity, six attributes, a sprite
// palette, and a win/loss record. Generation is fully driven by an injected
// RNG so it is deterministic and testable.

import {
  makeRng,
  rint,
  pick,
  chance,
  weightedPick,
  gauss,
  clamp,
} from './rng.js';
import {
  ATTRIBUTE_KEYS,
  RARITIES,
  RARITY_BY_KEY,
  STAT_MIN,
  STAT_MAX,
  computeOverall,
} from './attributes.js';
import {
  FIRST_NAMES,
  LAST_NAMES,
  TEAMS,
  NICKNAMES,
  SKIN_TONES,
  HAIR_COLORS,
} from '../data/identity.js';

let idCounter = 0;

/** Generate a short unique-ish id for a fighter. */
function makeId(rng) {
  idCounter = (idCounter + 1) % 100000;
  const rand = Math.floor(rng() * 0xffffff).toString(36);
  return `f_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

/** Roll a rarity using the configured tier weights. */
export function rollRarity(rng) {
  return weightedPick(rng, RARITIES, (r) => r.weight).key;
}

/**
 * Roll the six attributes for a given rarity. Each stat is a gaussian around
 * the rarity mean, then we bump one or two "specialty" stats so fighters feel
 * distinct (a bruiser vs a speedster) even within the same tier.
 */
export function rollStats(rng, rarityKey) {
  const rarity = RARITY_BY_KEY[rarityKey] || RARITY_BY_KEY.common;
  const stats = {};
  for (const key of ATTRIBUTE_KEYS) {
    stats[key] = Math.round(gauss(rng, rarity.mean, rarity.spread, STAT_MIN, STAT_MAX));
  }
  // Specialty bumps: 1-2 standout attributes.
  const specialties = chance(rng, 0.55) ? 2 : 1;
  for (let i = 0; i < specialties; i++) {
    const key = pick(rng, ATTRIBUTE_KEYS);
    stats[key] = Math.round(clamp(stats[key] + rint(rng, 6, 16), STAT_MIN, STAT_MAX));
  }
  return stats;
}

/** Build a sprite palette from a team + random skin/hair. */
export function rollPalette(rng, team) {
  return {
    jersey: team.jersey,
    jerseyAlt: team.jerseyAlt,
    trim: team.trim,
    skin: pick(rng, SKIN_TONES),
    hair: pick(rng, HAIR_COLORS),
    helmet: chance(rng, 0.5) ? team.jersey : team.jerseyAlt,
    pants: '#23272e',
    skate: '#101216',
  };
}

/**
 * Generate a complete fighter.
 *
 * @param {function|number|string} [seedOrRng]  An RNG fn, or a seed, or nothing.
 * @param {object} [opts]
 * @param {string} [opts.rarity]  Force a rarity tier.
 * @param {number} [opts.bias]    Add a flat bonus/penalty to every stat (used
 *                                to scale generated opponents to the player).
 */
export function generateFighter(seedOrRng, opts = {}) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);
  const rarity = opts.rarity || rollRarity(rng);

  const stats = rollStats(rng, rarity);
  if (opts.bias) {
    for (const key of ATTRIBUTE_KEYS) {
      stats[key] = Math.round(clamp(stats[key] + opts.bias, STAT_MIN, STAT_MAX));
    }
  }

  const team = pick(rng, TEAMS);
  const first = pick(rng, FIRST_NAMES);
  const last = pick(rng, LAST_NAMES);
  const nickname = chance(rng, 0.4) ? pick(rng, NICKNAMES) : null;

  return {
    id: makeId(rng),
    name: {
      first,
      last,
      nickname,
      full: `${first} ${last}`,
    },
    team: { city: team.city, name: team.name, abbr: team.abbr },
    rarity,
    stats,
    overall: computeOverall(stats),
    palette: rollPalette(rng, team),
    record: { wins: 0, losses: 0 },
    number: rint(rng, 1, 99),
  };
}

/** Recompute overall (handy if stats ever change). */
export function refreshOverall(fighter) {
  fighter.overall = computeOverall(fighter.stats);
  return fighter;
}

/**
 * Generate an opponent tuned to be a fair-but-slightly-spicy matchup for a
 * fighter of `targetOverall`. We roll a normal fighter, then nudge every stat
 * by a flat bias so the result lands near (and a touch above) the target.
 *
 * @param {function|number|string} seedOrRng
 * @param {number} targetOverall
 * @param {object} [opts]  { lo, hi } swing of the target band around the player.
 */
export function generateOpponent(seedOrRng, targetOverall, opts = {}) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);
  const lo = opts.lo ?? -7;
  const hi = opts.hi ?? 9;
  const target = clamp(targetOverall + rint(rng, lo, hi), 28, 99);

  const f = generateFighter(rng);
  const bias = clamp(Math.round(target - f.overall), -22, 22);
  if (bias !== 0) {
    for (const key of ATTRIBUTE_KEYS) {
      f.stats[key] = Math.round(clamp(f.stats[key] + bias, STAT_MIN, STAT_MAX));
    }
    refreshOverall(f);
  }
  return f;
}
