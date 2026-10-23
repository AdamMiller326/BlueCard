// Save codes: a whole save as copy-pasteable text. design.md "Device transfer".
// Format: DMV1.<base64url(JSON)>.<crc32 hex>

import type { GameState } from '../core/state.ts';
import type { PackDependency } from '../packs/schema.ts';
import { versionSatisfies } from '../packs/validate.ts';
import { crc32 } from './crc32.ts';

const PREFIX = 'DMV1';

export interface SaveFile {
  v: 1;
  exportedAt: number;
  /** Content packs this save needs. */
  packs: PackDependency[];
  state: GameState;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeSaveCode(file: SaveFile): string {
  const bytes = new TextEncoder().encode(JSON.stringify(file));
  return `${PREFIX}.${toBase64Url(bytes)}.${crc32(bytes).toString(16).padStart(8, '0')}`;
}

export type DecodeResult = { ok: true; file: SaveFile } | { ok: false; error: string };

/** Decodes and checks a save code against the packs installed on this device. */
export function decodeSaveCode(code: string, installed: PackDependency[]): DecodeResult {
  const parts = code.trim().replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, error: 'Not a save code (expected DMV1.…).' };
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(parts[1] ?? '');
  } catch {
    return { ok: false, error: 'Save code is damaged (bad characters).' };
  }
  if (crc32(bytes).toString(16).padStart(8, '0') !== parts[2]) return { ok: false, error: 'Save code is damaged (checksum mismatch).' };
  let file: SaveFile;
  try {
    file = JSON.parse(new TextDecoder().decode(bytes)) as SaveFile;
  } catch {
    return { ok: false, error: 'Save code is damaged (bad data).' };
  }
  if (file?.v !== 1 || file.state?.version !== 1 || typeof file.state.time !== 'number' || !Array.isArray(file.packs))
    return { ok: false, error: 'Save code is from an unsupported version.' };
  const missing = file.packs.filter((need) => !installed.some((have) => have.id === need.id && versionSatisfies(have.version, need.version)));
  if (missing.length > 0)
    return { ok: false, error: `Missing content pack(s): ${missing.map((p) => `${p.id}@${p.version}`).join(', ')}. Import them first.` };
  return { ok: true, file };
}
