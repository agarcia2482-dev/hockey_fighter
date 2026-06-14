// The fight simulation engine.
//
// This is the heart of the game. Given two fighters and an RNG, it plays out a
// hockey fight as a series of weighted random exchanges and returns:
//   - a `winner` ('a' or 'b')
//   - a `method` ('KO' or 'DEC')
//   - a timed `events` log that the arena scene replays as animation.
//
// It is a pure function (no DOM, no globals) so it can be unit-tested. The
// design goal: the higher-rated fighter should win *more often*, but upsets
// must happen — the outcome is genuinely a roll of the (weighted) dice.

import { makeRng, rint, chance, clamp, weightedPick, pick, rfloat } from './rng.js';

const MAX_EXCHANGES = 44;

const FLAVOR = {
  land: [
    'lands a heavy right!',
    'connects with a hook!',
    'rocks him with a jab!',
    'drives an uppercut home!',
    'tags him clean!',
    'lands a thudding overhand!',
  ],
  crit: [
    'UNLOADS a haymaker!!',
    'lands a BOMB — the crowd erupts!',
    'catches him flush — huge shot!!',
    'a thunderous right hand!!',
    'absolutely crushes him!!',
  ],
  miss: [
    'swings and misses!',
    'throws — but only catches air!',
    'lunges and slips!',
    'misses badly!',
    'whiffs on a wild one!',
  ],
  block: [
    'but it’s shrugged off!',
    'blocked by the shoulder!',
    'ties him up — no damage!',
    'partially deflected!',
    'caught on the helmet!',
  ],
  jersey: [
    'yanks the jersey over his head!',
    'gets a grip on the sweater!',
    'pulls him off balance!',
  ],
  ko: [
    'and DOWN HE GOES! It’s over!',
    'TIMBERRR! He hits the ice!',
    'lights out — KNOCKDOWN!',
    'and that’s the fight! He’s down!',
  ],
  flash: [
    'OUT OF NOWHERE — flash knockdown!!',
    'a lightning right and he’s OUT!!',
    'never saw it coming — DOWN!!',
    'one punch, lights out!!',
  ],
};

/** Health pool derived from toughness (mostly) and balance (grit). */
function maxHp(f) {
  return Math.round(62 + f.stats.toughness * 0.95 + f.stats.balance * 0.42);
}

/** Probability that `atk` lands a thrown punch on `def`. */
function landChance(atk, def) {
  const c =
    0.6 +
    (atk.stats.speed - def.stats.defense) / 230 +
    (atk.stats.aggression - def.stats.balance) / 320;
  return clamp(c, 0.22, 0.92);
}

/** Probability the landed punch is a crit (big punch). */
function critChance(atk) {
  return clamp(atk.stats.aggression / 300 + (atk.stats.strength - 50) / 650, 0.05, 0.45);
}

/** Probability the defender blocks/shrugs off a punch that would land. */
function blockChance(def) {
  return clamp(def.stats.defense / 360 + def.stats.balance / 700, 0.03, 0.4);
}

/**
 * The "puncher's chance": a rare flash knockdown that ends the fight on a
 * single clean punch regardless of remaining health. Aggressive punchers find
 * it slightly more often; high-balance defenders shrug it off. This is what
 * keeps heavy underdogs alive — on any given night, anyone can land the big one.
 */
function flashChance(atk, def) {
  return clamp(
    0.012 + atk.stats.aggression / 4000 - def.stats.balance / 5000,
    0.004,
    0.06,
  );
}

/** Raw damage for a landed punch before mitigation. */
function rollDamage(rng, atk) {
  return (8 + atk.stats.strength * 0.34) * rfloat(rng, 0.82, 1.2);
}

/**
 * A lightweight Elo-style win-probability estimate for the matchup screen.
 * Returns the probability (0..1) that fighter `a` beats fighter `b`.
 */
export function estimateOdds(a, b) {
  return 1 / (1 + Math.pow(10, (b.overall - a.overall) / 22));
}

/**
 * Simulate a fight between fighter `a` and fighter `b`.
 * @param {object} a
 * @param {object} b
 * @param {function|number|string} [seedOrRng]
 * @returns {{winner:'a'|'b', method:'KO'|'DEC', exchanges:number, events:Array, aMaxHp:number, bMaxHp:number}}
 */
export function simulateFight(a, b, seedOrRng) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);

  const aMaxHp = maxHp(a);
  const bMaxHp = maxHp(b);
  let aHp = aMaxHp;
  let bHp = bMaxHp;

  const events = [];
  const sides = [
    { key: 'a', f: a },
    { key: 'b', f: b },
  ];

  const pushEvent = (type, byKey, dmg, text) => {
    events.push({
      type,
      by: byKey,
      dmg: Math.round(dmg),
      aHp: Math.max(0, Math.round(aHp)),
      bHp: Math.max(0, Math.round(bHp)),
      text,
    });
  };

  pushEvent('intro', null, 0, `${a.name.full} vs ${b.name.full} — gloves are off!`);

  let exchanges = 0;
  let winner = null;
  let method = 'DEC';

  while (exchanges < MAX_EXCHANGES) {
    exchanges++;

    // Choose who throws this exchange. Faster, more aggressive fighters throw
    // more often, which compounds their advantage over the fight.
    const attacker = weightedPick(
      rng,
      sides,
      (s) => s.f.stats.speed + s.f.stats.aggression * 0.6 + 12,
    );
    const defender = attacker.key === 'a' ? sides[1] : sides[0];
    const atk = attacker.f;
    const def = defender.f;

    // Occasional flavor: a jersey pull instead of a punch (no damage).
    if (chance(rng, 0.07)) {
      pushEvent('grab', attacker.key, 0, `${atk.name.last} ${pick(rng, FLAVOR.jersey)}`);
      continue;
    }

    if (!chance(rng, landChance(atk, def))) {
      pushEvent('miss', attacker.key, 0, `${atk.name.last} ${pick(rng, FLAVOR.miss)}`);
      continue;
    }

    // The punch is on target — does the defender shrug it off?
    if (chance(rng, blockChance(def))) {
      pushEvent('block', attacker.key, 0, `${atk.name.last} throws — ${pick(rng, FLAVOR.block)}`);
      continue;
    }

    const flash = chance(rng, flashChance(atk, def));
    const isCrit = flash || chance(rng, critChance(atk));
    let dmg = rollDamage(rng, atk);
    if (isCrit) dmg *= 1.85;
    // Toughness soaks damage.
    dmg *= 1 - def.stats.toughness / 280;
    dmg = Math.max(1, dmg);

    if (flash) {
      // A flash knockdown drops the defender no matter how fresh they are.
      if (defender.key === 'a') aHp = 0;
      else bHp = 0;
    } else if (defender.key === 'a') {
      aHp -= dmg;
    } else {
      bHp -= dmg;
    }

    const defHp = defender.key === 'a' ? aHp : bHp;

    if (defHp <= 0) {
      winner = attacker.key;
      method = 'KO';
      const punchText = flash ? pick(rng, FLAVOR.flash) : pick(rng, FLAVOR.ko);
      pushEvent('crit', attacker.key, dmg, `${atk.name.last} ${punchText}`);
      pushEvent('ko', attacker.key, 0, `${atk.name.full} WINS by knockout!`);
      break;
    }

    pushEvent(
      isCrit ? 'crit' : 'attack',
      attacker.key,
      dmg,
      `${atk.name.last} ${pick(rng, isCrit ? FLAVOR.crit : FLAVOR.land)}`,
    );
  }

  // No knockout in regulation -> decision by remaining health. Balance acts as
  // a tiebreaker (grit), then a coin flip so identical fighters split 50/50.
  if (!winner) {
    method = 'DEC';
    if (Math.abs(aHp - bHp) > 0.5) {
      winner = aHp > bHp ? 'a' : 'b';
    } else if (a.stats.balance !== b.stats.balance) {
      winner = a.stats.balance > b.stats.balance ? 'a' : 'b';
    } else {
      winner = chance(rng, 0.5) ? 'a' : 'b';
    }
    const champ = winner === 'a' ? a : b;
    pushEvent('decision', winner, 0, `Both still standing — ${champ.name.full} wins the decision!`);
  }

  return { winner, method, exchanges, events, aMaxHp, bMaxHp };
}
