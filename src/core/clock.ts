/**
 * The only way core learns the time. Real time (check-in mode), fake time
 * (tests) and played time (active mode, later) all implement this.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
  /** Local offset from UTC in minutes at instant `at` (e.g. +60 for UTC+1). */
  utcOffsetMinutes(at: number): number;
}

/** Manually driven clock for tests and tools. */
export class FakeClock implements Clock {
  t: number;
  offset: number;
  constructor(start: number, utcOffsetMinutes = 0) {
    this.t = start;
    this.offset = utcOffsetMinutes;
  }
  now(): number {
    return this.t;
  }
  utcOffsetMinutes(): number {
    return this.offset;
  }
  set(t: number): void {
    this.t = t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
