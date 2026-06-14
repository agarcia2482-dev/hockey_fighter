// Arena scene controller. Given two fighters and a precomputed fight result
// (from simulateFight), it builds the canvas + HUD inside a host element and
// animates the event log: punches, recoils, impact bursts, knockdowns, screen
// shake, floating damage text, a live play-by-play, and a finish overlay.

import { drawArena, drawImpact } from '../render/arena.js';
import { drawFighter, GRID_W, GRID_H } from '../render/player.js';
import { el, clear, displayName } from './dom.js';

const VIEW_W = 960;
const VIEW_H = 540;

// Pose durations (ms)
const PUNCH_MS = 360;
const RECOIL_MS = 340;
const BLOCK_MS = 320;
const DOWN_MS = 850;
const IMPACT_MS = 220; // when in an attack the punch connects

function eventDuration(ev) {
  switch (ev.type) {
    case 'intro': return 850;
    case 'crit': return 700;
    case 'attack': return 520;
    case 'ko': return 1700;
    case 'decision': return 1150;
    default: return 400; // miss / block / grab
  }
}

// How long the knockdown/decision plays before the finish card slides in.
const TERMINAL_DELAY = 1100;

class Sprite {
  constructor(palette, facing, centerX, feetY, scale) {
    this.palette = palette;
    this.facing = facing;
    this.centerX = centerX;
    this.feetY = feetY;
    this.scale = scale;
    this.pose = 'idle';
    this.poseStart = 0;
  }
  setPose(type, now) {
    this.pose = type;
    this.poseStart = now;
  }
  // Returns a pose descriptor for drawFighter at time `now`.
  describe(now) {
    const s = this.scale;
    const elapsed = now - this.poseStart;
    let pose;
    if (this.pose === 'punch') pose = { type: 'punch', t: clamp01(elapsed / PUNCH_MS) };
    else if (this.pose === 'recoil') pose = { type: 'recoil', t: clamp01(elapsed / RECOIL_MS) };
    else if (this.pose === 'block') pose = { type: 'block', t: clamp01(elapsed / BLOCK_MS) };
    else if (this.pose === 'down') pose = { type: 'down', t: clamp01(elapsed / DOWN_MS), phase: now / 250 };
    else if (this.pose === 'win') pose = { type: 'win', phase: now / 220 };
    else pose = { type: 'idle', phase: now / 360 + this.centerX };

    // One-shot poses fall back to idle when finished.
    if ((this.pose === 'punch' || this.pose === 'recoil' || this.pose === 'block') && elapsed >= eventPoseLen(this.pose)) {
      this.pose = 'idle';
    }

    // A lunge toward the opponent while punching.
    let dx = 0;
    if (pose.type === 'punch') dx = Math.sin(pose.t * Math.PI) * this.facing * s * 1.6;

    return { pose, dx };
  }
  headPos() {
    return { x: this.centerX, y: this.feetY - (GRID_H - 6) * this.scale };
  }
}

function eventPoseLen(p) {
  return p === 'punch' ? PUNCH_MS : p === 'recoil' ? RECOIL_MS : BLOCK_MS;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function other(side) { return side === 'a' ? 'b' : 'a'; }

export class FightScene {
  constructor(host) {
    this.host = host;
    this.raf = null;
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    clear(this.host);
  }

  /**
   * @param {object} a  player-left fighter
   * @param {object} b  player-right fighter
   * @param {object} result  from simulateFight(a,b,...)
   * @param {object} opts { finish, onRematch, onNext, onHome }
   *   finish = { didWin, method, reward, coins, winnerName }
   */
  run(a, b, result, opts = {}) {
    this.destroy();
    this.a = a;
    this.b = b;
    this.result = result;
    this.opts = opts;
    this.events = result.events;

    this._buildDom();

    const scale = (VIEW_H * 0.46) / GRID_H;
    const feetY = VIEW_H * 0.90;
    this.spriteA = new Sprite(a.palette, 1, VIEW_W * 0.32, feetY, scale);
    this.spriteB = new Sprite(b.palette, -1, VIEW_W * 0.68, feetY, scale);

    this.hpMax = { a: result.aMaxHp, b: result.bMaxHp };
    this.hp = { a: result.aMaxHp, b: result.bMaxHp };
    this.hpDisplay = { a: result.aMaxHp, b: result.bMaxHp };

    this.idx = -1;
    this.tEvent = 0;
    this.impacted = false;
    this.impactFx = null; // {x,y,t,big}
    this.shake = 0;
    this.phase = 0;
    this.finished = false;
    this.finishTimer = 0;
    this.lastTs = 0;
    this.speed = 1; // tap the arena to fast-forward
    this.clock = 0; // scene clock (advances by speed) — drives all timing

    this._enterNextEvent(this.clock);
    this._updateHud();

    const loop = (ts) => {
      if (!this.lastTs) this.lastTs = ts;
      const dt = Math.min(64, ts - this.lastTs);
      this.lastTs = ts;
      this._tick(dt);
      this._render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  _buildDom() {
    clear(this.host);
    this.canvas = el('canvas', { class: 'fight-canvas', width: VIEW_W, height: VIEW_H });
    this.ctx = this.canvas.getContext('2d');

    const plate = (side, f, align) =>
      el('div', { class: `nameplate ${align}` }, [
        el('div', { class: 'np-row' }, [
          el('span', { class: 'np-ovr', text: String(f.overall) }),
          el('span', { class: 'np-name', text: displayName(f) }),
        ]),
        el('div', { class: 'np-team', text: `${f.team.city} ${f.team.name}` }),
        el('div', { class: 'hpbar' }, [el('span', { class: `hpfill ${side}` })]),
      ]);

    this.plateA = plate('a', this.a, 'left');
    this.plateB = plate('b', this.b, 'right');
    this.banner = el('div', { class: 'round-banner', text: '' });
    this.pbp = el('div', { class: 'pbp' });
    this.floaters = el('div', { class: 'floaters' });
    this.speedTag = el('div', { class: 'speed-tag hidden', text: '▶▶' });
    this.ffHint = el('div', { class: 'ff-hint', text: 'tap arena to fast-forward' });

    this.hud = el('div', { class: 'fight-hud' }, [
      this.plateA, this.plateB, this.banner, this.floaters, this.pbp, this.speedTag, this.ffHint,
    ]);

    this.overlay = el('div', { class: 'finish-overlay hidden' });

    this.stage = el('div', { class: 'arena-stage' }, [this.canvas, this.hud, this.overlay]);
    this.host.appendChild(this.stage);

    // Tap/click the arena to fast-forward the brawl.
    this.stage.addEventListener('click', () => { if (!this.finished) this._toggleSpeed(); });

    this.hpFillA = this.plateA.querySelector('.hpfill');
    this.hpFillB = this.plateB.querySelector('.hpfill');
  }

  _enterNextEvent(now) {
    this.idx++;
    if (this.idx >= this.events.length) return;
    const ev = this.events[this.idx];
    this.tEvent = 0;
    this.impacted = false;

    if (ev.type === 'intro') {
      this._flashBanner('FIGHT!');
      this._log(ev.text, 'intro');
      return;
    }

    if (ev.type === 'ko') {
      const loser = other(ev.by);
      this._spriteOf(loser).setPose('down', now);
      this._spriteOf(ev.by).setPose('win', now);
      this._flashBanner('K.O.!', 'big');
      this._log(ev.text, 'ko');
      this.shake = 16;
      this._beginFinish();
      return;
    }
    if (ev.type === 'decision') {
      this._spriteOf(ev.by).setPose('win', now);
      this._flashBanner('DECISION', 'big');
      this._log(ev.text, 'ko');
      this._beginFinish();
      return;
    }

    // Attack-type events: attacker throws now; impact resolves mid-swing.
    if (ev.by) this._spriteOf(ev.by).setPose('punch', now);
    this._log(ev.text, ev.type);
  }

  _spriteOf(side) { return side === 'a' ? this.spriteA : this.spriteB; }

  _tick(dt) {
    const sdt = dt * this.speed; // scaled delta — everything runs off this
    this.clock += sdt;
    const now = this.clock;

    this.phase += sdt / 1000;
    this.shake *= Math.pow(0.86, sdt / 16);
    if (this.shake < 0.3) this.shake = 0;

    // ease hp bars toward target
    for (const s of ['a', 'b']) {
      this.hpDisplay[s] += (this.hp[s] - this.hpDisplay[s]) * Math.min(1, sdt / 90);
    }

    if (this.impactFx) {
      this.impactFx.t += sdt / 240;
      if (this.impactFx.t >= 1) this.impactFx = null;
    }

    if (this.finished) {
      this.finishTimer += sdt;
      if (this.finishTimer >= TERMINAL_DELAY && this.overlay.classList.contains('hidden')) {
        this._showOverlay();
      }
      return;
    }

    const ev = this.events[this.idx];
    if (!ev) return;
    this.tEvent += sdt;

    const attackish = ev.type === 'attack' || ev.type === 'crit' || ev.type === 'block' || ev.type === 'grab' || ev.type === 'miss';
    if (attackish && !this.impacted && this.tEvent >= IMPACT_MS) {
      this._resolveImpact(ev, now);
      this.impacted = true;
    }

    if (this.tEvent >= eventDuration(ev)) {
      this._enterNextEvent(now);
    }
  }

  _resolveImpact(ev, now) {
    // sync hp from the event (authoritative)
    this.hp.a = ev.aHp;
    this.hp.b = ev.bHp;

    const def = other(ev.by);
    const defSprite = this._spriteOf(def);

    if (ev.type === 'attack' || ev.type === 'crit') {
      defSprite.setPose('recoil', now);
      const head = defSprite.headPos();
      this.impactFx = { x: head.x, y: head.y + 8, t: 0, big: ev.type === 'crit' };
      this.shake = ev.type === 'crit' ? 13 : 7;
      this._floater(`${ev.dmg}`, head.x, head.y, ev.type === 'crit');
    } else if (ev.type === 'block') {
      defSprite.setPose('block', now);
      const head = defSprite.headPos();
      this.impactFx = { x: head.x, y: head.y + 10, t: 0, big: false };
      this.shake = 3;
    }
    // miss / grab: no recoil, no damage
  }

  _render() {
    const ctx = this.ctx;
    const now = this.clock;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    drawArena(ctx, VIEW_W, VIEW_H, this.phase);

    // Both fighters are far enough apart that draw order doesn't matter.
    for (const [sprite, fighter] of [[this.spriteA, this.a], [this.spriteB, this.b]]) {
      const { pose, dx } = sprite.describe(now);
      const s = sprite.scale;
      const x = sprite.centerX - (GRID_W / 2) * s + dx;
      const y = sprite.feetY - GRID_H * s;
      drawFighter(ctx, { x, y, scale: s, palette: sprite.palette, facing: sprite.facing, pose });
    }

    if (this.impactFx) drawImpact(ctx, this.impactFx.x, this.impactFx.y, this.impactFx.t, this.impactFx.big);
    ctx.restore();

    this._updateHud();
  }

  _updateHud() {
    const pa = Math.max(0, this.hpDisplay.a) / this.hpMax.a;
    const pb = Math.max(0, this.hpDisplay.b) / this.hpMax.b;
    if (this.hpFillA) {
      this.hpFillA.style.width = `${pa * 100}%`;
      this.hpFillA.classList.toggle('low', pa < 0.3);
    }
    if (this.hpFillB) {
      this.hpFillB.style.width = `${pb * 100}%`;
      this.hpFillB.classList.toggle('low', pb < 0.3);
    }
  }

  _flashBanner(text, cls = '') {
    this.banner.textContent = text;
    this.banner.className = `round-banner show ${cls}`;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      this.banner.classList.remove('show');
    }, 850);
  }

  _log(text, kind) {
    if (!text) return;
    const line = el('div', { class: `pbp-line ${kind || ''}`, text });
    this.pbp.appendChild(line);
    while (this.pbp.childElementCount > 4) this.pbp.removeChild(this.pbp.firstChild);
    // trigger reflow-based fade-in
    requestAnimationFrame(() => line.classList.add('in'));
  }

  _floater(text, x, y, big) {
    const f = el('div', {
      class: `floater${big ? ' big' : ''}`,
      text: big ? `${text}!` : text,
      style: { left: `${(x / VIEW_W) * 100}%`, top: `${(y / VIEW_H) * 100}%` },
    });
    this.floaters.appendChild(f);
    setTimeout(() => f.remove(), 950);
  }

  _toggleSpeed() {
    this.speed = this.speed === 1 ? 2.6 : 1;
    const fast = this.speed !== 1;
    this.speedTag.textContent = `▶▶ ${this.speed}×`;
    this.speedTag.classList.toggle('hidden', !fast);
    if (this.ffHint) this.ffHint.classList.add('hidden');
  }

  _beginFinish() {
    this.finished = true;
    this.finishTimer = 0;
    if (this.ffHint) this.ffHint.classList.add('hidden');
  }

  _showOverlay() {
    const fin = this.opts.finish || {};
    const win = fin.didWin;
    const card = el('div', { class: `finish-card ${win ? 'win' : 'loss'}` }, [
      el('div', { class: 'finish-title', text: win ? 'VICTORY' : 'DEFEAT' }),
      el('div', { class: 'finish-sub', text: `${fin.winnerName} wins by ${fin.method === 'KO' ? 'knockout' : 'decision'}` }),
      el('div', { class: 'finish-reward', text: `+${fin.reward} coins   ·   balance ${fin.coins}` }),
      el('div', { class: 'finish-buttons' }, [
        el('button', { class: 'btn primary', text: 'Next Opponent', onClick: () => this.opts.onNext && this.opts.onNext() }),
        el('button', { class: 'btn', text: 'Rematch', onClick: () => this.opts.onRematch && this.opts.onRematch() }),
        el('button', { class: 'btn ghost', text: 'Menu', onClick: () => this.opts.onHome && this.opts.onHome() }),
      ]),
    ]);
    clear(this.overlay);
    this.overlay.appendChild(card);
    this.overlay.classList.remove('hidden');
    requestAnimationFrame(() => this.overlay.classList.add('show'));
  }
}
