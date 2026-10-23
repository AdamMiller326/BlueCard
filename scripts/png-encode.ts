// Minimal RGBA PNG encoder for generated placeholder art (Node only).
import { deflateSync } from 'node:zlib';
import { crc32 } from '../src/save/crc32.ts';

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export class Bitmap {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }
  set(x: number, y: number, [r, g, b, a = 255]: number[]): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data.set([r ?? 0, g ?? 0, b ?? 0, a], i);
  }
  rect(x: number, y: number, w: number, h: number, c: number[]): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number[]): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  }
  encode(): Buffer {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 4 + 1)] = 0;
      raw.set(this.data.subarray(y * this.width * 4, (y + 1) * this.width * 4), y * (this.width * 4 + 1) + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array(0)),
    ]);
  }
}
