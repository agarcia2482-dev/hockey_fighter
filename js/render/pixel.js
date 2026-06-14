// Low-level helpers for crisp pixel-art rendering on a 2D canvas.

/** Turn off image smoothing so scaled pixels stay sharp. */
export function disableSmoothing(ctx) {
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  return ctx;
}

/** Parse a #rrggbb (or #rgb) string into [r,g,b]. */
export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Shade a hex color. `amount` in [-1, 1]: negative darkens, positive lightens.
 * Used to derive outlines/shadows/highlights from a fighter's palette.
 */
export function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  if (amount < 0) {
    const f = 1 + amount;
    return rgb(r * f, g * f, b * f);
  }
  return rgb(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

export function rgb(r, g, b) {
  return `rgb(${clampByte(r)},${clampByte(g)},${clampByte(b)})`;
}

/**
 * Make a grid painter bound to a context, origin, pixel size, and facing.
 * Coordinates are authored as if the figure faces right; when `facing === -1`
 * the painter mirrors horizontally about `gridW` so the same code draws the
 * left-hand fighter. Returns a `rect(x, y, w, h, color)` function.
 */
export function makePainter(ctx, ox, oy, s, facing, gridW) {
  return function rect(x, y, w, h, color) {
    const gx = facing === -1 ? gridW - x - w : x;
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(ox + gx * s),
      Math.round(oy + y * s),
      Math.ceil(w * s),
      Math.ceil(h * s),
    );
  };
}
