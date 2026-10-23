// Pack validator. Runs in the app on load/import and in the lint:packs CLI.
// Input is raw parsed JSON; output is either a typed Pack or a list of errors.

import { NUMERIC_REQUIREMENTS, REQUIREMENT_KEYS, bossList, isUnconditional, parseComparison, type Requirements } from '../core/requirements.ts';
import { ATTRIBUTES, type EvolutionDef, type MonDef, type SpriteDef } from '../core/species.ts';
import { POOP_PER_GAP_MAX, POOP_PER_GAP_MIN, STAGES, WINDOW_COUNT_RANGE, type Stage } from '../core/tuning.ts';
import {
  ASSET_EXTENSIONS,
  FRAME_SIZE,
  MOVE_STYLES,
  REQUIRED_ANIMATIONS,
  type AreaDef,
  type MoveDef,
  type Pack,
  type PackDependency,
  type PackManifest,
} from './schema.ts';

/** Raw pack contents, already JSON-parsed. Paths are relative to the pack root. */
export interface RawPack {
  manifest: unknown;
  mons: Record<string, unknown>;
  moves: unknown;
  areas?: unknown;
  /** Every asset path in the pack; value is image size when known (PNG), else null. */
  assets: Record<string, { width: number; height: number } | null>;
}

export interface Issue {
  file: string;
  message: string;
}

export interface ValidationResult {
  pack: Pack | null;
  errors: Issue[];
  warnings: Issue[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const PACK_ID = /^[a-z0-9][a-z0-9-]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const NS_ID = /^([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-_]*)$/;

export function namespaceOf(id: string): string | null {
  return NS_ID.exec(id)?.[1] ?? null;
}

/** Same major version satisfies a dependency. */
export function versionSatisfies(have: string, want: string): boolean {
  return have.split('.')[0] === want.split('.')[0];
}

/**
 * Validates one pack. `deps` are already-validated packs it may reference
 * (only those listed in its manifest's `depends` are visible).
 */
export function validatePack(raw: RawPack, deps: Pack[] = []): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (file: string, message: string) => errors.push({ file, message });
  const warn = (file: string, message: string) => warnings.push({ file, message });

  // --- manifest ------------------------------------------------------------
  const mf = 'manifest.json';
  const m = raw.manifest;
  if (!isObj(m)) {
    err(mf, 'manifest must be an object');
    return { pack: null, errors, warnings };
  }
  const id = m.id;
  if (!isStr(id) || !PACK_ID.test(id)) err(mf, 'id must be lowercase letters, digits and dashes');
  if (!isStr(m.name)) err(mf, 'name is required');
  if (!isStr(m.version) || !VERSION.test(m.version)) err(mf, 'version must look like 1.2.3');
  if (!isStr(m.author)) err(mf, 'author is required');
  const depends: PackDependency[] = [];
  if (m.depends !== undefined && !Array.isArray(m.depends)) err(mf, 'depends must be an array');
  for (const d of Array.isArray(m.depends) ? m.depends : []) {
    if (!isObj(d) || !isStr(d.id) || !isStr(d.version)) {
      err(mf, 'each dependency needs id and version');
      continue;
    }
    const found = deps.find((p) => p.manifest.id === d.id);
    if (!found) err(mf, `missing dependency pack "${d.id}"`);
    else if (!versionSatisfies(found.manifest.version, d.version))
      err(mf, `dependency "${d.id}" is ${found.manifest.version}, need ${d.version}`);
    depends.push({ id: d.id, version: d.version });
  }
  const ns = isStr(id) ? id : '?';
  const visibleDeps = deps.filter((p) => depends.some((d) => d.id === p.manifest.id));

  // --- moves ---------------------------------------------------------------
  const moves: MoveDef[] = [];
  const movesFile = 'moves.json';
  if (!Array.isArray(raw.moves)) err(movesFile, 'moves.json must be an array');
  for (const [k, mv] of (Array.isArray(raw.moves) ? raw.moves : []).entries()) {
    const where = `${movesFile}[${k}]`;
    if (!isObj(mv)) {
      err(where, 'move must be an object');
      continue;
    }
    const before = errors.length;
    if (!isStr(mv.id) || namespaceOf(mv.id) !== ns) err(where, `id must be "${ns}:<name>"`);
    if (!isStr(mv.name)) err(where, 'name is required');
    if (!MOVE_STYLES.includes(mv.style as never)) err(where, `style must be one of ${MOVE_STYLES.join(', ')}`);
    const tiers = mv.tiers;
    if (!isObj(tiers) || !isNum(tiers.bad) || !isNum(tiers.good) || !isNum(tiers.great)) {
      err(where, 'tiers needs numeric bad, good, great');
    } else if (!(0 <= tiers.bad && tiers.bad <= tiers.good && tiers.good <= tiers.great)) {
      err(where, 'tiers must satisfy 0 <= bad <= good <= great');
    }
    if (!isStr(mv.anim)) err(where, 'anim is required');
    if (errors.length === before && moves.some((x) => x.id === mv.id)) err(where, `duplicate move ${String(mv.id)}`);
    if (errors.length === before) moves.push(mv as unknown as MoveDef);
  }
  const moveIds = new Set([...moves.map((x) => x.id), ...visibleDeps.flatMap((p) => p.moves.map((x) => x.id))]);

  // --- assets --------------------------------------------------------------
  for (const path of Object.keys(raw.assets)) {
    const lower = path.toLowerCase();
    if (!ASSET_EXTENSIONS.some((e) => lower.endsWith(e))) err(path, `asset type not allowed (allowed: ${ASSET_EXTENSIONS.join(', ')})`);
  }

  // --- mons (shape) --------------------------------------------------------
  const mons: MonDef[] = [];
  const monFiles = new Map<string, string>();
  for (const [file, mon] of Object.entries(raw.mons)) {
    const before = errors.length;
    const def = checkMonShape(file, mon, ns, moveIds, raw.assets, err, warn);
    if (def && errors.length === before) {
      if (monFiles.has(def.id)) err(file, `duplicate mon id ${def.id} (also in ${monFiles.get(def.id)})`);
      else {
        mons.push(def);
        monFiles.set(def.id, file);
      }
    }
  }

  // --- areas ---------------------------------------------------------------
  const areas: AreaDef[] = [];
  const areasFile = 'areas.json';
  if (raw.areas !== undefined && !Array.isArray(raw.areas)) err(areasFile, 'areas.json must be an array');
  const allMons = new Map<string, MonDef>([...visibleDeps.flatMap((p) => p.mons.map((x) => [x.id, x] as const)), ...mons.map((x) => [x.id, x] as const)]);
  for (const [k, a] of (Array.isArray(raw.areas) ? raw.areas : []).entries()) {
    const where = `${areasFile}[${k}]`;
    if (!isObj(a) || !isStr(a.id) || namespaceOf(a.id) !== ns || !isStr(a.name) || !isStr(a.boss)) {
      err(where, `area needs id "${ns}:<name>", name and boss`);
      continue;
    }
    if (!allMons.has(a.boss)) err(where, `boss "${a.boss}" is not a known mon`);
    areas.push({ id: a.id, name: a.name, boss: a.boss });
  }
  const areaIds = new Set([...areas.map((a) => a.id), ...visibleDeps.flatMap((p) => p.areas.map((a) => a.id))]);

  // --- cross references ----------------------------------------------------
  for (const def of mons) {
    const file = monFiles.get(def.id) ?? def.id;
    def.evolutions.forEach((evo, k) => {
      const where = `${file} evolutions[${k}]`;
      const target = allMons.get(evo.to);
      const tns = namespaceOf(evo.to);
      if (!target) {
        if (tns !== ns && !depends.some((d) => d.id === tns)) err(where, `target "${evo.to}" is in pack "${tns}", which is not in depends`);
        else err(where, `evolution target "${evo.to}" does not exist`);
      } else if (target.stage !== def.stage + 1) {
        err(where, `target "${evo.to}" is stage ${target.stage}; expected stage ${def.stage + 1}`);
      }
      for (const b of bossList(evo.reqs)) if (!areaIds.has(b)) err(where, `bossCleared "${b}" is not a known area`);
    });
    if (def.stage < 5 && def.evolutions.length > 0 && !def.evolutions.some((e) => isUnconditional(e.reqs)))
      warn(file, 'no unconditional fallback evolution; the mon can get stuck in this stage');
    if (def.stage < 5 && def.evolutions.length === 0) warn(file, 'no evolutions (dead end before Perfect)');
  }

  // --- starters ------------------------------------------------------------
  const starters: string[] = [];
  if (!Array.isArray(m.starters)) err(mf, 'starters must be an array of stage I mon ids');
  for (const s of Array.isArray(m.starters) ? m.starters : []) {
    const def = isStr(s) ? allMons.get(s) : undefined;
    if (!def) err(mf, `starter "${String(s)}" is not a known mon`);
    else if (def.stage !== 1) err(mf, `starter "${def.id}" must be stage 1`);
    else starters.push(def.id);
  }

  if (errors.length > 0) return { pack: null, errors, warnings };
  const manifest: PackManifest = {
    id: ns,
    name: m.name as string,
    version: m.version as string,
    author: m.author as string,
    depends,
    starters,
  };
  return { pack: { manifest, mons, moves, areas, assetUrls: {} }, errors, warnings };
}

function checkMonShape(
  file: string,
  raw: unknown,
  ns: string,
  moveIds: Set<string>,
  assets: RawPack['assets'],
  err: (f: string, m: string) => void,
  warn: (f: string, m: string) => void,
): MonDef | null {
  if (!isObj(raw)) {
    err(file, 'mon must be an object');
    return null;
  }
  const known = new Set(['id', 'name', 'desc', 'stage', 'attribute', 'power', 'moveset', 'poopPerGap', 'careWindows', 'evolutions', 'sprite', 'sfx']);
  for (const k of Object.keys(raw)) if (!known.has(k)) warn(file, `unknown field "${k}" ignored`);

  if (!isStr(raw.id) || namespaceOf(raw.id) !== ns) err(file, `id must be "${ns}:<name>"`);
  if (!isStr(raw.name)) err(file, 'name is required');
  if (typeof raw.desc !== 'string') err(file, 'desc must be a string');
  const stage = raw.stage;
  const stageOk = isInt(stage) && STAGES.includes(stage as Stage);
  if (!stageOk) err(file, 'stage must be an integer 1–6');
  if (!ATTRIBUTES.includes(raw.attribute as never)) err(file, `attribute must be one of ${ATTRIBUTES.join(', ')}`);
  if (!isNum(raw.power) || raw.power < 0) err(file, 'power must be a non-negative number');

  if (!Array.isArray(raw.moveset) || raw.moveset.length === 0) err(file, 'moveset must be a non-empty array');
  else for (const mv of raw.moveset) if (!isStr(mv) || !moveIds.has(mv)) err(file, `moveset references unknown move "${String(mv)}"`);

  if (!isInt(raw.poopPerGap) || raw.poopPerGap < POOP_PER_GAP_MIN || raw.poopPerGap > POOP_PER_GAP_MAX)
    err(file, `poopPerGap must be an integer ${POOP_PER_GAP_MIN}–${POOP_PER_GAP_MAX} (poop cap)`);

  if (raw.careWindows !== undefined && stageOk) {
    const [lo, hi] = WINDOW_COUNT_RANGE[stage as Stage];
    if (!isInt(raw.careWindows) || raw.careWindows < lo || raw.careWindows > hi)
      err(file, `careWindows override must be an integer ${lo}–${hi} for stage ${String(stage)}`);
  }

  const evolutions: EvolutionDef[] = [];
  if (!Array.isArray(raw.evolutions)) err(file, 'evolutions must be an array (can be empty)');
  for (const [k, e] of (Array.isArray(raw.evolutions) ? raw.evolutions : []).entries()) {
    const where = `${file} evolutions[${k}]`;
    if (!isObj(e) || !isStr(e.to)) {
      err(where, 'evolution needs "to"');
      continue;
    }
    const reqs = e.reqs === undefined ? {} : e.reqs;
    if (!isObj(reqs)) {
      err(where, 'reqs must be an object');
      continue;
    }
    for (const [key, val] of Object.entries(reqs)) {
      if (!REQUIREMENT_KEYS.includes(key)) err(where, `unknown requirement "${key}" (allowed: ${REQUIREMENT_KEYS.join(', ')})`);
      else if (key === 'bossCleared') {
        const ok = isStr(val) || (Array.isArray(val) && val.length > 0 && val.every(isStr));
        if (!ok) err(where, 'bossCleared must be an area id or list of ids');
      } else if (typeof val !== 'string' || !parseComparison(val)) {
        err(where, `requirement ${key}: "${String(val)}" is not a comparison like "<=3", ">=5", "2..4"`);
      }
    }
    evolutions.push({ to: e.to, reqs: reqs as Requirements });
  }

  const sprite = checkSprite(file, raw.sprite, assets, err);

  if (raw.sfx !== undefined) {
    if (!isObj(raw.sfx)) err(file, 'sfx must be an object of name → asset path');
    else for (const [k, p] of Object.entries(raw.sfx)) if (!isStr(p) || !(p in assets)) err(file, `sfx "${k}" asset "${String(p)}" not found`);
  }

  if (!sprite) return null;
  return {
    id: raw.id as string,
    name: raw.name as string,
    desc: raw.desc as string,
    stage: stage as Stage,
    attribute: raw.attribute as MonDef['attribute'],
    power: raw.power as number,
    moveset: raw.moveset as string[],
    poopPerGap: raw.poopPerGap as number,
    ...(raw.careWindows !== undefined ? { careWindows: raw.careWindows as number } : {}),
    evolutions,
    sprite,
    ...(isObj(raw.sfx) ? { sfx: raw.sfx as Record<string, string> } : {}),
  };
}

function checkSprite(file: string, s: unknown, assets: RawPack['assets'], err: (f: string, m: string) => void): SpriteDef | null {
  if (!isObj(s)) {
    err(file, 'sprite is required');
    return null;
  }
  let failures = 0;
  const e = (msg: string) => {
    failures++;
    err(file, msg);
  };
  if (!isStr(s.sheet)) e('sprite.sheet is required');
  else if (!(s.sheet in assets)) e(`sprite sheet "${s.sheet}" not found in assets`);
  if (!isInt(s.frames) || s.frames < 1) e('sprite.frames must be a positive integer');
  const anims = s.animations;
  if (!isObj(anims)) e('sprite.animations is required');
  else {
    for (const name of REQUIRED_ANIMATIONS) if (!(name in anims)) e(`missing required animation "${name}"`);
    for (const [name, frames] of Object.entries(anims)) {
      if (!Array.isArray(frames) || frames.length === 0 || !frames.every(isInt)) e(`animation "${name}" must be a non-empty list of frame indexes`);
      else if (isInt(s.frames) && frames.some((f) => f < 0 || f >= (s.frames as number)))
        e(`animation "${name}" uses a frame outside 0–${(s.frames as number) - 1}`);
    }
  }
  if (isStr(s.sheet) && isInt(s.frames)) {
    const size = assets[s.sheet];
    if (size && (size.height !== FRAME_SIZE || size.width !== s.frames * FRAME_SIZE))
      e(`sprite sheet is ${size.width}×${size.height}; expected ${s.frames * FRAME_SIZE}×${FRAME_SIZE} (${s.frames} frames of ${FRAME_SIZE}px)`);
  }
  if (failures > 0) return null;
  return { sheet: s.sheet as string, frames: s.frames as number, animations: anims as Record<string, number[]> };
}
