// A tiny, dependency-free software implementation of the slice of the Canvas
// 2D API that the renderers use, plus a minimal PNG encoder (via Node's built-in
// zlib). Because there's no headless browser in CI, this lets us render the
// pixel-art sprites/arena to PNG files in pure Node and eyeball them.
//
// It supports affine transforms (translate/rotate/scale/save/restore), alpha
// blending, and gradient fills (approximated by their final stop), which is
// everything player.js and arena.js need.

import zlib from 'node:zlib';
import fs from 'node:fs';

export class SoftwareCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.buf = new Uint8Array(w * h * 4);
  }
  getContext() { return new Ctx(this); }
  /** Flood the whole canvas with a solid color (handy as a backdrop). */
  fill(color) {
    const [r, g, b] = parseColor(color);
    for (let i = 0; i < this.width * this.height; i++) {
      this.buf[i * 4] = r; this.buf[i * 4 + 1] = g; this.buf[i * 4 + 2] = b; this.buf[i * 4 + 3] = 255;
    }
  }
}

class Ctx {
  constructor(c) {
    this.c = c;
    this._fill = '#000';
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = false;
    this.m = [1, 0, 0, 1, 0, 0]; // a,b,c,d,e,f
    this._stack = [];
  }
  set fillStyle(v) { this._fill = v; }
  get fillStyle() { return this._fill; }

  save() { this._stack.push([this.m.slice(), this.globalAlpha, this._fill]); }
  restore() { const s = this._stack.pop(); if (s) { this.m = s[0]; this.globalAlpha = s[1]; this._fill = s[2]; } }

  translate(tx, ty) {
    const m = this.m;
    m[4] = m[0] * tx + m[2] * ty + m[4];
    m[5] = m[1] * tx + m[3] * ty + m[5];
  }
  rotate(a) {
    const cos = Math.cos(a), sin = Math.sin(a), m = this.m;
    const a0 = m[0], b0 = m[1], c0 = m[2], d0 = m[3];
    m[0] = a0 * cos + c0 * sin; m[1] = b0 * cos + d0 * sin;
    m[2] = -a0 * sin + c0 * cos; m[3] = -b0 * sin + d0 * cos;
  }
  scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }

  createLinearGradient() {
    const stops = [];
    return { addColorStop: (o, col) => stops.push([o, col]), _stops: stops, _grad: true };
  }
  clearRect() { /* backdrop is filled explicitly */ }

  fillRect(x, y, w, h) {
    let col = this._fill;
    if (col && col._grad) col = col._stops[col._stops.length - 1][1];
    const [r, g, b, a] = parseColor(col);
    const alpha = (a / 255) * this.globalAlpha;
    if (alpha <= 0) return;

    const m = this.m, W = this.c.width, H = this.c.height, buf = this.c.buf;
    const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]
      .map(([px, py]) => [m[0] * px + m[2] * py + m[4], m[1] * px + m[3] * py + m[5]]);
    const minX = Math.floor(Math.min(...corners.map((p) => p[0])));
    const maxX = Math.ceil(Math.max(...corners.map((p) => p[0])));
    const minY = Math.floor(Math.min(...corners.map((p) => p[1])));
    const maxY = Math.ceil(Math.max(...corners.map((p) => p[1])));

    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-9) return;

    for (let yy = minY; yy < maxY; yy++) {
      if (yy < 0 || yy >= H) continue;
      for (let xx = minX; xx < maxX; xx++) {
        if (xx < 0 || xx >= W) continue;
        // inverse-map device pixel into the rect's local space
        const dx = xx + 0.5 - m[4], dy = yy + 0.5 - m[5];
        const lx = (m[3] * dx - m[2] * dy) / det;
        const ly = (-m[1] * dx + m[0] * dy) / det;
        if (lx < x || lx >= x + w || ly < y || ly >= y + h) continue;
        const i = (yy * W + xx) * 4;
        buf[i] = Math.round(buf[i] * (1 - alpha) + r * alpha);
        buf[i + 1] = Math.round(buf[i + 1] * (1 - alpha) + g * alpha);
        buf[i + 2] = Math.round(buf[i + 2] * (1 - alpha) + b * alpha);
        buf[i + 3] = 255;
      }
    }
  }
}

function parseColor(s) {
  if (Array.isArray(s)) return s;
  s = String(s).trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p[3] == null ? 255 : Math.round(p[3] * 255)];
  }
  return [255, 0, 255, 255]; // magenta = "unknown color"
}

// --- minimal PNG encoder ---------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
export function writePNG(canvas, path) {
  const { width: w, height: h, buf } = canvas;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no per-scanline filter
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = buf[y * w * 4 + x];
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path, png);
}
