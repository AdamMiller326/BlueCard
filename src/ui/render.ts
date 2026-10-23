// Canvas screen. Draws from a MonView only; never touches game rules.
import type { MonView } from '../core/view.ts';
import { HEART_COUNT } from '../core/view.ts';
import { FRAME_SIZE } from '../packs/schema.ts';
import type { MonDef } from '../core/species.ts';
import type { Poop } from '../core/state.ts';

export const W = 160;
export const H = 144;
const SCALE = 3; // sprite scale inside the logical screen

const COL = {
  bg: '#c7d8b0',
  bgDark: '#1c2a24',
  ink: '#1d2b22',
  heart: '#d6455b',
  heartEmpty: '#8a9a7e',
  strength: '#3a72c4',
  effort: '#d99a1e',
  poop: '#7a4a1e',
  danger: '#e0303a',
};

export type Anim = 'idle' | 'eat' | 'happy' | 'refuse' | 'sleep' | 'sick' | 'attack';

const sheets = new Map<string, HTMLImageElement>();
function sheetFor(url: string): HTMLImageElement | null {
  if (!url) return null;
  let img = sheets.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    sheets.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, fill: number, color: string): void {
  const shape = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  shape.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c !== '#') return;
      ctx.fillStyle = i / 7 < fill ? color : COL.heartEmpty;
      ctx.fillRect(x + i, y + j, 1, 1);
    }),
  );
}

function meter(ctx: CanvasRenderingContext2D, x: number, y: number, value: number, max: number, color: string, label: string): void {
  ctx.fillStyle = COL.ink;
  ctx.font = '6px monospace';
  ctx.fillText(label, x, y + 5);
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < value ? color : COL.heartEmpty;
    ctx.fillRect(x + 10 + i * 5, y, 4, 5);
  }
}

function drawPoop(ctx: CanvasRenderingContext2D, x: number, y: number, jumbo: boolean): void {
  const s = jumbo ? 2 : 1;
  ctx.fillStyle = COL.poop;
  ctx.fillRect(x, y + 4 * s, 6 * s, 2 * s);
  ctx.fillRect(x + s, y + 2 * s, 4 * s, 2 * s);
  ctx.fillRect(x + 2 * s, y, 2 * s, 2 * s);
}

export interface Scene {
  view: MonView | null;
  def: MonDef | null;
  spriteUrl: string;
  poop: Poop[];
  anim: Anim;
  tick: number;
  clockText: string;
  line1: string;
  line2: string;
}

export function render(ctx: CanvasRenderingContext2D, s: Scene): void {
  ctx.imageSmoothingEnabled = false;
  const v = s.view;
  const dark = !!v && !v.lightsOn;
  ctx.fillStyle = dark ? COL.bgDark : COL.bg;
  ctx.fillRect(0, 0, W, H);

  // Status bar
  ctx.fillStyle = dark ? COL.bg : COL.ink;
  ctx.font = '7px monospace';
  ctx.fillText(s.clockText, 2, 8);
  if (v && !v.dead) {
    for (let i = 0; i < HEART_COUNT; i++) heart(ctx, 70 + i * 9, 2, Math.max(0, Math.min(1, v.hearts - i)), COL.heart);
    meter(ctx, 2, 12, v.strength, v.strengthMax, COL.strength, 'STR');
    meter(ctx, 72, 12, v.effort, 4, COL.effort, 'EFF');
  }

  // Mon
  const cx = 56;
  const cy = 92;
  if (!v) {
    ctx.fillStyle = COL.ink;
    ctx.font = '8px monospace';
    ctx.fillText('Press Hatch to begin', 30, 70);
  } else if (v.dead) {
    ctx.fillStyle = COL.ink;
    ctx.fillRect(cx - 10, cy - 30, 20, 30);
    ctx.fillRect(cx - 16, cy - 2, 32, 4);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(cx - 1, cy - 26, 2, 14);
    ctx.fillRect(cx - 5, cy - 22, 10, 2);
  } else {
    const img = sheetFor(s.spriteUrl);
    const anims = s.def?.sprite.animations ?? {};
    const frames = anims[s.anim] ?? anims.idle ?? [0];
    const frame = frames[Math.floor(s.tick / 2) % frames.length] ?? 0;
    const size = FRAME_SIZE * SCALE;
    if (img) {
      ctx.drawImage(img, frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE, cx - size / 2, cy - size + 6, size, size);
    } else {
      ctx.fillStyle = '#5a8fd0';
      ctx.beginPath();
      ctx.arc(cx, cy - 24, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    if (dark) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - size / 2, cy - size + 6, size, size);
      if (v.asleep) {
        ctx.fillStyle = COL.bg;
        ctx.font = '8px monospace';
        ctx.fillText('z', cx + 30, cy - 60 - (s.tick % 4) * 2);
      }
    }
  }

  // Poop column on the right
  s.poop.slice(-8).forEach((p, i) => drawPoop(ctx, 112 + (i % 2) * 20, 40 + Math.floor(i / 2) * 14, p.jumbo));
  if (s.poop.length > 8) {
    ctx.fillStyle = COL.ink;
    ctx.fillText(`+${s.poop.length - 8}`, 140, 104);
  }

  // Sick / danger
  if (v?.sick && !v.dead) {
    const flash = v.danger && s.tick % 2 === 0;
    ctx.fillStyle = COL.danger;
    ctx.fillRect(4, 26, 12, 4);
    ctx.fillRect(8, 22, 4, 12);
    if (v.danger) {
      ctx.font = '8px monospace';
      ctx.fillText('DANGER', 20, 33);
      if (flash) {
        ctx.strokeStyle = COL.danger;
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, W - 2, H - 2);
      }
    }
  }

  // Bottom lines
  ctx.fillStyle = dark ? COL.bg : COL.ink;
  ctx.font = '7px monospace';
  ctx.fillText(s.line1, 2, H - 12);
  ctx.fillText(s.line2, 2, H - 3);
}
