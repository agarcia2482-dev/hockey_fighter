// Player progression: the roster of unlocked fighters, coins, and lifetime
// stats — persisted to localStorage so a vertical-slice play session survives
// a refresh. All economy tuning lives here.

import { makeRng } from './rng.js';
import { generateFighter, rollRarity } from './fighter.js';

const STORAGE_KEY = 'hockey-fighter:save:v1';
export const SAVE_VERSION = 1;

// Economy
export const PACK_COST = 100;
export const WIN_REWARD = 60;
export const LOSS_REWARD = 15;
export const STARTING_COINS = 220;

/** Is persistent storage available in this environment? */
function hasStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Build a fresh save with a small starter roster and seed coins. */
export function newGame(seedOrRng) {
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);
  const fighters = [
    generateFighter(rng, { rarity: 'common' }),
    generateFighter(rng, { rarity: 'common' }),
    generateFighter(rng, { rarity: 'rare' }),
  ];
  return {
    version: SAVE_VERSION,
    coins: STARTING_COINS,
    fighters,
    selectedId: fighters[0].id,
    stats: { wins: 0, losses: 0, fights: 0, packsOpened: 0, knockouts: 0 },
    createdAt: Date.now(),
  };
}

/** Load a save from storage, or create a new one. */
export function loadState() {
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SAVE_VERSION && Array.isArray(parsed.fighters)) {
          return parsed;
        }
      }
    } catch {
      /* fall through to a fresh game */
    }
  }
  const fresh = newGame();
  saveState(fresh);
  return fresh;
}

/** Persist the save (no-op if storage is unavailable). */
export function saveState(state) {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / blocked — ignore for the slice */
  }
}

/** Wipe the save and start over. */
export function resetState() {
  if (hasStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  const fresh = newGame();
  saveState(fresh);
  return fresh;
}

export function getSelected(state) {
  return state.fighters.find((f) => f.id === state.selectedId) || state.fighters[0] || null;
}

export function setSelected(state, id) {
  if (state.fighters.some((f) => f.id === id)) {
    state.selectedId = id;
    saveState(state);
  }
  return getSelected(state);
}

export function canAffordPack(state) {
  return state.coins >= PACK_COST;
}

/**
 * Open a pack: spend coins, roll a fighter (with optional luck-tuned rarity),
 * add it to the roster, and persist. Returns the new fighter, or null if the
 * player can't afford it.
 */
export function openPack(state, seedOrRng) {
  if (!canAffordPack(state)) return null;
  const rng = typeof seedOrRng === 'function' ? seedOrRng : makeRng(seedOrRng);
  state.coins -= PACK_COST;
  const fighter = generateFighter(rng, { rarity: rollRarity(rng) });
  state.fighters.push(fighter);
  state.stats.packsOpened += 1;
  saveState(state);
  return fighter;
}

/** Record a fight result against the player's chosen fighter. */
export function recordResult(state, fighterId, didWin, method) {
  const f = state.fighters.find((x) => x.id === fighterId);
  state.stats.fights += 1;
  let reward;
  if (didWin) {
    state.stats.wins += 1;
    if (method === 'KO') state.stats.knockouts += 1;
    reward = WIN_REWARD + (method === 'KO' ? 20 : 0);
    if (f) f.record.wins += 1;
  } else {
    state.stats.losses += 1;
    reward = LOSS_REWARD;
    if (f) f.record.losses += 1;
  }
  state.coins += reward;
  saveState(state);
  return reward;
}
