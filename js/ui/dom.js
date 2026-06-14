// Small DOM helpers and the reusable fighter-card component used by the roster,
// pack reveal, selection, and matchup screens.

import { ATTRIBUTES, RARITY_BY_KEY } from '../core/attributes.js';
import { drawPortrait } from '../render/player.js';

/** Terse element factory: el('div', {class:'x', onclick}, [children|strings]). */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Full display name, including a nickname if present. */
export function displayName(f) {
  return f.name.nickname ? `${f.name.first} “${f.name.nickname}” ${f.name.last}` : f.name.full;
}

/** Build the compact stat-bar block for a fighter. */
export function statBlock(fighter) {
  const rows = ATTRIBUTES.map((attr) => {
    const v = fighter.stats[attr.key];
    return el('div', { class: 'stat-row' }, [
      el('span', { class: 'stat-label', text: attr.short }),
      el('span', { class: 'stat-track' }, [
        el('span', { class: `stat-fill tier-${tierOf(v)}`, style: { width: `${v}%` } }),
      ]),
      el('span', { class: 'stat-val', text: String(v) }),
    ]);
  });
  return el('div', { class: 'stats' }, rows);
}

function tierOf(v) {
  if (v >= 80) return 'a';
  if (v >= 65) return 'b';
  if (v >= 50) return 'c';
  return 'd';
}

/**
 * Build a fighter card element.
 * @param {object} fighter
 * @param {object} [opts] { selected, compact, onClick }
 */
export function buildCard(fighter, opts = {}) {
  const rarity = RARITY_BY_KEY[fighter.rarity] || RARITY_BY_KEY.common;
  const card = el('div', {
    class: `card rarity-${fighter.rarity}${opts.selected ? ' selected' : ''}${opts.compact ? ' compact' : ''}`,
    style: { '--rarity': rarity.color, '--rarity-glow': rarity.glow },
    onClick: opts.onClick,
  });

  const portrait = el('canvas', { class: 'portrait', width: 132, height: 168 });

  const head = el('div', { class: 'card-head' }, [
    el('span', { class: 'ovr', text: String(fighter.overall) }),
    el('span', { class: 'rarity-badge', text: rarity.label }),
  ]);

  const nameRow = el('div', { class: 'card-name', text: displayName(fighter) });
  const teamRow = el('div', { class: 'card-team', text: `${fighter.team.city} ${fighter.team.name} · #${fighter.number}` });

  const rec = fighter.record;
  const recordRow = el('div', { class: 'card-record', text: `${rec.wins}W – ${rec.losses}L` });

  card.appendChild(head);
  card.appendChild(el('div', { class: 'portrait-wrap' }, [portrait]));
  card.appendChild(nameRow);
  card.appendChild(teamRow);
  if (!opts.compact) card.appendChild(statBlock(fighter));
  card.appendChild(recordRow);

  // Paint the portrait once it's in the DOM (offscreen draw works too).
  drawPortrait(portrait, fighter, { phase: 0.5 });

  if (opts.selected) card.appendChild(el('div', { class: 'selected-flag', text: 'IN LINEUP' }));
  return card;
}

/** Rarity label/color accessor for non-card UIs (e.g., pack reveal banner). */
export function rarityMeta(key) {
  return RARITY_BY_KEY[key] || RARITY_BY_KEY.common;
}
