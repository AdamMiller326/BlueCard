import type { Clock } from '../core/clock.ts';

const KEY = 'dm-vpet-debug-clock';

/**
 * Real clock with a debug speed multiplier and skip-ahead. At speed 1 with no
 * skips it is plain wall time. Persisted so a reload doesn't jump back.
 */
export class DebugClock implements Clock {
  private anchorReal = Date.now();
  private anchorGame = Date.now();
  speed = 1;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { anchorReal: number; anchorGame: number; speed: number } | null;
      if (saved) Object.assign(this, { anchorReal: saved.anchorReal, anchorGame: saved.anchorGame, speed: saved.speed });
    } catch {
      // storage unavailable: plain real time
    }
  }

  now(): number {
    return Math.round(this.anchorGame + (Date.now() - this.anchorReal) * this.speed);
  }

  utcOffsetMinutes(at: number): number {
    return -new Date(at).getTimezoneOffset();
  }

  get isReal(): boolean {
    return this.speed === 1 && Math.abs(this.now() - Date.now()) < 1000;
  }

  setSpeed(speed: number): void {
    this.reanchor();
    this.speed = speed;
    this.persist();
  }

  skip(ms: number): void {
    this.reanchor();
    this.anchorGame += ms;
    this.persist();
  }

  /** Jump so that now() equals t (never backwards). */
  jumpTo(t: number): void {
    this.skip(Math.max(0, t - this.now()));
  }

  resetToReal(): void {
    this.anchorReal = Date.now();
    this.anchorGame = Date.now();
    this.speed = 1;
    this.persist();
  }

  private reanchor(): void {
    const n = this.now();
    this.anchorReal = Date.now();
    this.anchorGame = n;
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ anchorReal: this.anchorReal, anchorGame: this.anchorGame, speed: this.speed }));
    } catch {
      // ignore
    }
  }
}
