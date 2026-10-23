// The check-in engine. `advance` replays every scheduled event between the
// last processed instant and now, in order. It is both the catch-up pass on
// open and the per-tick update while the app is running.

import type { Clock } from './clock.ts';
import { checkInCounters, pickEvolution } from './evolution.ts';
import type { CounterSource } from './requirements.ts';
import { createRng, pick } from './rng.ts';
import {
  earlyCheckinFrom,
  gapAllowsJumbo,
  lightsEnd,
  makeDay,
  nextPendingSlot,
  nextPoopTime,
  seekPoopCursor,
  shiftDay,
  slotClose,
  windowCount,
} from './schedule.ts';
import { getMon, type MonDef, type Roster } from './species.ts';
import type { DeathCause, GameState, Mon, MistakeKind, SickCause } from './state.ts';
import { localTimeAfter, localTimeAtOrBefore } from './time.ts';
import {
  AWAKE_SPAN,
  DAY,
  DEATH_PERIOD_FINAL_STAGE,
  DEATH_PERIOD_MIN,
  DEATH_SHARE,
  DEFAULT_DAY_START_MINUTES,
  EVOLUTION_RECHECK,
  EXTRA_FAILURE_POINTS_PER_DAY,
  INJURY_BASE,
  INJURY_MAX,
  INJURY_MIN,
  INJURY_PER_PROTEIN_BLOCK,
  INJURY_PER_TRAINING,
  LEVEL_CAP,
  LIGHTS_WINDOW_LENGTH,
  MAX_EVENTS_PER_ADVANCE,
  MAX_LATER_SHIFT,
  MINUTE,
  MISTAKE_WEIGHT,
  POOP_POINTS_JUMBO,
  POOP_POINTS_NORMAL,
  PROTEINS_PER_INJURY_BLOCK,
  SICK_POOP_POINTS,
  SICK_WINDOWS_TO_DANGER,
  SICK_WINDOWS_TO_DEATH,
  STAGE_DURATION,
  STARTING_BITS,
  STRENGTH_MAX,
  STRENGTH_PER_PROTEIN,
  STRENGTH_PER_TRAINING,
  VACCINE_COST,
  WEIGHT_BASE,
  WEIGHT_MAX,
  WEIGHT_PER_FEED,
  WEIGHT_PER_PROTEIN,
  WEIGHT_PER_TRAINING,
  type Stage,
} from './tuning.ts';

export interface EngineContext {
  roster: Roster;
  clock: Clock;
  /** Counter seam for evolution. Defaults to check-in counters. */
  counters?: (state: GameState, mon: Mon) => CounterSource;
}

const LOG_LIMIT = 60;

export function newGame(seed: number, ctx: EngineContext): GameState {
  return {
    version: 1,
    time: ctx.clock.now(),
    dayStartMinutes: DEFAULT_DAY_START_MINUTES,
    rng: createRng(seed),
    bits: STARTING_BITS,
    bossCleared: [],
    mon: null,
    log: [],
  };
}

// ---------------------------------------------------------------------------
// Event loop
// ---------------------------------------------------------------------------

type EventKind = 'dayStart' | 'poop' | 'slotClose' | 'lightsOut' | 'lightsClose' | 'evolve';

/**
 * Tie-break for simultaneous events. Tonight's lights check settles before
 * a (shifted) next day can start; poop lands before the window it meets.
 */
const PRIORITY: Record<EventKind, number> = {
  lightsClose: 0,
  dayStart: 1,
  poop: 2,
  slotClose: 3,
  lightsOut: 4,
  evolve: 5,
};

interface PendingEvent {
  kind: EventKind;
  at: number;
}

function nextEvent(mon: Mon, def: MonDef): PendingEvent | null {
  const day = mon.day;
  const cands: PendingEvent[] = [{ kind: 'dayStart', at: day.nextStart }];
  const poopAt = nextPoopTime(day, def.poopPerGap);
  if (poopAt !== null) cands.push({ kind: 'poop', at: poopAt });
  const open = day.slots.find((s) => !s.closed);
  if (open) cands.push({ kind: 'slotClose', at: slotClose(open) });
  if (!day.lightsOutSeen) cands.push({ kind: 'lightsOut', at: day.lightsOut });
  else if (day.lights === 'pending') cands.push({ kind: 'lightsClose', at: lightsEnd(day) });
  if (mon.nextEvolutionCheck !== null) cands.push({ kind: 'evolve', at: mon.nextEvolutionCheck });
  let best: PendingEvent | null = null;
  for (const c of cands) {
    if (!best || c.at < best.at || (c.at === best.at && PRIORITY[c.kind] < PRIORITY[best.kind])) best = c;
  }
  return best;
}

/** Pure: returns a new state with every event up to `ctx.clock.now()` applied. */
export function advance(prev: GameState, ctx: EngineContext): GameState {
  const state = structuredClone(prev);
  advanceInPlace(state, ctx, ctx.clock.now());
  return state;
}

function advanceInPlace(state: GameState, ctx: EngineContext, target: number): void {
  let guard = 0;
  while (state.mon && !state.mon.dead) {
    const mon = state.mon;
    const def = getMon(ctx.roster, mon.species);
    const ev = nextEvent(mon, def);
    if (!ev || ev.at > target) break;
    if (++guard > MAX_EVENTS_PER_ADVANCE) throw new Error('advance: event loop did not settle');
    state.time = Math.max(state.time, ev.at);
    applyEvent(state, mon, def, ev, ctx);
  }
  state.time = Math.max(state.time, target);
}

function applyEvent(state: GameState, mon: Mon, def: MonDef, ev: PendingEvent, ctx: EngineContext): void {
  const t = ev.at;
  const day = mon.day;
  switch (ev.kind) {
    case 'dayStart': {
      const n = windowCount(def, mon.stage);
      const start = day.nextStart;
      const nextStart = localTimeAfter(start + AWAKE_SPAN + LIGHTS_WINDOW_LENGTH, state.dayStartMinutes, ctx.clock);
      mon.day = makeDay(start, n, nextStart);
      mon.lightsOn = true;
      mon.strength = 0;
      return;
    }
    case 'poop': {
      const jumbo = day.poopsInGap + 1 >= def.poopPerGap && gapAllowsJumbo(day, day.poopGap);
      day.poopsInGap++;
      mon.poop.push({ at: t, jumbo });
      if (!mon.sick && poopPoints(mon) >= SICK_POOP_POINTS) makeSick(state, mon, t, 'poop');
      return;
    }
    case 'slotClose': {
      const i = day.slots.findIndex((s) => !s.closed);
      const slot = day.slots[i];
      if (!slot) return;
      slot.closed = true;
      if (slot.status === 'pending') {
        slot.status = 'missed';
        slot.resolvedAt = t;
        addMistake(state, mon, def, t, 'hunger');
        if (mon.dead) return;
      }
      if (i === day.strengthSlot && day.strength === 'pending') {
        if (mon.strength >= STRENGTH_MAX) day.strength = 'pass';
        else {
          day.strength = 'fail';
          addMistake(state, mon, def, t, 'strength');
          if (mon.dead) return;
        }
      }
      if (mon.sick && slot.open >= mon.sick.since) {
        mon.sick.windowsMissed++;
        if (mon.sick.windowsMissed >= SICK_WINDOWS_TO_DEATH) die(state, mon, t, 'sickness');
        else if (mon.sick.windowsMissed === SICK_WINDOWS_TO_DANGER) {
          log(state, t, 'Sickness untreated: danger!');
          addMistake(state, mon, def, t, 'sickness');
        }
      }
      return;
    }
    case 'lightsOut': {
      day.lightsOutSeen = true;
      if (day.lights === 'pending' && !mon.lightsOn) day.lights = 'pass';
      return;
    }
    case 'lightsClose': {
      if (day.lights === 'pending') {
        day.lights = 'fail';
        addMistake(state, mon, def, t, 'sleep');
      }
      return;
    }
    case 'evolve': {
      const src = (ctx.counters ?? checkInCounters)(state, mon);
      const to = pickEvolution(def, src);
      if (!to) {
        mon.nextEvolutionCheck = t + EVOLUTION_RECHECK;
        return;
      }
      evolveTo(state, mon, getMon(ctx.roster, to), t);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export function poopPoints(mon: Mon): number {
  return mon.poop.reduce((sum, p) => sum + (p.jumbo ? POOP_POINTS_JUMBO : POOP_POINTS_NORMAL), 0);
}

function log(state: GameState, at: number, text: string): void {
  state.log.push({ at, text });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function makeSick(state: GameState, mon: Mon, t: number, cause: SickCause): void {
  mon.sick = { since: t, cause, windowsMissed: 0 };
  log(state, t, `Got sick (${cause}).`);
}

function die(state: GameState, mon: Mon, t: number, cause: DeathCause): void {
  mon.dead = { at: t, cause };
  mon.nextEvolutionCheck = null;
  log(state, t, `Died (${cause}).`);
}

/** Possible failure points over the stage's death period. design.md "Care mistakes and death". */
export function deathPeriod(stage: Stage): number {
  const d = STAGE_DURATION[stage];
  return d === null ? DEATH_PERIOD_FINAL_STAGE : Math.max(DEATH_PERIOD_MIN, d);
}

export function deathThreshold(def: MonDef, stage: Stage): number {
  const perDay = windowCount(def, stage) + EXTRA_FAILURE_POINTS_PER_DAY;
  return Math.ceil(DEATH_SHARE * perDay * (deathPeriod(stage) / DAY));
}

/** Raw mistakes in the current stage within the rolling death period ending at t. */
export function recentMistakes(mon: Mon, t: number): number {
  const from = t - deathPeriod(mon.stage);
  return mon.mistakes.filter((m) => m.at > from).length;
}

function addMistake(state: GameState, mon: Mon, def: MonDef, t: number, kind: MistakeKind): void {
  const weight = MISTAKE_WEIGHT[mon.stage];
  mon.careMistakes += weight;
  mon.mistakes.push({ at: t, kind, stage: mon.stage, weight });
  log(state, t, `Care mistake: ${kind}.`);
  if (recentMistakes(mon, t) >= deathThreshold(def, mon.stage)) die(state, mon, t, 'neglect');
}

function evolveTo(state: GameState, mon: Mon, to: MonDef, t: number): void {
  mon.species = to.id;
  mon.stage = to.stage;
  mon.evolvedAt = t;
  const dur = STAGE_DURATION[to.stage];
  mon.nextEvolutionCheck = dur === null ? null : t + dur;
  mon.stageTrainings = 0;
  mon.stageProteins = 0;
  mon.mistakes = [];
  mon.weight = WEIGHT_BASE[to.stage];
  mon.level = Math.min(mon.level, LEVEL_CAP[to.stage]);
  mon.history.push(to.id);
  log(state, t, `Evolved into ${to.name}!`);
}

function hatch(state: GameState, ctx: EngineContext, t: number): string {
  if (ctx.roster.starters.length === 0) throw new Error('Roster has no starters');
  const def = getMon(ctx.roster, pick(state.rng, ctx.roster.starters));
  const start = localTimeAtOrBefore(t, state.dayStartMinutes, ctx.clock);
  const nextStart = localTimeAfter(start + AWAKE_SPAN + LIGHTS_WINDOW_LENGTH, state.dayStartMinutes, ctx.clock);
  const day = makeDay(start, windowCount(def), nextStart, t);
  seekPoopCursor(day, def.poopPerGap, t);
  const dur = STAGE_DURATION[def.stage];
  state.mon = {
    species: def.id,
    stage: def.stage,
    bornAt: t,
    evolvedAt: t,
    nextEvolutionCheck: dur === null ? null : t + dur,
    level: 1,
    weight: WEIGHT_BASE[def.stage],
    strength: 0,
    injuryRate: INJURY_BASE,
    stageTrainings: 0,
    stageProteins: 0,
    totalProteins: 0,
    careMistakes: 0,
    mistakes: [],
    poop: [],
    sick: null,
    lightsOn: true,
    day,
    dead: null,
    history: [def.id],
  };
  return `${def.name} hatched!`;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'hatch' }
  | { type: 'feed' }
  | { type: 'protein' }
  | { type: 'train' }
  | { type: 'clean' }
  | { type: 'lights' }
  | { type: 'medicine' }
  | { type: 'vaccine' }
  | { type: 'setDayStart'; minutes: number }
  /** Debug-only counters (no quest mode yet). */
  | { type: 'debugSetLevel'; level: number }
  | { type: 'debugAddBits'; bits: number };

export interface ActionResult {
  state: GameState;
  ok: boolean;
  message: string;
}

export function isAsleep(mon: Mon, t: number): boolean {
  const day = mon.day;
  if (t < day.lightsOut || t >= day.nextStart) return false;
  return !mon.lightsOn || t >= lightsEnd(day);
}

/** Pure: catches up to now, then applies the action. */
export function act(prev: GameState, action: Action, ctx: EngineContext): ActionResult {
  const state = structuredClone(prev);
  const t = Math.max(state.time, ctx.clock.now());
  advanceInPlace(state, ctx, t);
  const r = (ok: boolean, message: string): ActionResult => {
    if (ok) log(state, t, message);
    return { state, ok, message };
  };

  if (action.type === 'setDayStart') {
    const minutes = ((Math.round(action.minutes) % 1440) + 1440) % 1440;
    let delta = (minutes - state.dayStartMinutes) * MINUTE;
    delta = ((delta % DAY) + DAY) % DAY;
    if (delta > MAX_LATER_SHIFT) delta -= DAY;
    state.dayStartMinutes = minutes;
    if (state.mon && !state.mon.dead) shiftDay(state.mon.day, delta, t);
    return r(true, `Day start set to ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}.`);
  }
  if (action.type === 'debugAddBits') {
    state.bits += action.bits;
    return r(true, `+${action.bits} bits.`);
  }
  if (action.type === 'hatch') {
    if (state.mon && !state.mon.dead) return r(false, 'You already have a mon.');
    return r(true, hatch(state, ctx, t));
  }

  const mon = state.mon;
  if (!mon) return r(false, 'No mon yet.');
  if (mon.dead) return r(false, 'Your mon has passed away.');
  const def = getMon(ctx.roster, mon.species);
  const asleep = isAsleep(mon, t);
  const sleepy = (verb: string) => r(false, `Can't ${verb}: sleeping.`);
  const gainWeight = (g: number) => {
    mon.weight = Math.max(1, mon.weight + g);
    if (!mon.sick && mon.weight >= WEIGHT_MAX[mon.stage]) makeSick(state, mon, t, 'overfeed');
  };

  switch (action.type) {
    case 'feed': {
      if (asleep) return sleepy('eat');
      const i = nextPendingSlot(mon.day);
      const slot = mon.day.slots[i];
      gainWeight(WEIGHT_PER_FEED);
      if (slot && t >= earlyCheckinFrom(mon.day, i) && t < slotClose(slot)) {
        slot.status = 'fed';
        slot.resolvedAt = t;
        return r(true, t < slot.open ? 'Fed early. Next window resolved.' : 'Fed!');
      }
      return r(true, 'Snack. Not hungry, gained weight.');
    }
    case 'protein': {
      if (asleep) return sleepy('eat');
      if (mon.sick) return r(false, 'Too sick to eat protein.');
      mon.strength = Math.min(STRENGTH_MAX, mon.strength + STRENGTH_PER_PROTEIN);
      mon.stageProteins++;
      mon.totalProteins++;
      if (mon.totalProteins % PROTEINS_PER_INJURY_BLOCK === 0) {
        mon.injuryRate = Math.min(INJURY_MAX, mon.injuryRate + INJURY_PER_PROTEIN_BLOCK);
      }
      gainWeight(WEIGHT_PER_PROTEIN);
      return r(true, 'Protein! Strength up.');
    }
    case 'train': {
      if (asleep) return sleepy('train');
      if (mon.sick) return r(false, 'Too sick to train.');
      mon.strength = Math.min(STRENGTH_MAX, mon.strength + STRENGTH_PER_TRAINING);
      mon.stageTrainings++;
      mon.injuryRate = Math.max(INJURY_MIN, mon.injuryRate + INJURY_PER_TRAINING);
      gainWeight(WEIGHT_PER_TRAINING);
      return r(true, 'Training done!');
    }
    case 'clean': {
      if (mon.poop.length === 0) return r(false, 'Nothing to clean.');
      mon.poop = [];
      return r(true, 'Cleaned up.');
    }
    case 'lights': {
      mon.lightsOn = !mon.lightsOn;
      const day = mon.day;
      if (!mon.lightsOn && day.lights === 'pending' && t >= day.lightsOut && t < lightsEnd(day)) day.lights = 'pass';
      return r(true, mon.lightsOn ? 'Lights on.' : 'Lights off.');
    }
    case 'medicine': {
      if (!mon.sick) return r(false, 'Not sick.');
      if (mon.sick.windowsMissed >= SICK_WINDOWS_TO_DANGER) return r(false, 'Too far gone for medicine. Needs a vaccine!');
      mon.sick = null;
      return r(true, 'Medicine given. Feeling better.');
    }
    case 'vaccine': {
      if (!mon.sick) return r(false, 'Not sick.');
      if (state.bits < VACCINE_COST) return r(false, `Vaccine costs ${VACCINE_COST} bits.`);
      state.bits -= VACCINE_COST;
      mon.sick = null;
      return r(true, 'Vaccine given. Rescued!');
    }
    case 'debugSetLevel': {
      mon.level = Math.max(1, Math.min(LEVEL_CAP[mon.stage], Math.round(action.level)));
      return r(true, `Level set to ${mon.level}.`);
    }
  }
  return r(false, 'Unknown action.');
}

/** Advance to an explicit instant (debug tools and tests). */
export function advanceTo(prev: GameState, ctx: EngineContext, target: number): GameState {
  const state = structuredClone(prev);
  advanceInPlace(state, ctx, target);
  return state;
}

/** Time of the next scheduled event (debug "skip to next event"). */
export function peekNextEvent(state: GameState, ctx: EngineContext): { kind: string; at: number } | null {
  const mon = state.mon;
  if (!mon || mon.dead) return null;
  const s = structuredClone(mon);
  return nextEvent(s, getMon(ctx.roster, s.species));
}
