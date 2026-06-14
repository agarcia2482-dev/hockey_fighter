// Render the pixel-art sprites and arena to PNG files so we can review the
// visuals without a browser. Run: `npm run preview` (outputs to assets/previews).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoftwareCanvas, writePNG } from './software-canvas.mjs';
import { drawArena, drawImpact } from '../js/render/arena.js';
import { drawFighter, GRID_H } from '../js/render/player.js';
import { makeRng } from '../js/core/rng.js';
import { generateFighter } from '../js/core/fighter.js';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/previews');
fs.mkdirSync(OUT, { recursive: true });

// 1) Pose sheet ------------------------------------------------------------
function poseSheet() {
  const S = 7, PW = (20 + 4) * S, PH = (GRID_H + 4) * S;
  const poses = [
    { type: 'idle', phase: 0.6, facing: 1 },
    { type: 'punch', t: 0.5, facing: 1 },
    { type: 'recoil', t: 0.5, facing: 1 },
    { type: 'block', t: 0.6, facing: 1 },
    { type: 'win', phase: 1.0, facing: 1 },
    { type: 'down', t: 1.0, phase: 2.0, facing: 1 },
  ];
  const canvas = new SoftwareCanvas(PW * poses.length, PH);
  canvas.fill('#223049');
  const f = generateFighter(makeRng('preview-skater'), { rarity: 'epic' });
  poses.forEach((p, i) => {
    drawFighter(canvas.getContext(), { x: i * PW + 2 * S, y: 2 * S, scale: S, palette: f.palette, facing: p.facing, pose: p });
  });
  writePNG(canvas, path.join(OUT, 'sprites.png'));
}

// 2) Arena exchange --------------------------------------------------------
function arenaShot() {
  const W = 960, H = 540;
  const canvas = new SoftwareCanvas(W, H);
  const ctx = canvas.getContext();
  drawArena(ctx, W, H, 0.7);
  const scale = (H * 0.46) / GRID_H, feetY = H * 0.9, y = feetY - GRID_H * scale;
  const left = generateFighter(makeRng('left'), { rarity: 'legendary' });
  const right = generateFighter(makeRng('right'), { rarity: 'rare' });
  drawFighter(ctx, { x: W * 0.30 - 10 * scale, y, scale, palette: left.palette, facing: 1, pose: { type: 'punch', t: 0.5 } });
  drawFighter(ctx, { x: W * 0.70 - 10 * scale, y, scale, palette: right.palette, facing: -1, pose: { type: 'recoil', t: 0.5 } });
  drawImpact(ctx, W * 0.55, y + 9 * scale, 0.25, true);
  writePNG(canvas, path.join(OUT, 'arena.png'));
}

// 3) Knockout --------------------------------------------------------------
function knockoutShot() {
  const W = 960, H = 540;
  const canvas = new SoftwareCanvas(W, H);
  const ctx = canvas.getContext();
  drawArena(ctx, W, H, 0.5);
  const scale = (H * 0.46) / GRID_H, feetY = H * 0.9, y = feetY - GRID_H * scale;
  const loser = generateFighter(makeRng('loser'), { rarity: 'epic' });
  const winner = generateFighter(makeRng('winner'), { rarity: 'legendary' });
  drawFighter(ctx, { x: W * 0.32 - 10 * scale, y, scale, palette: loser.palette, facing: 1, pose: { type: 'down', t: 1, phase: 2 } });
  drawFighter(ctx, { x: W * 0.68 - 10 * scale, y, scale, palette: winner.palette, facing: -1, pose: { type: 'win', phase: 1 } });
  writePNG(canvas, path.join(OUT, 'knockout.png'));
}

poseSheet();
arenaShot();
knockoutShot();
console.log(`Wrote previews to ${OUT}`);
