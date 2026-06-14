// Definitions for fighter attributes and rarity tiers.
//
// Six attributes drive everything. They are intentionally readable so the
// fight feels fair-ish but still swingy:
//
//   strength   -> how much damage a landed punch does
//   speed      -> how often you throw, and helps you land / slip punches
//   toughness  -> your health pool and damage you soak
//   aggression -> chance to throw a heavy/crit punch, initiative
//   defense    -> chance to block or reduce incoming damage
//   balance    -> resistance to being knocked down + comeback grit
//
// Attribute values live in the range [STAT_MIN, STAT_MAX].

export const STAT_MIN = 20;
export const STAT_MAX = 99;

export const ATTRIBUTES = [
  { key: 'strength', label: 'Strength', short: 'STR' },
  { key: 'speed', label: 'Speed', short: 'SPD' },
  { key: 'toughness', label: 'Toughness', short: 'TGH' },
  { key: 'aggression', label: 'Aggression', short: 'AGR' },
  { key: 'defense', label: 'Defense', short: 'DEF' },
  { key: 'balance', label: 'Balance', short: 'BAL' },
];

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

// Relative weight of each attribute when computing a fighter's Overall rating.
// They sum to 1. The weights are tuned to mirror each stat's *actual* impact in
// the fight engine so that Overall is an honest predictor of who wins: speed
// (how often you throw + accuracy) and strength (damage) lead, balance trails.
export const OVERALL_WEIGHTS = {
  strength: 0.2,
  speed: 0.22,
  toughness: 0.18,
  aggression: 0.16,
  defense: 0.14,
  balance: 0.1,
};

// Rarity tiers. `weight` controls how often a tier shows up in a pack.
// `mean` / `spread` shape the attribute roll for fighters of that tier.
export const RARITIES = [
  {
    key: 'common',
    label: 'Common',
    color: '#9aa6b2',
    glow: 'rgba(154,166,178,0.5)',
    weight: 60,
    mean: 45,
    spread: 12,
  },
  {
    key: 'rare',
    label: 'Rare',
    color: '#3da9fc',
    glow: 'rgba(61,169,252,0.6)',
    weight: 26,
    mean: 58,
    spread: 12,
  },
  {
    key: 'epic',
    label: 'Epic',
    color: '#b06bff',
    glow: 'rgba(176,107,255,0.7)',
    weight: 11,
    mean: 70,
    spread: 11,
  },
  {
    key: 'legendary',
    label: 'Legendary',
    color: '#ffb340',
    glow: 'rgba(255,179,64,0.85)',
    weight: 3,
    mean: 82,
    spread: 9,
  },
];

export const RARITY_BY_KEY = Object.fromEntries(RARITIES.map((r) => [r.key, r]));

/** Compute a 0-99 Overall rating from a stats object. */
export function computeOverall(stats) {
  let sum = 0;
  for (const key of ATTRIBUTE_KEYS) {
    sum += (stats[key] || 0) * OVERALL_WEIGHTS[key];
  }
  return Math.round(sum);
}
