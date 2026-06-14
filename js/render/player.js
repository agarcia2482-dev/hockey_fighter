// Parametric pixel-art hockey fighter.
//
// Rather than ship sprite sheets, each fighter is drawn from code out of
// axis-aligned "pixel" blocks, colored by the fighter's palette and posed by a
// small set of animation parameters. The same renderer draws the big arena
// brawlers and the little card portraits — just at different scales.
//
// Authoring convention: everything is drawn as if the fighter faces RIGHT.
// Passing facing === -1 mirrors it (see makePainter), so the right-hand
// fighter in the arena reuses identical code.

import { makePainter, shade, disableSmoothing } from './pixel.js';

// Drawing grid. The figure lives inside GRID_W x GRID_H "pixels".
export const GRID_W = 20;
export const GRID_H = 32;

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Turn a pose descriptor into concrete drawing parameters.
 * pose = { type, t (0..1 for one-shot poses), phase (continuous, for loops) }
 */
function derivePose(pose = {}) {
  const t = Math.max(0, Math.min(1, pose.t ?? 0));
  const phase = pose.phase ?? 0;
  const p = {
    bob: 0,
    headDx: 0,
    headDy: 0,
    torsoDx: 0,
    reach: 0, // front-fist extension toward opponent, 0..1
    guard: false, // both fists up in front
    armsUp: false, // victory
    down: 0, // knockdown progress 0..1
    hurt: 0, // 0..1 hit flash strength
  };

  switch (pose.type) {
    case 'punch': {
      const e = Math.sin(t * Math.PI); // out and back
      p.reach = e;
      p.torsoDx = e * 1.3;
      p.headDx = e * 0.6;
      p.bob = -e * 0.3;
      break;
    }
    case 'recoil': {
      const e = Math.sin(t * Math.PI);
      p.headDx = -e * 1.9;
      p.torsoDx = -e * 1.1;
      p.bob = e * 0.25;
      p.hurt = e;
      p.guard = true;
      break;
    }
    case 'block': {
      const e = Math.sin(t * Math.PI);
      p.guard = true;
      p.torsoDx = -e * 0.4;
      p.bob = -e * 0.15;
      break;
    }
    case 'win': {
      p.armsUp = true;
      p.bob = Math.sin(phase * 1.2) * 0.55;
      break;
    }
    case 'down': {
      p.down = t;
      break;
    }
    case 'idle':
    default: {
      p.bob = Math.sin(phase) * 0.4;
      p.reach = 0.05 + 0.04 * Math.sin(phase * 1.4);
      break;
    }
  }
  return p;
}

/**
 * Draw a fighter.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  { x, y, scale, palette, facing, pose }
 *   x,y     top-left of the drawing grid in device pixels
 *   scale   device pixels per grid unit
 *   palette fighter.palette
 *   facing  1 (faces right) or -1 (faces left)
 *   pose    pose descriptor (see derivePose)
 */
export function drawFighter(ctx, o) {
  const { x, y, scale: s, palette, facing = 1 } = o;
  const pose = derivePose(o.pose);

  // Palette + derived shades.
  const C = {
    jersey: palette.jersey,
    jerseyD: shade(palette.jersey, -0.28),
    jerseyL: shade(palette.jersey, 0.18),
    alt: palette.jerseyAlt,
    altD: shade(palette.jerseyAlt, -0.25),
    trim: palette.trim,
    skin: palette.skin,
    skinD: shade(palette.skin, -0.22),
    hair: palette.hair,
    helmet: palette.helmet,
    helmetL: shade(palette.helmet, 0.2),
    pants: palette.pants,
    pantsL: shade(palette.pants, 0.16),
    skate: palette.skate,
    blade: '#cfd6dd',
    dark: 'rgba(10,12,16,0.85)',
  };

  disableSmoothing(ctx);

  ctx.save();

  // Knockdown: rotate the whole figure backward around the skates and let it
  // sink to the ice.
  if (pose.down > 0) {
    const pivotX = x + (GRID_W / 2) * s;
    const pivotY = y + (GRID_H - 1) * s;
    const fall = pose.down;
    ctx.translate(pivotX, pivotY + fall * 1.5 * s);
    ctx.rotate(-facing * fall * 1.35); // topple backward, away from the opponent
    ctx.translate(-pivotX, -pivotY);
  }

  const rect = makePainter(ctx, x, y, s, facing, GRID_W);
  const bob = pose.bob; // applied to upper body only (breathing/lean)
  const lean = pose.torsoDx;

  // --- Shadow on the ice -------------------------------------------------
  ctx.globalAlpha = 0.28;
  rect(3.5, GRID_H - 1.2, 13, 1.2, '#0a0d12');
  rect(5, GRID_H - 0.4, 10, 0.6, '#0a0d12');
  ctx.globalAlpha = 1;

  // --- Back arm (behind the body, drawn first) ---------------------------
  drawBackArm(rect, C, pose, bob + 0 + lean);

  // --- Legs + skates (planted; no bob) -----------------------------------
  // Back leg / sock
  rect(5.4, 21, 3, 6, C.altD);
  rect(5.4, 23, 3, 0.8, C.trim);
  rect(5.4, 25, 3, 0.8, C.trim);
  drawSkate(rect, C, 4.6, false);
  // Front leg / sock
  rect(11.2, 21, 3, 6, C.alt);
  rect(11.2, 23, 3, 0.8, C.trim);
  rect(11.2, 25, 3, 0.8, C.trim);
  drawSkate(rect, C, 10.4, true);

  // --- Pants -------------------------------------------------------------
  rect(4 + lean * 0.4, 17 + bob, 12, 4.4, C.pants);
  rect(4 + lean * 0.4, 17 + bob, 12, 0.9, C.pantsL);
  rect(4 + lean * 0.4, 20.4, 12, 0.6, '#15181d');

  // --- Torso / jersey ----------------------------------------------------
  const tx = lean;
  rect(4.4 + tx, 10 + bob, 11.2, 2, C.alt); // shoulder yoke
  rect(4.4 + tx, 12 + bob, 11.2, 5, C.jersey); // body
  rect(4.4 + tx, 12 + bob, 1.4, 5, C.jerseyD); // back shade
  rect(14.2 + tx, 12 + bob, 1.4, 5, C.jerseyL); // front light
  rect(4.4 + tx, 16 + bob, 11.2, 1, C.trim); // hem stripe
  // Crest / number patch
  rect(8.3 + tx, 12.4 + bob, 3.2, 3.2, C.trim);
  rect(8.8 + tx, 12.9 + bob, 2.2, 2.2, C.alt);

  // --- Neck + head -------------------------------------------------------
  const hx = pose.headDx;
  const hy = pose.headDy + bob;
  rect(8.6 + tx + hx, 9 + bob, 3, 1.2, C.skin);
  drawHead(rect, C, hx + tx, hy);

  // --- Front arm (puncher, in front of torso) ----------------------------
  drawFrontArm(rect, C, pose, bob + lean);

  ctx.restore();

  // --- Knockdown stars (drawn upright, above where the head ends up) -----
  if (pose.down > 0.4) {
    // After toppling backward the head lands ~25 grid units to the rear of the
    // feet pivot; float the daze-stars just above that spot.
    const sx = x + 10 * s - facing * 25 * s;
    const sy = y + (GRID_H - 11) * s;
    drawStars(ctx, sx, sy, s, o.pose?.phase ?? 0);
  }
}

function drawHead(rect, C, dx, dy) {
  // Hair tuft at the back
  rect(6.2 + dx, 6 + dy, 1.1, 3, C.hair);
  // Face
  rect(7 + dx, 5.6 + dy, 6, 3.6, C.skin);
  rect(7 + dx, 8.4 + dy, 6, 0.8, C.skinD); // jaw shadow
  // Brow + eye (determined glare, on the forward side)
  rect(9 + dx, 6.1 + dy, 3.4, 0.7, '#2a2118');
  rect(10.7 + dx, 6.7 + dy, 1.2, 1, '#161616');
  // Grimace
  rect(10.4 + dx, 8.2 + dy, 1.8, 0.7, C.skinD);
  // Helmet dome + brim
  rect(6.6 + dx, 3 + dy, 6.8, 3, C.helmet);
  rect(6.6 + dx, 3 + dy, 6.8, 1, C.helmetL);
  rect(6.4 + dx, 5.6 + dy, 7.2, 0.9, C.helmet); // brim
  // Ear flap on forward side
  rect(12.4 + dx, 6 + dy, 1, 2, C.helmet);
}

function drawSkate(rect, C, x, front) {
  rect(x, 27, 4, 2, C.skate);
  rect(x, 27, 4, 0.7, shade(C.skate, 0.3));
  rect(x - 0.3, 29, 4.6, 0.8, C.blade); // blade
  rect(x + 0.6, 28.8, 2.8, 0.5, '#8a929b'); // holder
}

// Back arm: usually a raised guard near the chin; rises with the others on a win.
function drawBackArm(rect, C, pose, off) {
  if (pose.armsUp) {
    rect(5, 1.5, 2.4, 3.2, C.alt);
    rect(5, 0.4, 2.6, 1.8, C.skin); // fist up
    return;
  }
  // shoulder + upper
  rect(4.8, 11 + off, 2.6, 3, C.altD);
  // forearm up to guard
  rect(6.2, 9.6 + off, 2, 3.2, C.alt);
  rect(6.3, 8.3 + off, 1.9, 1.8, C.skin); // fist by cheek
}

// Front arm: the punching arm. Drives most of the animation.
function drawFrontArm(rect, C, pose, off) {
  if (pose.armsUp) {
    rect(13.6, 1.5, 2.4, 3.2, C.jersey);
    rect(13.6, 0.4, 2.6, 1.8, C.skin); // fist up
    return;
  }

  // Shoulder cap (always present)
  rect(13 + pose.torsoDx, 10.6 + off, 2.4, 2.6, C.jersey);
  rect(13 + pose.torsoDx, 10.6 + off, 2.4, 0.6, C.trim);

  if (pose.guard || pose.reach < 0.14) {
    // Bent guard: fist up by the face.
    rect(13.4 + pose.torsoDx, 9.4 + off, 2, 3.2, C.jersey);
    rect(13.2 + pose.torsoDx, 8.3 + off, 2.2, 2, C.skin);
    return;
  }

  // Extended jab toward the opponent (rightward in authored frame).
  const fistX = lerp(14.6, 18.9, pose.reach);
  const fistY = 11 + off * 0.6;
  const armLen = fistX - 14;
  rect(14, fistY, armLen, 2.1, C.jersey); // forearm
  rect(14, fistY, 1, 2.1, C.trim); // cuff
  rect(fistX - 0.2, fistY - 0.4, 2.4, 2.8, C.skin); // fist
  rect(fistX - 0.2, fistY - 0.4, 2.4, 0.7, shade(C.skin, 0.18)); // knuckle light
}

// Cartoon "seeing stars" ring above a knocked-out fighter.
function drawStars(ctx, cx, cy, s, phase) {
  const star = (ang, r) => {
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r * 0.5;
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(Math.round(px - 0.6 * s), Math.round(py - 0.2 * s), Math.ceil(1.2 * s), Math.ceil(0.4 * s));
    ctx.fillRect(Math.round(px - 0.2 * s), Math.round(py - 0.6 * s), Math.ceil(0.4 * s), Math.ceil(1.2 * s));
  };
  for (let i = 0; i < 4; i++) {
    star(phase * 3 + (i * Math.PI * 2) / 4, 3.6 * s);
  }
}

/**
 * Draw a head-and-body portrait into a (small) canvas for a roster card.
 * Scales the figure to fit and stands it on a subtle floor line.
 */
export function drawPortrait(canvas, fighter, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  disableSmoothing(ctx);
  ctx.clearRect(0, 0, W, H);

  // Background wash tinted by jersey.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, shade(fighter.palette.jersey, -0.45));
  bg.addColorStop(1, shade(fighter.palette.jerseyAlt, -0.7));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const margin = opts.margin ?? 6;
  const scale = (H - margin * 2) / GRID_H;
  const x = (W - GRID_W * scale) / 2;
  const yOff = H - margin - GRID_H * scale;

  drawFighter(ctx, {
    x,
    y: yOff,
    scale,
    palette: fighter.palette,
    facing: opts.facing ?? 1,
    pose: { type: 'idle', phase: opts.phase ?? 0 },
  });
}
