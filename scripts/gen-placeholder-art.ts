// Generates original placeholder sprite sheets for packs/pendulum-nsp and the
// PWA icons. Run: npm run gen:art. Output is committed; rerun after edits.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bitmap } from './png-encode.ts';

const FRAME = 32;
const FRAMES = 8; // idle0 idle1 eat happy refuse sleep sick attack
const PACK = 'packs/pendulum-nsp';

const INK = [20, 24, 32];
const WHITE = [250, 250, 250];

function hexToRgb(hex: string): number[] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawMon(bmp: Bitmap, ox: number, frame: number, stage: number, color: number[]): void {
  const size = 6 + stage * 1.6; // bigger each stage
  let cx = ox + 16;
  let cy = 31 - size;
  if (frame === 1) cy -= 1; // idle bounce
  if (frame === 3) cy -= 3; // happy hop
  if (frame === 7) cx += 4; // attack lunge
  if (frame === 5) cy += 2; // sleep slump
  const body = frame === 6 ? color.map((v) => Math.round(v * 0.55 + 90)) : color;
  bmp.ellipse(cx, cy, size, size * 0.9, INK);
  bmp.ellipse(cx, cy, size - 1, size * 0.9 - 1, body);
  // Stage features: ears from II, feet from III, spikes from V.
  if (stage >= 2) {
    bmp.rect(cx - size + 1, cy - size, 2, 3, INK);
    bmp.rect(cx + size - 3, cy - size, 2, 3, INK);
  }
  if (stage >= 3) {
    bmp.rect(cx - size / 2 - 1, cy + size * 0.8, 3, 2, INK);
    bmp.rect(cx + size / 2 - 1, cy + size * 0.8, 3, 2, INK);
  }
  if (stage >= 5) for (let k = -1; k <= 1; k++) bmp.rect(cx + k * 4, cy - size - 2, 2, 3, INK);
  const ey = cy - size / 4;
  const dir = frame === 4 ? -3 : 0; // refuse: look away
  if (frame === 5) {
    bmp.rect(cx - 4 + dir, ey, 3, 1, INK);
    bmp.rect(cx + 2 + dir, ey, 3, 1, INK);
  } else if (frame === 6) {
    for (const ex of [cx - 3, cx + 3]) {
      bmp.set(ex - 1, ey - 1, INK);
      bmp.set(ex + 1, ey + 1, INK);
      bmp.set(ex + 1, ey - 1, INK);
      bmp.set(ex - 1, ey + 1, INK);
      bmp.set(ex, ey, INK);
    }
  } else {
    for (const ex of [cx - 3 + dir, cx + 3 + dir]) {
      bmp.rect(ex - 1, ey - 1, 2, 3, INK);
      bmp.set(ex, ey - 1, WHITE);
    }
  }
  if (frame === 2) bmp.ellipse(cx + dir, cy + size / 3, 2.5, 2, INK); // eating mouth
  if (frame === 3) bmp.rect(cx - 2, cy + size / 3, 5, 1, INK); // smile
  if (frame === 7) bmp.ellipse(cx + size + 3, cy, 2, 2, [255, 200, 40]); // attack spark
}

function sheet(stage: number, color: number[]): Buffer {
  const bmp = new Bitmap(FRAME * FRAMES, FRAME);
  for (let f = 0; f < FRAMES; f++) drawMon(bmp, f * FRAME, f, stage, color);
  return bmp.encode();
}

function icon(size: number): Buffer {
  const bmp = new Bitmap(size, size);
  bmp.rect(0, 0, size, size, [24, 32, 64]);
  const s = size / 32;
  bmp.ellipse(size / 2, size * 0.55, 11 * s, 10 * s, INK);
  bmp.ellipse(size / 2, size * 0.55, 10 * s, 9 * s, [90, 170, 250]);
  bmp.rect(size / 2 - 4 * s, size * 0.48, 2 * s, 3 * s, INK);
  bmp.rect(size / 2 + 2 * s, size * 0.48, 2 * s, 3 * s, INK);
  return bmp.encode();
}

// Colors live next to the art generator, not in pack JSON (the pack only names the sheet).
const COLORS: Record<string, string> = {
  punimon: '#e85d75',
  tsunomon: '#c9a46b',
  gabumon: '#e9d36a',
  elecmon: '#d9483b',
  garurumon: '#7fb3e6',
  leomon: '#e0a640',
  numemon: '#8bc34a',
  weregarurumon: '#4a6fb5',
  panjyamon: '#e8e8f0',
  monzaemon: '#c98a4b',
  metalgarurumon: '#9fb3c8',
};

mkdirSync(join(PACK, 'assets'), { recursive: true });
for (const file of readdirSync(join(PACK, 'mons'))) {
  const mon = JSON.parse(readFileSync(join(PACK, 'mons', file), 'utf8')) as { id: string; stage: number; sprite: { sheet: string } };
  const key = mon.id.split(':')[1] ?? '';
  const color = hexToRgb(COLORS[key] ?? '#999999');
  writeFileSync(join(PACK, mon.sprite.sheet), sheet(mon.stage, color));
  console.log(`wrote ${mon.sprite.sheet}`);
}
mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) writeFileSync(`public/icons/icon-${size}.png`, icon(size));
console.log('wrote public/icons');
