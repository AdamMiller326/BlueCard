// Read-only projections of state for the UI. Hearts are a view of the
// schedule, not a simulation. design.md "Hunger drives the schedule".

import { effortHearts } from './evolution.ts';
import { deathThreshold, isAsleep, poopPoints, recentMistakes } from './engine.ts';
import { earlyCheckinFrom, gapStartBefore, lightsEnd, nextPendingSlot, slotClose } from './schedule.ts';
import { getMon, type Roster } from './species.ts';
import type { GameState, Mon } from './state.ts';
import { SICK_WINDOWS_TO_DANGER, STRENGTH_MAX } from './tuning.ts';

export const HEART_COUNT = 4;

/** 0..HEART_COUNT. Drains from the last resolution toward the next window's open time. */
export function hungerHearts(mon: Mon, t: number): number {
  const day = mon.day;
  const i = nextPendingSlot(day);
  const slot = day.slots[i];
  if (!slot) return HEART_COUNT;
  if (t >= slot.open) return 0;
  const prev = day.slots[i - 1];
  const anchor = Math.min(t, prev?.resolvedAt ?? gapStartBefore(day, i));
  const span = slot.open - anchor;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(HEART_COUNT, (HEART_COUNT * (slot.open - t)) / span));
}

export interface MonView {
  name: string;
  stageIndex: number;
  hearts: number;
  strength: number;
  strengthMax: number;
  effort: number;
  weight: number;
  level: number;
  careMistakes: number;
  recentMistakes: number;
  deathAt: number;
  poopCount: number;
  poopPoints: number;
  sick: boolean;
  danger: boolean;
  asleep: boolean;
  lightsOn: boolean;
  dead: boolean;
  /** Next unresolved hunger window, if any today. */
  nextWindow: { open: number; close: number; earlyFrom: number; isStrength: boolean } | null;
  windowOpen: boolean;
  canFeedNow: boolean;
  strengthCheck: { at: number; status: string } | null;
  lightsOut: { from: number; to: number; status: string };
  nextDayStart: number;
  nextEvolutionCheck: number | null;
  slots: { open: number; status: string; isStrength: boolean }[];
}

export function viewMon(state: GameState, roster: Roster, t: number): MonView | null {
  const mon = state.mon;
  if (!mon) return null;
  const def = getMon(roster, mon.species);
  const day = mon.day;
  const i = nextPendingSlot(day);
  const slot = day.slots[i];
  const strengthSlot = day.slots[day.strengthSlot];
  const nextWindow = slot
    ? { open: slot.open, close: slotClose(slot), earlyFrom: earlyCheckinFrom(day, i), isStrength: i === day.strengthSlot }
    : null;
  return {
    name: def.name,
    stageIndex: mon.stage,
    hearts: hungerHearts(mon, t),
    strength: mon.strength,
    strengthMax: STRENGTH_MAX,
    effort: effortHearts(mon),
    weight: mon.weight,
    level: mon.level,
    careMistakes: mon.careMistakes,
    recentMistakes: recentMistakes(mon, t),
    deathAt: deathThreshold(def, mon.stage),
    poopCount: mon.poop.length,
    poopPoints: poopPoints(mon),
    sick: mon.sick !== null,
    danger: (mon.sick?.windowsMissed ?? 0) >= SICK_WINDOWS_TO_DANGER,
    asleep: isAsleep(mon, t),
    lightsOn: mon.lightsOn,
    dead: mon.dead !== null,
    nextWindow,
    windowOpen: !!nextWindow && t >= nextWindow.open && t < nextWindow.close,
    canFeedNow: !!nextWindow && t >= nextWindow.earlyFrom && t < nextWindow.close,
    strengthCheck: strengthSlot ? { at: slotClose(strengthSlot), status: day.strength } : null,
    lightsOut: { from: day.lightsOut, to: lightsEnd(day), status: day.lights },
    nextDayStart: day.nextStart,
    nextEvolutionCheck: mon.nextEvolutionCheck,
    slots: day.slots.map((s, k) => ({ open: s.open, status: s.status, isStrength: k === day.strengthSlot })),
  };
}
