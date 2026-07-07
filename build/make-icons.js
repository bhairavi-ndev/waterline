'use strict';

/**
 * Generates a water-drop app/tray icon with zero dependencies.
 * Encodes RGBA pixel buffers to PNG using Node's built-in zlib.
 *
 *   node build/make-icons.js
 *
 * Outputs assets/icon.png (256) and assets/tray.png (32).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');

// ---- tiny PNG encoder -----------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- droplet rendering ----------------------------------------------------
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

// Signed shape test in normalized coords: point at top (y=-1), bulb at bottom.
// Union of a circle (bulb) and a linear taper (spout).
function insideDrop(x, y) {
  const cy = 0.3;
  const r = 0.6;
  const inCircle = x * x + (y - cy) * (y - cy) <= r * r;
  const apex = -0.95;
  let inTaper = false;
  if (y >= apex && y <= cy) {
    const f = (y - apex) / (cy - apex); // 0 at apex -> 1 at bulb center
    const w = f * r;
    inTaper = Math.abs(x) <= w;
  }
  return inCircle || inTaper;
}

function renderDroplet(size) {
  const ss = 4; // supersample
  const buf = Buffer.alloc(size * size * 4);

  const top = [0x8f, 0xd0, 0xff];
  const bottom = [0x1c, 0x6d, 0xe0];
  const highlight = [0xff, 0xff, 0xff];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let cover = 0;
      let rAcc = 0;
      let gAcc = 0;
      let bAcc = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          // Map pixel -> normalized coords in [-1.05, 1.05] with margin.
          const nx = ((px + (sx + 0.5) / ss) / size) * 2.1 - 1.05;
          const ny = ((py + (sy + 0.5) / ss) / size) * 2.1 - 1.05;
          if (insideDrop(nx, ny)) {
            cover++;
            // vertical gradient
            const t = Math.min(1, Math.max(0, (ny + 0.6) / 1.5));
            let col = mix(top, bottom, t);
            // soft specular highlight upper-left of the bulb
            const hx = nx + 0.22;
            const hy = ny - 0.15;
            const hd = hx * hx * 1.6 + hy * hy;
            const hl = Math.max(0, 1 - hd / 0.16);
            col = mix(col, highlight, hl * 0.5);
            rAcc += col[0];
            gAcc += col[1];
            bAcc += col[2];
          }
        }
      }
      const samples = ss * ss;
      const a = cover / samples;
      const idx = (py * size + px) * 4;
      if (cover > 0) {
        buf[idx] = Math.round(rAcc / cover);
        buf[idx + 1] = Math.round(gAcc / cover);
        buf[idx + 2] = Math.round(bAcc / cover);
      }
      buf[idx + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, size, buf);
}

// ---- .ico container (PNG-compressed entries, Vista+) ----------------------
function makeIco(sizes) {
  const imgs = sizes.map((size) => ({ size, data: renderDroplet(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(imgs.length, 4);

  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + 16 * imgs.length;
  imgs.forEach((img, i) => {
    const b = i * 16;
    dir[b] = img.size >= 256 ? 0 : img.size; // 0 means 256
    dir[b + 1] = img.size >= 256 ? 0 : img.size;
    dir[b + 2] = 0; // palette
    dir[b + 3] = 0; // reserved
    dir.writeUInt16LE(1, b + 4); // color planes
    dir.writeUInt16LE(32, b + 6); // bits per pixel
    dir.writeUInt32LE(img.data.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += img.data.length;
  });

  return Buffer.concat([header, dir, ...imgs.map((i) => i.data)]);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.png'), renderDroplet(256));
fs.writeFileSync(path.join(OUT, 'tray.png'), renderDroplet(32));
fs.writeFileSync(path.join(OUT, 'icon.ico'), makeIco([16, 32, 48, 64, 128, 256]));
console.log('Wrote assets/icon.png (256), tray.png (32), icon.ico (multi-size)');
