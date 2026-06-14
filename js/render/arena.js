// The fight arena: a pixel-art hockey rink drawn entirely from rectangles so it
// stays crisp at any scale and matches the sprite style. Text/HUD is layered on
// top as DOM, so this module only paints the rink, crowd, and impact effects.

import { makeRng } from '../core/rng.js';
import { disableSmoothing, shade } from './pixel.js';

// Crowd layout is generated once from a fixed seed so it doesn't shimmer.
let crowdCache = null;
function getCrowd(W, bandTop, bandH) {
  if (crowdCache && crowdCache.W === W) return crowdCache.dots;
  const rng = makeRng(1337);
  const colors = ['#c0392b', '#2e86de', '#1e8449', '#e67e22', '#8e44ad', '#f1c40f', '#ecf0f1', '#34495e'];
  const dots = [];
  const cell = Math.max(7, Math.round(W / 90));
  for (let y = bandTop; y < bandTop + bandH; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const jx = (rng() - 0.5) * cell * 0.4;
      dots.push({
        x: x + jx,
        y: y + (rng() - 0.5) * 2,
        c: colors[Math.floor(rng() * colors.length)],
        s: cell * 0.62,
        flick: rng(),
      });
    }
  }
  crowdCache = { W, dots };
  return dots;
}

/** Draw the full arena background. `phase` animates subtle crowd flicker. */
export function drawArena(ctx, W, H, phase = 0) {
  disableSmoothing(ctx);

  const crowdBottom = Math.round(H * 0.40);
  const boardTop = crowdBottom;
  const boardH = Math.round(H * 0.10);
  const iceTop = boardTop + boardH;

  // --- Stands (dark) -----------------------------------------------------
  const stands = ctx.createLinearGradient(0, 0, 0, crowdBottom);
  stands.addColorStop(0, '#0b0f1a');
  stands.addColorStop(1, '#1a2236');
  ctx.fillStyle = stands;
  ctx.fillRect(0, 0, W, crowdBottom);

  // Crowd
  for (const d of getCrowd(W, Math.round(H * 0.06), crowdBottom - Math.round(H * 0.06))) {
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(phase * 0.8 + d.flick * 6.28));
    ctx.globalAlpha = 0.5 + 0.5 * flick;
    ctx.fillStyle = d.c;
    ctx.fillRect(Math.round(d.x), Math.round(d.y), Math.ceil(d.s), Math.ceil(d.s));
  }
  ctx.globalAlpha = 1;

  // --- Boards + glass ----------------------------------------------------
  ctx.fillStyle = '#e8edf2';
  ctx.fillRect(0, boardTop, W, boardH);
  // Sponsor ad panels (fictional — just colored blocks).
  const adColors = ['#c0392b', '#16a085', '#2c3e50', '#d35400', '#2980b9', '#8e44ad', '#27ae60'];
  const adW = Math.round(W / 8);
  for (let i = 0, x = 0; x < W; i++, x += adW) {
    ctx.fillStyle = adColors[i % adColors.length];
    ctx.fillRect(x + 2, boardTop + Math.round(boardH * 0.28), adW - 4, Math.round(boardH * 0.42));
  }
  // Yellow kickplate + blue cap line.
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(0, iceTop - Math.round(boardH * 0.16), W, Math.round(boardH * 0.16));
  ctx.fillStyle = '#9fb3c8';
  ctx.fillRect(0, boardTop, W, 2);

  // --- Ice ---------------------------------------------------------------
  const ice = ctx.createLinearGradient(0, iceTop, 0, H);
  ice.addColorStop(0, '#dfeaf5');
  ice.addColorStop(1, '#b7cbe0');
  ctx.fillStyle = ice;
  ctx.fillRect(0, iceTop, W, H - iceTop);

  // Faceoff markings: blue lines flanking a red center line.
  const lineY = iceTop + Math.round((H - iceTop) * 0.30);
  ctx.fillStyle = '#cf2b3a';
  ctx.fillRect(Math.round(W * 0.5 - 2), iceTop, 4, H - iceTop); // center red line
  ctx.fillStyle = '#2e5cff';
  ctx.fillRect(Math.round(W * 0.30), iceTop, 3, H - iceTop);
  ctx.fillRect(Math.round(W * 0.70), iceTop, 3, H - iceTop);
  // Center faceoff circle (approximated with a thin ring of blocks).
  drawRing(ctx, Math.round(W * 0.5), lineY + Math.round((H - iceTop) * 0.25), Math.round((H - iceTop) * 0.26), '#cf2b3a');

  // --- Spotlight vignette ------------------------------------------------
  ctx.globalAlpha = 0.20;
  const vg = ctx.createLinearGradient(0, iceTop, 0, H);
  vg.addColorStop(0, 'rgba(255,255,255,0.4)');
  vg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, iceTop, W, H - iceTop);
  ctx.globalAlpha = 1;
  // darken edges
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, Math.round(W * 0.08), H);
  ctx.fillRect(W - Math.round(W * 0.08), 0, Math.round(W * 0.08), H);
  ctx.globalAlpha = 1;

  return { iceTop, boardTop };
}

// A blocky ellipse outline, used for the faceoff circle.
function drawRing(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const step = Math.PI / 22;
  for (let a = 0; a < Math.PI * 2; a += step) {
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r * 0.42;
    ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
  }
}

/**
 * Comic "impact" burst at (x, y). `t` is 0..1 progress (0 = full, 1 = gone).
 * `big` makes a crit hit pop harder.
 */
export function drawImpact(ctx, x, y, t, big = false) {
  if (t >= 1) return;
  const grow = (big ? 26 : 16) * (0.5 + t);
  const alpha = 1 - t;
  ctx.save();
  ctx.globalAlpha = alpha;
  const spikes = big ? 10 : 8;
  ctx.fillStyle = big ? '#ffd84a' : '#ffffff';
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2 + t * 0.6;
    const r = grow;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    const sz = big ? 6 : 4;
    ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), sz, sz);
  }
  // hot core
  ctx.fillStyle = big ? '#ff7a3c' : '#ffd84a';
  const core = (big ? 10 : 7) * (1 - t);
  ctx.fillRect(Math.round(x - core / 2), Math.round(y - core / 2), Math.ceil(core), Math.ceil(core));
  ctx.restore();
}
