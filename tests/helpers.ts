import { FakeClock } from '../src/core/clock.ts';
import { act, advance, newGame, type Action, type EngineContext } from '../src/core/engine.ts';
import type { MonDef, Roster } from '../src/core/species.ts';
import type { GameState, Mon } from '../src/core/state.ts';
import { HOUR, MINUTE, type Stage } from '../src/core/tuning.ts';
import type { Requirements } from '../src/core/requirements.ts';

/** 2026-01-05 00:00 UTC. Tests run at UTC+0 with the default 08:00 day start. */
export const DAY0 = Date.UTC(2026, 0, 5);
export const at = (day: number, h: number, m = 0) => DAY0 + day * 24 * HOUR + h * HOUR + m * MINUTE;

type MonOpts = Partial<Omit<MonDef, 'evolutions'>> & { evolutions?: { to: string; reqs?: Requirements }[] };

export function monDef(id: string, stage: Stage, opts: MonOpts = {}): MonDef {
  return {
    id,
    name: id,
    desc: '',
    stage,
    attribute: 'data',
    power: 1,
    moveset: ['t:move'],
    poopPerGap: 4,
    sprite: { sheet: 'x.png', frames: 1, animations: {} },
    ...opts,
    evolutions: (opts.evolutions ?? []).map((e) => ({ to: e.to, reqs: e.reqs ?? {} })),
  };
}

export function roster(mons: MonDef[], starters = [mons[0]!.id]): Roster {
  return { mons: Object.fromEntries(mons.map((m) => [m.id, m])), starters };
}

/** Child (stage 3): 4 windows/day, 36h stage, so a full test day has no evolution. */
export const CHILD = monDef('t:child', 3, { poopPerGap: 4 });
export const CHILD3 = monDef('t:child3', 3, { poopPerGap: 3 });
export const CHILD6 = monDef('t:child6', 3, { poopPerGap: 6 });

/** Thin driver over the pure engine with a fake clock. */
export class Sim {
  clock: FakeClock;
  ctx: EngineContext;
  state: GameState;
  constructor(r: Roster, start: number, seed = 1) {
    this.clock = new FakeClock(start);
    this.ctx = { roster: r, clock: this.clock };
    this.state = newGame(seed, this.ctx);
  }
  get mon(): Mon {
    if (!this.state.mon) throw new Error('no mon');
    return this.state.mon;
  }
  /** Catch-up: jump the clock and run one advance (app was closed). */
  goto(t: number): this {
    this.clock.set(t);
    this.state = advance(this.state, this.ctx);
    return this;
  }
  /** Live play: tick every `step` ms up to t. */
  tickTo(t: number, step = 5 * MINUTE): this {
    while (this.clock.now() < t) {
      this.clock.set(Math.min(t, this.clock.now() + step));
      this.state = advance(this.state, this.ctx);
    }
    return this;
  }
  do(action: Action | Action['type']): { ok: boolean; message: string } {
    const a = (typeof action === 'string' ? { type: action } : action) as Action;
    const r = act(this.state, a, this.ctx);
    this.state = r.state;
    return r;
  }
  /** Ideal check-in at time t: feed, clean, and train to full on the strength slot. */
  checkIn(t: number, train = false): this {
    this.goto(t);
    this.do('feed');
    this.do('clean');
    if (train) for (let i = 0; i < 4; i++) this.do('train');
    return this;
  }
  /** Perfect play for the current day: every window at open+1min, lights off at lights-out. */
  perfectDay(): this {
    const day = this.mon.day;
    day.slots.forEach((s, i) => {
      if (s.status === 'pending') this.checkIn(s.open + MINUTE, i === day.strengthSlot);
    });
    this.goto(this.mon.day.lightsOut + MINUTE);
    this.do('clean');
    this.do('lights');
    return this;
  }
  mistakes(): string[] {
    return this.mon.mistakes.map((m) => m.kind);
  }
}
