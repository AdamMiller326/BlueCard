import type { Requirements } from './requirements.ts';
import type { Stage } from './tuning.ts';

export type Attribute = 'vaccine' | 'data' | 'virus' | 'free';
export const ATTRIBUTES: readonly Attribute[] = ['vaccine', 'data', 'virus', 'free'];

export interface EvolutionDef {
  to: string;
  reqs: Requirements;
}

/** Horizontal strip of square frames; animations index into it. */
export interface SpriteDef {
  sheet: string;
  frames: number;
  animations: Record<string, number[]>;
}

/** A mon as core sees it, after pack loading and validation. */
export interface MonDef {
  id: string;
  name: string;
  desc: string;
  stage: Stage;
  attribute: Attribute;
  power: number;
  moveset: string[];
  poopPerGap: number;
  careWindows?: number;
  evolutions: EvolutionDef[];
  sprite: SpriteDef;
  sfx?: Record<string, string>;
}

/** Everything core needs from the loaded packs. */
export interface Roster {
  mons: Record<string, MonDef>;
  /** Stage I mons a new egg can hatch into. */
  starters: string[];
}

export function getMon(roster: Roster, id: string): MonDef {
  const def = roster.mons[id];
  if (!def) throw new Error(`Unknown mon ${id}`);
  return def;
}
