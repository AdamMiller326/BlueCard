// Daily care schedule: hunger windows, strength slot, lights-out window,
// poop gaps. design.md "Care model: fixed check-in windows", "Poop".

import type { MonDef } from './species.ts';
import type { Day, Slot } from './state.ts';
import {
  AWAKE_SPAN,
  EARLY_CHECKIN_FRACTION,
  LIGHTS_WINDOW_LENGTH,
  WINDOW_COUNT_DEFAULT,
  WINDOW_COUNT_RANGE,
  WINDOW_LENGTH,
  type Stage,
} from './tuning.ts';

/** Hunger windows per day for this mon: its override clamped to the stage range, else the stage default. */
export function windowCount(def: MonDef, stage: Stage = def.stage): number {
  const [min, max] = WINDOW_COUNT_RANGE[stage];
  const n = def.careWindows ?? WINDOW_COUNT_DEFAULT[stage];
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Strength check sits on the middle window; index floor(n/2) for even counts. */
export function strengthSlotIndex(n: number): number {
  return Math.floor(n / 2);
}

/** Even spacing: n windows split the awake span into n+1 equal gaps. */
export function slotOpenTime(start: number, n: number, i: number): number {
  return start + ((i + 1) * AWAKE_SPAN) / (n + 1);
}

export function lightsEnd(day: Day): number {
  return day.lightsOut + LIGHTS_WINDOW_LENGTH;
}

export function slotClose(slot: Slot): number {
  return slot.open + WINDOW_LENGTH;
}

/**
 * Builds a day. If `bornAt` falls inside it, everything that already passed
 * is marked skipped so a newborn isn't charged for windows it never had.
 */
export function makeDay(start: number, n: number, nextStart: number, bornAt?: number): Day {
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const open = slotOpenTime(start, n, i);
    const past = bornAt !== undefined && open <= bornAt;
    slots.push({ open, status: past ? 'skipped' : 'pending', closed: past });
  }
  const strengthSlot = strengthSlotIndex(n);
  const lightsOut = start + AWAKE_SPAN;
  const day: Day = {
    start,
    nextStart,
    slots,
    strengthSlot,
    strength: slots[strengthSlot]?.status === 'skipped' ? 'skipped' : 'pending',
    lightsOut,
    lights: bornAt !== undefined && bornAt >= lightsOut ? 'skipped' : 'pending',
    lightsOutSeen: bornAt !== undefined && bornAt >= lightsOut,
    poopGap: 0,
    poopsInGap: 0,
  };
  return day;
}

/** Gap boundaries: day start, each window open, lights-out. Gap g spans [b[g], b[g+1]]. */
export function gapBounds(day: Day, g: number): [number, number] {
  const a = g === 0 ? day.start : (day.slots[g - 1]?.open ?? day.lightsOut);
  const b = g < day.slots.length ? (day.slots[g]?.open ?? day.lightsOut) : day.lightsOut;
  return [a, b];
}

/**
 * At most one jumbo per gap; a missed window merges two gaps into one, so
 * the gap after a missed window gets no jumbo of its own.
 */
export function gapAllowsJumbo(day: Day, g: number): boolean {
  return g === 0 || day.slots[g - 1]?.status !== 'missed';
}

/** Place the poop cursor at time t without dropping anything (newborns). */
export function seekPoopCursor(day: Day, perGap: number, t: number): void {
  const n = day.slots.length;
  day.poopGap = n + 1;
  day.poopsInGap = 0;
  if (t < day.start) {
    day.poopGap = 0;
    return;
  }
  for (let g = 0; g <= n; g++) {
    const [a, b] = gapBounds(day, g);
    if (t < b) {
      day.poopGap = g;
      day.poopsInGap = Math.min(perGap, Math.floor(((t - a) * perGap) / (b - a)));
      return;
    }
  }
}

/** Time of the next scheduled poop, or null if the day has no more. Normalizes the cursor. */
export function nextPoopTime(day: Day, perGap: number): number | null {
  const n = day.slots.length;
  while (day.poopGap <= n) {
    if (day.poopsInGap >= perGap) {
      day.poopGap++;
      day.poopsInGap = 0;
      continue;
    }
    const [a, b] = gapBounds(day, day.poopGap);
    return a + ((day.poopsInGap + 1) * (b - a)) / perGap;
  }
  return null;
}

/** Index of the next unresolved hunger slot, or -1. */
export function nextPendingSlot(day: Day): number {
  return day.slots.findIndex((s) => s.status === 'pending');
}

/** Start of the gap leading into slot i (previous window open, or day start). */
export function gapStartBefore(day: Day, i: number): number {
  return i === 0 ? day.start : (day.slots[i - 1]?.open ?? day.start);
}

/** Earliest time slot i can be resolved by early check-in. */
export function earlyCheckinFrom(day: Day, i: number): number {
  const slot = day.slots[i];
  if (!slot) return Infinity;
  return slot.open - EARLY_CHECKIN_FRACTION * (slot.open - gapStartBefore(day, i));
}

/**
 * Applies a day-start change. Resolved slots are locked. A later shift
 * moves today's unresolved slots (and lights-out, if not reached) later.
 * An earlier shift never pulls today's slots in; it takes effect at the
 * next day start, cutting tonight's sleep short instead.
 */
export function shiftDay(day: Day, delta: number, now: number): void {
  const end = lightsEnd(day);
  if (delta > 0) {
    const inNight = day.lightsOutSeen || now >= day.lightsOut;
    if (!inNight) {
      day.start += delta;
      const n = day.slots.length;
      day.slots.forEach((s, i) => {
        if (s.status === 'pending' && !s.closed) s.open = slotOpenTime(day.start, n, i);
      });
      day.lightsOut = day.start + AWAKE_SPAN;
    }
    day.nextStart += delta;
  } else if (delta < 0) {
    day.nextStart = Math.max(day.nextStart + delta, end, now);
  }
}
