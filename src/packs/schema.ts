// Pack file format. design.md "Content packs". Packs are data only.

import type { Attribute, MonDef } from '../core/species.ts';

export interface PackDependency {
  id: string;
  version: string;
}

export interface PackManifest {
  /** Namespace for every id in the pack, e.g. "nsp" → "nsp:agumon". */
  id: string;
  name: string;
  version: string;
  author: string;
  depends: PackDependency[];
  /** Stage I mons a new egg can hatch into. */
  starters: string[];
}

export type MoveStyle = 'mash' | 'meter' | 'sequence';
export const MOVE_STYLES: readonly MoveStyle[] = ['mash', 'meter', 'sequence'];

export interface MoveDef {
  id: string;
  name: string;
  style: MoveStyle;
  tiers: { bad: number; good: number; great: number };
  anim: string;
}

/** Quest areas arrive in step 2; step 1 only needs ids so `bossCleared` can be validated. */
export interface AreaDef {
  id: string;
  name: string;
  boss: string;
}

export interface Pack {
  manifest: PackManifest;
  mons: MonDef[];
  moves: MoveDef[];
  areas: AreaDef[];
  /** Asset path (relative to pack root) → URL or data the UI can load. Filled by the loader. */
  assetUrls: Record<string, string>;
}

/** Fixed sprite spec: square frames in a horizontal strip. */
export const FRAME_SIZE = 32;
export const REQUIRED_ANIMATIONS = ['idle', 'eat', 'happy', 'refuse', 'sleep', 'sick', 'attack'] as const;

export const ASSET_EXTENSIONS = ['.png', '.webp', '.ogg', '.mp3', '.wav'] as const;

export type { Attribute, MonDef };
