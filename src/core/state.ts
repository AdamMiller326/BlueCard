import type { Rng } from './rng.ts';
import type { Stage } from './tuning.ts';

export type SlotStatus = 'pending' | 'fed' | 'missed' | 'skipped';
export type CheckStatus = 'pending' | 'pass' | 'fail' | 'skipped';

/** One hunger window. Once status leaves 'pending' it is locked. */
export interface Slot {
  open: number;
  status: SlotStatus;
  /** The window-close event has been processed. */
  closed: boolean;
  resolvedAt?: number;
}

export interface Day {
  start: number;
  nextStart: number;
  slots: Slot[];
  strengthSlot: number;
  strength: CheckStatus;
  lightsOut: number;
  lights: CheckStatus;
  lightsOutSeen: boolean;
  /** Poop cursor: gap index (0..slots.length) and poops already dropped in it. */
  poopGap: number;
  poopsInGap: number;
}

export interface Poop {
  at: number;
  jumbo: boolean;
}

export type SickCause = 'poop' | 'overfeed' | 'injury';

export interface Sickness {
  since: number;
  cause: SickCause;
  /** Hunger windows that closed while sick. 1 = danger, 2 = death. */
  windowsMissed: number;
}

export type MistakeKind = 'hunger' | 'strength' | 'sleep' | 'sickness';

export interface Mistake {
  at: number;
  kind: MistakeKind;
  stage: Stage;
  weight: number;
}

export type DeathCause = 'sickness' | 'neglect';

export interface Mon {
  species: string;
  stage: Stage;
  bornAt: number;
  evolvedAt: number;
  nextEvolutionCheck: number | null;
  level: number;
  weight: number;
  strength: number;
  injuryRate: number;
  stageTrainings: number;
  stageProteins: number;
  totalProteins: number;
  /** Weighted, lifetime. The `careMistakes` evolution counter. */
  careMistakes: number;
  /** Raw mistakes in the current stage, for the death ratio. */
  mistakes: Mistake[];
  poop: Poop[];
  sick: Sickness | null;
  lightsOn: boolean;
  day: Day;
  dead: { at: number; cause: DeathCause } | null;
  history: string[];
}

export interface LogEntry {
  at: number;
  text: string;
}

export interface GameState {
  version: 1;
  /** Everything up to this instant has been processed. */
  time: number;
  dayStartMinutes: number;
  rng: Rng;
  bits: number;
  /** Save-level progress: survives death. */
  bossCleared: string[];
  mon: Mon | null;
  log: LogEntry[];
}
