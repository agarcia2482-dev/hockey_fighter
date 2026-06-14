// Top-level app: owns game state, builds the shell (header + screen host), and
// drives navigation between Home, Roster, Packs, Fighter Select, Matchup, and
// the Arena. Screen views are plain DOM built from the helpers in dom.js.

import {
  loadState, saveState, resetState, openPack, canAffordPack,
  getSelected, setSelected, recordResult, PACK_COST,
} from '../core/roster.js';
import { generateOpponent } from '../core/fighter.js';
import { simulateFight, estimateOdds } from '../core/fight.js';
import { makeRng } from '../core/rng.js';
import { el, clear, buildCard, displayName, rarityMeta } from './dom.js';
import { FightScene } from './fight.js';

export class App {
  constructor(root) {
    this.root = root;
    this.state = loadState();
    this.scene = null;
  }

  start() {
    this._buildShell();
    this.showHome();
  }

  // --- Shell ---------------------------------------------------------------
  _buildShell() {
    clear(this.root);

    this.coinsEl = el('span', { class: 'coins-val', text: String(this.state.coins) });
    this.recordEl = el('span', { class: 'record-val' });

    const header = el('header', { class: 'app-header' }, [
      el('div', { class: 'brand', onClick: () => this.showHome() }, [
        el('span', { class: 'brand-puck' }),
        el('span', { class: 'brand-text', html: 'HOCKEY <b>FIGHTER</b>' }),
      ]),
      el('div', { class: 'header-stats' }, [
        el('div', { class: 'stat-chip record-chip' }, [this.recordEl]),
        el('div', { class: 'stat-chip coins-chip' }, [el('span', { class: 'coin-ico', text: '◉' }), this.coinsEl]),
      ]),
    ]);

    this.screen = el('main', { class: 'screen-host' });

    const footer = el('footer', { class: 'app-footer' }, [
      el('span', { text: 'A Rock-’em-Sock-’em hockey brawler · vertical slice' }),
      el('span', { class: 'disclaimer', text: 'Not affiliated with the NHL. All teams, players & logos are fictional.' }),
    ]);

    this.root.appendChild(header);
    this.root.appendChild(this.screen);
    this.root.appendChild(footer);
    this._refreshHeader();
  }

  _refreshHeader() {
    this.coinsEl.textContent = String(this.state.coins);
    const s = this.state.stats;
    this.recordEl.textContent = `${s.wins}W – ${s.losses}L`;
  }

  _show(node) {
    if (this.scene) { this.scene.destroy(); this.scene = null; }
    clear(this.screen);
    this.screen.appendChild(node);
    // .app is the scroll container — reset it to the top on every navigation.
    this.root.scrollTop = 0;
  }

  _toast(msg) {
    const t = el('div', { class: 'toast', text: msg });
    this.root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  // --- Home ----------------------------------------------------------------
  showHome() {
    const view = el('div', { class: 'screen home' }, [
      el('div', { class: 'home-logo' }, [
        el('h1', { class: 'logo-title', html: 'HOCKEY <span>FIGHTER</span>' }),
        el('p', { class: 'logo-sub', text: 'Drop the gloves. Roll the dice.' }),
      ]),
      el('div', { class: 'home-menu' }, [
        el('button', { class: 'btn big primary', onClick: () => this.showSelect() }, [
          el('span', { class: 'btn-title', text: 'FIGHT' }),
          el('span', { class: 'btn-desc', text: 'Pick a brawler and throw down' }),
        ]),
        el('button', { class: 'btn big', onClick: () => this.showRoster() }, [
          el('span', { class: 'btn-title', text: 'ROSTER' }),
          el('span', { class: 'btn-desc', text: `${this.state.fighters.length} fighters in your lineup` }),
        ]),
        el('button', { class: 'btn big pack-btn', onClick: () => this.showPacks() }, [
          el('span', { class: 'btn-title', text: 'OPEN PACK' }),
          el('span', { class: 'btn-desc', text: `Unlock a new fighter · ${PACK_COST} coins` }),
        ]),
      ]),
      el('button', { class: 'link-btn', text: 'How to play', onClick: () => this._showHelp() }),
    ]);
    this._show(view);
  }

  _showHelp() {
    const overlay = el('div', { class: 'modal-overlay', onClick: (e) => { if (e.target === overlay) overlay.remove(); } });
    const box = el('div', { class: 'modal' }, [
      el('h2', { text: 'How to play' }),
      el('ol', { class: 'help-list' }, [
        el('li', { html: '<b>Open packs</b> with coins to unlock fighter cards. Rarer cards have stronger attributes.' }),
        el('li', { html: 'Every fighter has six weighted attributes: <b>STR, SPD, TGH, AGR, DEF, BAL</b>.' }),
        el('li', { html: 'Choose a fighter, size up the matchup, and <b>drop the gloves</b>.' }),
        el('li', { html: 'The fight is decided by <b>random rolls weighted by attributes</b> — favorites win more often, but anyone can land the big one.' }),
        el('li', { html: 'Win coins, open more packs, build a deeper lineup. Your progress is saved in this browser.' }),
      ]),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn primary', text: 'Got it', onClick: () => overlay.remove() }),
        el('button', { class: 'btn ghost danger', text: 'Reset save', onClick: () => this._confirmReset(overlay) }),
      ]),
    ]);
    overlay.appendChild(box);
    this.root.appendChild(overlay);
  }

  _confirmReset(overlay) {
    if (window.confirm('Reset all progress? This clears your roster and coins.')) {
      this.state = resetState();
      this._refreshHeader();
      overlay.remove();
      this.showHome();
      this._toast('Save reset — fresh roster granted');
    }
  }

  // --- Roster --------------------------------------------------------------
  showRoster() {
    const grid = el('div', { class: 'card-grid' });
    const selected = getSelected(this.state);
    const sorted = [...this.state.fighters].sort((a, b) => b.overall - a.overall);
    for (const f of sorted) {
      grid.appendChild(buildCard(f, {
        selected: selected && f.id === selected.id,
        onClick: () => {
          setSelected(this.state, f.id);
          this._toast(`${f.name.last} set as your active fighter`);
          this.showRoster();
        },
      }));
    }
    const view = el('div', { class: 'screen roster' }, [
      this._subheader('Your Roster', `${this.state.fighters.length} fighters · tap to set your active brawler`),
      grid,
    ]);
    this._show(view);
  }

  // --- Packs ---------------------------------------------------------------
  showPacks() {
    const reveal = el('div', { class: 'pack-reveal' }, [
      el('div', { class: 'pack-box' }, [
        el('div', { class: 'pack-icon', text: '🥊' }),
        el('div', { class: 'pack-hint', text: 'Spend coins to unlock a randomized fighter.' }),
      ]),
    ]);

    const openBtn = el('button', {
      class: 'btn big primary',
      onClick: () => this._doOpenPack(reveal, openBtn),
    }, [
      el('span', { class: 'btn-title', text: 'OPEN PACK' }),
      el('span', { class: 'btn-desc', text: `${PACK_COST} coins` }),
    ]);
    this._syncPackBtn(openBtn);

    const view = el('div', { class: 'screen packs' }, [
      this._subheader('Card Packs', 'Common · Rare · Epic · Legendary — higher tiers hit harder'),
      reveal,
      el('div', { class: 'pack-controls' }, [openBtn]),
    ]);
    this._show(view);
  }

  _syncPackBtn(btn) {
    const ok = canAffordPack(this.state);
    btn.classList.toggle('disabled', !ok);
    btn.disabled = !ok;
  }

  _doOpenPack(reveal, btn) {
    if (!canAffordPack(this.state)) {
      this._toast('Not enough coins — go win a fight!');
      return;
    }
    const fighter = openPack(this.state, makeRng());
    this._refreshHeader();
    this._syncPackBtn(btn);

    const meta = rarityMeta(fighter.rarity);
    clear(reveal);
    const card = buildCard(fighter, {});
    const burst = el('div', { class: `pack-burst rarity-${fighter.rarity}` });
    const wrap = el('div', {
      class: `pack-result rarity-${fighter.rarity}`,
      style: { '--rarity': meta.color, '--rarity-glow': meta.glow },
    }, [
      burst,
      el('div', { class: 'pack-banner', text: `${meta.label.toUpperCase()} UNLOCKED!` }),
      card,
      el('div', { class: 'pack-after' }, [
        el('button', { class: 'btn', text: 'To Roster', onClick: () => this.showRoster() }),
        el('button', { class: 'btn primary', text: 'Fight with this one', onClick: () => { setSelected(this.state, fighter.id); this.showMatchup(fighter, { fresh: true }); } }),
      ]),
    ]);
    reveal.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
  }

  // --- Fighter select ------------------------------------------------------
  showSelect() {
    const grid = el('div', { class: 'card-grid' });
    const selected = getSelected(this.state);
    const sorted = [...this.state.fighters].sort((a, b) => b.overall - a.overall);
    for (const f of sorted) {
      grid.appendChild(buildCard(f, {
        selected: selected && f.id === selected.id,
        onClick: () => { setSelected(this.state, f.id); this.showMatchup(f, { fresh: true }); },
      }));
    }
    const view = el('div', { class: 'screen select' }, [
      this._subheader('Choose Your Fighter', 'Tap a card to take it into the matchup'),
      grid,
    ]);
    this._show(view);
  }

  // --- Matchup -------------------------------------------------------------
  showMatchup(playerFighter, opts = {}) {
    if (opts.fresh || !this.currentOpponent) {
      this.currentOpponent = generateOpponent(makeRng(), playerFighter.overall);
    }
    const opp = this.currentOpponent;
    const pOdds = estimateOdds(playerFighter, opp);
    const playerPct = Math.round(pOdds * 100);

    const oddsBar = el('div', { class: 'odds' }, [
      el('div', { class: 'odds-bar' }, [
        el('span', { class: 'odds-fill you', style: { width: `${playerPct}%` } }),
        el('span', { class: 'odds-fill them', style: { width: `${100 - playerPct}%` } }),
      ]),
      el('div', { class: 'odds-labels' }, [
        el('span', { class: 'you', text: `${playerFighter.name.last} ${playerPct}%` }),
        el('span', { class: 'them', text: `${100 - playerPct}% ${opp.name.last}` }),
      ]),
      el('div', { class: 'odds-note', text: 'Odds are only a guide — drop the gloves and find out.' }),
    ]);

    const view = el('div', { class: 'screen matchup' }, [
      this._subheader('Tale of the Tape', 'Your fighter vs the challenger'),
      el('div', { class: 'matchup-cards' }, [
        el('div', { class: 'matchup-side' }, [el('div', { class: 'corner-tag you', text: 'YOUR CORNER' }), buildCard(playerFighter, {})]),
        el('div', { class: 'vs-badge', text: 'VS' }),
        el('div', { class: 'matchup-side' }, [el('div', { class: 'corner-tag them', text: 'CHALLENGER' }), buildCard(opp, {})]),
      ]),
      oddsBar,
      el('div', { class: 'matchup-controls' }, [
        el('button', { class: 'btn ghost', text: '‹ Pick another', onClick: () => this.showSelect() }),
        el('button', { class: 'btn', text: 'New challenger', onClick: () => this.showMatchup(playerFighter, { fresh: true }) }),
        el('button', { class: 'btn big primary fight-go', text: 'DROP THE GLOVES', onClick: () => this.startFight(playerFighter, opp) }),
      ]),
    ]);
    this._show(view);
  }

  // --- Arena ---------------------------------------------------------------
  startFight(playerFighter, opponent) {
    const result = simulateFight(playerFighter, opponent, makeRng());
    const didWin = result.winner === 'a';
    const reward = recordResult(this.state, playerFighter.id, didWin, result.method);
    this._refreshHeader();

    const winnerName = displayName(result.winner === 'a' ? playerFighter : opponent);

    const host = el('div', { class: 'arena-host' });
    const back = el('button', { class: 'arena-back', text: '‹ Menu', onClick: () => this.showHome() });
    const view = el('div', { class: 'screen arena' }, [back, host]);
    this._show(view);

    this.scene = new FightScene(host);
    this.scene.run(playerFighter, opponent, result, {
      finish: { didWin, method: result.method, reward, coins: this.state.coins, winnerName },
      onNext: () => this.showMatchup(playerFighter, { fresh: true }),
      onRematch: () => { this.currentOpponent = opponent; this.startFight(playerFighter, opponent); },
      onHome: () => this.showHome(),
    });
  }

  // --- shared --------------------------------------------------------------
  _subheader(title, sub) {
    return el('div', { class: 'subheader' }, [
      el('button', { class: 'back-btn', text: '‹', onClick: () => this.showHome() }),
      el('div', { class: 'subheader-text' }, [
        el('h2', { text: title }),
        sub ? el('p', { text: sub }) : null,
      ]),
    ]);
  }
}
