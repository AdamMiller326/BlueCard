// Every tunable number in the game lives here. Each entry points at the
// section of docs/design.md it comes from. "(tune)" = playtest guess.
// "(default)" = not in the design doc; picked during build step 1.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Stages I–VI (Pendulum numbering). design.md "Stage scaling", "Levels". */
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;
export const STAGES: readonly Stage[] = [1, 2, 3, 4, 5, 6];
export const STAGE_NAMES: Record<Stage, string> = {
  1: 'Baby I',
  2: 'Baby II',
  3: 'Child',
  4: 'Adult',
  5: 'Perfect',
  6: 'Mega',
};

// ---------------------------------------------------------------------------
// Care windows — design.md "Care model: fixed check-in windows"
// ---------------------------------------------------------------------------

/** Allowed hunger windows per day by stage; validator clamps pack overrides to this. "Stage scaling" (tune). */
export const WINDOW_COUNT_RANGE: Record<Stage, readonly [number, number]> = {
  1: [4, 5],
  2: [4, 5],
  3: [3, 4],
  4: [2, 3],
  5: [1, 2],
  6: [1, 2],
};

/** Default windows per day when a mon has no override. Upper end of each range, matching the doc's 2-window Perfect example. (default) */
export const WINDOW_COUNT_DEFAULT: Record<Stage, number> = { 1: 5, 2: 5, 3: 4, 4: 3, 5: 2, 6: 2 };

/** Length of every hunger window. "Stage scaling": ~2 hours at every stage (tune). */
export const WINDOW_LENGTH = 2 * HOUR;

/** Hours from day start to the lights-out window. Hunger windows are spaced evenly inside this span. (default) */
export const AWAKE_SPAN = 14 * HOUR;

/** Length of the lights-out window. "Three failure points": sleep. (default) */
export const LIGHTS_WINDOW_LENGTH = 2 * HOUR;

/** Default local day start, minutes after midnight. "Clock and day start". (default) */
export const DEFAULT_DAY_START_MINUTES = 8 * 60;

/** Early check-in: next window can be resolved this fraction of the gap before it opens. "Hunger drives the schedule": ~half (tune). */
export const EARLY_CHECKIN_FRACTION = 0.5;

/** A day start shift of more than this is treated as an earlier shift (wrapping around midnight). (default) */
export const MAX_LATER_SHIFT = 12 * HOUR;

// ---------------------------------------------------------------------------
// Strength — design.md "Strength"
// ---------------------------------------------------------------------------

/** Strength meter size; the daily check passes when full. (default) */
export const STRENGTH_MAX = 4;
/** Strength added per training. (default) */
export const STRENGTH_PER_TRAINING = 1;
/** Strength added per protein: the shortcut is faster. (default) */
export const STRENGTH_PER_PROTEIN = 2;
/** "every 4 trainings = 1 effort heart". */
export const TRAININGS_PER_EFFORT = 4;
/** Effort hearts cap (Pendulum shows 4). (default) */
export const EFFORT_MAX = 4;

// ---------------------------------------------------------------------------
// Weight — design.md "Strength", "Sickness and injury" (overfeeding)
// ---------------------------------------------------------------------------

export const WEIGHT_PER_FEED = 1; // (default)
export const WEIGHT_PER_PROTEIN = 2; // (default)
export const WEIGHT_PER_TRAINING = -1; // (default)
/** Starting weight on hatching/evolving into a stage. (default) */
export const WEIGHT_BASE: Record<Stage, number> = { 1: 5, 2: 10, 3: 20, 4: 30, 5: 40, 6: 50 };
/** Reaching this weight makes the mon sick (overfeeding). (default) */
export const WEIGHT_MAX: Record<Stage, number> = { 1: 15, 2: 25, 3: 40, 4: 55, 5: 70, 6: 85 };

// ---------------------------------------------------------------------------
// Injury — design.md "Sickness and injury" (used by battles in step 2)
// ---------------------------------------------------------------------------

export const INJURY_BASE = 10; // ~10% base (tune)
export const INJURY_PER_PROTEIN_BLOCK = 2; // +2 points...
export const PROTEINS_PER_INJURY_BLOCK = 4; // ...per 4 protein
export const INJURY_PER_TRAINING = -2; // −2 per win or training
export const INJURY_MIN = INJURY_BASE; // training only undoes protein penalty (default)
export const INJURY_MAX = 50; // capped at 50% (tune)

// ---------------------------------------------------------------------------
// Poop and sickness — design.md "Poop"
// ---------------------------------------------------------------------------

/** THE poop cap. Points at or above this make the mon sick. Everything else derives from it. */
export const POOP_CAP = 8;
export const SICK_POOP_POINTS = POOP_CAP;
export const POOP_POINTS_NORMAL = 1;
export const POOP_POINTS_JUMBO = 2;
/** Max poops per gap so that a full gap plus one jumbo stays under the cap (8 − 2 = 6 → 5 + jumbo = 7). */
export const POOP_PER_GAP_MAX = POOP_CAP - POOP_POINTS_JUMBO;
/** Design range is 3–6. */
export const POOP_PER_GAP_MIN = 3;

/** Danger-state misses before death: "One missed window = ... danger. Missing the next one too = death." */
export const SICK_WINDOWS_TO_DANGER = 1;
export const SICK_WINDOWS_TO_DEATH = 2;

// ---------------------------------------------------------------------------
// Care mistakes and death — design.md "Care mistakes and death"
// ---------------------------------------------------------------------------

/** Mistake weight by stage (tune). Feeds the weighted `careMistakes` counter used by evolution. */
export const MISTAKE_WEIGHT: Record<Stage, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3 };

/** Death at this share of the stage's possible failure points (tune). */
export const DEATH_SHARE = 0.6;

/** Failure points per day besides hunger: one strength check + one sleep check. */
export const EXTRA_FAILURE_POINTS_PER_DAY = 2;

// ---------------------------------------------------------------------------
// Evolution and levels — design.md "Levels, evolution and traited eggs"
// ---------------------------------------------------------------------------

/** Real hours in a stage before its evolution check fires. null = final stage. (tune; Perfect = 48h per the death example) */
export const STAGE_DURATION: Record<Stage, number | null> = {
  1: 1 * HOUR,
  2: 24 * HOUR,
  3: 36 * HOUR,
  4: 48 * HOUR,
  5: 48 * HOUR,
  6: null,
};

/** If no evolution branch matches, re-check this often (step 2 levels can change the answer). (default) */
export const EVOLUTION_RECHECK = 24 * HOUR;

/** Rolling period for the death ratio: the stage's duration, but never under a day. Mega uses 48h. (default) */
export const DEATH_PERIOD_MIN = 24 * HOUR;
export const DEATH_PERIOD_FINAL_STAGE = 48 * HOUR;

/** DMX per-stage level caps: I=1, II=3, III=4, IV=6, V=8, VI=10. */
export const LEVEL_CAP: Record<Stage, number> = { 1: 1, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10 };

// ---------------------------------------------------------------------------
// Economy — design.md "Economy and shop" (shop arrives in step 2)
// ---------------------------------------------------------------------------

export const STARTING_BITS = 100; // (default) so a vaccine is available before quests exist
export const VACCINE_COST = 50; // (default)

/** Safety valve for the catch-up loop. Far above a year of events. */
export const MAX_EVENTS_PER_ADVANCE = 200_000;
