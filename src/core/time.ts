import type { Clock } from './clock.ts';
import { DAY, MINUTE } from './tuning.ts';

type Offset = Pick<Clock, 'utcOffsetMinutes'>;

function toUtc(localMs: number, clock: Offset, near: number): number {
  // Resolve the offset at the target instant, not at `near`, so DST is honored.
  const guess = localMs - clock.utcOffsetMinutes(near) * MINUTE;
  return localMs - clock.utcOffsetMinutes(guess) * MINUTE;
}

/** Most recent instant at or before `t` whose local time of day is `minutes`. */
export function localTimeAtOrBefore(t: number, minutes: number, clock: Offset): number {
  const local = t + clock.utcOffsetMinutes(t) * MINUTE;
  let cand = Math.floor(local / DAY) * DAY + minutes * MINUTE;
  if (cand > local) cand -= DAY;
  return toUtc(cand, clock, t);
}

/** First instant strictly after `t` whose local time of day is `minutes`. */
export function localTimeAfter(t: number, minutes: number, clock: Offset): number {
  const local = t + clock.utcOffsetMinutes(t) * MINUTE;
  let cand = Math.floor(local / DAY) * DAY + minutes * MINUTE;
  if (cand <= local) cand += DAY;
  return toUtc(cand, clock, t);
}

/** Local minutes after midnight at `t`. */
export function localMinutes(t: number, clock: Offset): number {
  const local = t + clock.utcOffsetMinutes(t) * MINUTE;
  return Math.floor((((local % DAY) + DAY) % DAY) / MINUTE);
}
