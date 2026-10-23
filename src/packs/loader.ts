// Pack loader. Reads a pack through an abstract file source so the same code
// serves bundled packs (HTTP), imported packs (IndexedDB, step 3) and the CLI.

import type { Roster } from '../core/species.ts';
import { pngSize } from './png.ts';
import type { Pack } from './schema.ts';
import { validatePack, type Issue, type RawPack, type ValidationResult } from './validate.ts';

export interface PackSource {
  /** All file paths in the pack, relative to its root, using "/". */
  list(): Promise<string[]>;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  /** URL the UI can load an asset from. */
  assetUrl(path: string): string;
}

/** Reads and validates a pack. Parse failures become validation errors. */
export async function loadPack(source: PackSource, deps: Pack[] = []): Promise<ValidationResult> {
  const files = await source.list();
  const parseErrors: Issue[] = [];
  const readJson = async (path: string): Promise<unknown> => {
    try {
      return JSON.parse(await source.readText(path));
    } catch (e) {
      parseErrors.push({ file: path, message: `could not read JSON: ${(e as Error).message}` });
      return undefined;
    }
  };

  const raw: RawPack = { manifest: undefined, mons: {}, moves: undefined, assets: {} };
  if (!files.includes('manifest.json')) parseErrors.push({ file: 'manifest.json', message: 'missing' });
  else raw.manifest = await readJson('manifest.json');
  if (!files.includes('moves.json')) parseErrors.push({ file: 'moves.json', message: 'missing' });
  else raw.moves = await readJson('moves.json');
  if (files.includes('areas.json')) raw.areas = await readJson('areas.json');

  for (const f of files) {
    if (f.startsWith('mons/') && f.endsWith('.json')) raw.mons[f] = await readJson(f);
    else if (f.startsWith('assets/')) {
      raw.assets[f] = f.toLowerCase().endsWith('.png') ? pngSize(await source.readBytes(f)) : null;
    } else if (!['manifest.json', 'moves.json', 'areas.json'].includes(f) && !f.endsWith('.md')) {
      parseErrors.push({ file: f, message: 'unexpected file (packs hold manifest, moves, areas, mons/*.json, assets/)' });
    }
  }
  if (parseErrors.length > 0) return { pack: null, errors: parseErrors, warnings: [] };

  const result = validatePack(raw, deps);
  if (result.pack) for (const f of Object.keys(raw.assets)) result.pack.assetUrls[f] = source.assetUrl(f);
  return result;
}

/** Merges validated packs into the roster core reads. */
export function buildRoster(packs: Pack[]): Roster {
  const roster: Roster = { mons: {}, starters: [] };
  for (const p of packs) {
    for (const m of p.mons) roster.mons[m.id] = m;
    roster.starters.push(...p.manifest.starters);
  }
  return roster;
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `  ${i.file}: ${i.message}`).join('\n');
}
