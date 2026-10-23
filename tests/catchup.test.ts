// The catch-up pass. Every case from CLAUDE.md "Testing", with a fake clock.
import { describe, expect, it } from 'vitest';
import { advance, poopPoints } from '../src/core/engine.ts';
import { HOUR, MINUTE } from '../src/core/tuning.ts';
import { CHILD, CHILD3, Sim, at, monDef, roster } from './helpers.ts';

/** Hatch at 07:00 on day 0, before the 08:00 day start, so the first full day starts at 08:00. */
function hatched(r = roster([CHILD]), t = at(0, 7)): Sim {
  const sim = new Sim(r, t);
  sim.do('hatch');
  return sim;
}

describe('catch-up: normal day', () => {
  it('perfect care through a whole day causes no mistakes or sickness', () => {
    const sim = hatched();
    sim.goto(at(0, 8));
    expect(sim.mon.day.start).toBe(at(0, 8));
    expect(sim.mon.day.slots).toHaveLength(4);
    sim.perfectDay();
    sim.goto(at(1, 8, 1));
    expect(sim.mistakes()).toEqual([]);
    expect(sim.mon.sick).toBeNull();
    expect(sim.mon.dead).toBeNull();
    expect(sim.mon.day.start).toBe(at(1, 8));
  });

  it('window times are fixed for the day and do not move when feeding', () => {
    const sim = hatched().goto(at(0, 8));
    const opens = sim.mon.day.slots.map((s) => s.open);
    sim.checkIn(opens[0]! - 30 * MINUTE); // early check-in
    sim.checkIn(opens[1]! + 90 * MINUTE); // late in the window
    expect(sim.mon.day.slots.map((s) => s.open)).toEqual(opens);
  });

  it('no poop is dropped during sleep', () => {
    const sim = hatched().goto(at(0, 8));
    sim.perfectDay();
    const lightsOut = sim.mon.day.lightsOut;
    sim.goto(at(1, 7, 59));
    expect(sim.mon.poop.every((p) => p.at <= lightsOut)).toBe(true);
    expect(sim.mon.poop).toHaveLength(0);
  });

  it('a 6-per-gap mon cleaned at every check-in never reaches the cap', () => {
    const six = monDef('t:six', 3, { poopPerGap: 6 });
    const sim = hatched(roster([six])).goto(at(0, 8));
    let peak = 0;
    const day = sim.mon.day;
    for (const s of day.slots) {
      sim.goto(s.open);
      peak = Math.max(peak, poopPoints(sim.mon));
      sim.do('feed');
      sim.do('clean');
    }
    sim.goto(day.lightsOut);
    peak = Math.max(peak, poopPoints(sim.mon));
    expect(peak).toBe(7); // 5 + jumbo
    expect(sim.mon.sick).toBeNull();
  });
});

describe('catch-up: one missed window', () => {
  it('counts one hunger mistake and makes a 4-per-gap mon sick', () => {
    const sim = hatched().goto(at(0, 8));
    const slots = sim.mon.day.slots;
    sim.checkIn(slots[0]!.open + MINUTE);
    // skip slot 1, come back at slot 2
    sim.goto(slots[2]!.open + MINUTE);
    expect(sim.mistakes()).toEqual(['hunger']);
    expect(sim.mon.day.slots[1]!.status).toBe('missed');
    expect(sim.mon.sick?.cause).toBe('poop');
    // Sick only appears because a check-in was skipped.
  });

  it('a 3-per-gap mon forgives one miss on poop (merged gap has one jumbo)', () => {
    const sim = hatched(roster([CHILD3])).goto(at(0, 8));
    const slots = sim.mon.day.slots;
    sim.checkIn(slots[0]!.open + MINUTE);
    sim.goto(slots[2]!.open + MINUTE);
    expect(sim.mistakes()).toEqual(['hunger']);
    expect(poopPoints(sim.mon)).toBe(7);
    expect(sim.mon.sick).toBeNull();
  });

  it('a missed slot stays missed: feeding late does not reopen it', () => {
    const sim = hatched().goto(at(0, 8));
    const s0 = sim.mon.day.slots[0]!;
    sim.goto(s0.open + 2 * HOUR + MINUTE);
    sim.do('feed');
    expect(sim.mon.day.slots[0]!.status).toBe('missed');
    expect(sim.mistakes()).toEqual(['hunger']);
  });
});

describe('catch-up: two missed windows (sickness → death path)', () => {
  function sickAfterMiss(): Sim {
    const sim = hatched().goto(at(0, 8));
    sim.checkIn(sim.mon.day.slots[0]!.open + MINUTE);
    return sim;
  }

  it('sick, untreated through the next window → danger, then death', () => {
    const sim = sickAfterMiss();
    const slots = sim.mon.day.slots;
    // Away from slot 1 onward. Sick during gap 2 (after the missed slot 1).
    sim.goto(slots[2]!.open - MINUTE);
    expect(sim.mon.sick).not.toBeNull();
    expect(sim.mon.sick!.windowsMissed).toBe(0);
    sim.goto(slots[2]!.open + 2 * HOUR + MINUTE); // slot 2 closes: the treat-by deadline
    expect(sim.mon.sick!.windowsMissed).toBe(1);
    expect(sim.mistakes()).toEqual(['hunger', 'hunger', 'strength', 'sickness']);
    expect(sim.mon.dead).toBeNull();
    sim.goto(slots[3]!.open + 2 * HOUR + MINUTE); // next window too → death
    expect(sim.mon.dead?.cause).toBe('sickness');
    expect(sim.mon.dead?.at).toBe(slots[3]!.open + 2 * HOUR);
  });

  it('medicine fails in danger; a vaccine rescues and costs bits', () => {
    const sim = sickAfterMiss();
    const slots = sim.mon.day.slots;
    sim.goto(slots[2]!.open + 2 * HOUR + MINUTE);
    expect(sim.do('medicine').ok).toBe(false);
    const bits = sim.state.bits;
    expect(sim.do('vaccine').ok).toBe(true);
    expect(sim.state.bits).toBeLessThan(bits);
    expect(sim.mon.sick).toBeNull();
    sim.do('clean');
    sim.checkIn(slots[3]!.open + MINUTE);
    sim.goto(slots[3]!.open + 2 * HOUR + MINUTE);
    expect(sim.mon.dead).toBeNull();
  });

  it('medicine before the deadline cures with no extra mistake', () => {
    const sim = sickAfterMiss();
    const slots = sim.mon.day.slots;
    sim.goto(slots[2]!.open + MINUTE);
    expect(sim.do('medicine').ok).toBe(true);
    sim.do('feed');
    sim.do('clean');
    sim.goto(slots[3]!.open + 2 * HOUR + MINUTE);
    expect(sim.mistakes().filter((k) => k === 'sickness')).toEqual([]);
  });
});

describe('catch-up: multi-day absence', () => {
  it('one big catch-up equals ticking through every minute (deterministic replay)', () => {
    const a = hatched().goto(at(0, 8));
    a.checkIn(a.mon.day.slots[0]!.open + MINUTE);
    const b = new Sim(a.ctx.roster, a.clock.now());
    b.state = structuredClone(a.state);
    a.goto(at(5, 12));
    b.tickTo(at(5, 12), 7 * MINUTE);
    expect(b.state).toEqual(a.state);
  });

  it('a neglected mon dies and nothing happens after death', () => {
    const sim = hatched().goto(at(0, 8));
    sim.goto(at(6, 12));
    expect(sim.mon.dead).not.toBeNull();
    const frozen = structuredClone(sim.state.mon);
    sim.goto(at(9, 12));
    expect(sim.state.mon).toEqual(frozen);
  });

  it('a neglected mon with no poop sickness dies of neglect at the ratio threshold', () => {
    // 3-per-gap mon, but clean (no sickness): only window/strength/sleep mistakes.
    const sim = hatched(roster([CHILD3])).goto(at(0, 8));
    // Keep it clean, never feed. Child: 4 windows + 2 = 6 points/day, 36h → 9 possible → death at ceil(5.4)=6.
    for (let h = 8; h < 8 + 48; h += 1) {
      sim.goto(at(0, h));
      sim.do('clean');
      if (sim.mon.sick) sim.do('medicine');
      if (sim.mon.dead) break;
    }
    expect(sim.mon.dead?.cause).toBe('neglect');
    expect(sim.mon.mistakes.length).toBe(6);
  });

  it('a missed day starts on schedule, then the mon dies within it', () => {
    const sim = hatched().goto(at(0, 8));
    sim.perfectDay();
    sim.goto(at(3, 9)); // away from 22:01 on day 0
    expect(sim.mon.day.start).toBe(at(1, 8));
    expect(sim.mon.dead).not.toBeNull();
    expect(sim.mon.dead!.at).toBeLessThan(at(2, 0));
  });

  it('uses the local clock: day start follows the UTC offset', () => {
    const sim = new Sim(roster([CHILD]), at(0, 7));
    sim.clock.offset = 9 * 60; // UTC+9: 08:00 local = 23:00 UTC the previous day
    sim.do('hatch'); // 16:00 local
    expect(sim.mon.day.start).toBe(at(0, -1));
    expect(sim.mon.day.nextStart).toBe(at(0, 23));
  });
});

describe('catch-up: day-start shift mid-day', () => {
  it('a later shift moves unresolved slots later and keeps resolved ones locked', () => {
    const sim = hatched().goto(at(0, 8));
    const before = sim.mon.day.slots.map((s) => s.open);
    sim.checkIn(before[0]! + MINUTE);
    sim.goto(at(0, 12));
    sim.do({ type: 'setDayStart', minutes: 10 * 60 });
    const after = sim.mon.day.slots.map((s) => s.open);
    expect(after[0]).toBe(before[0]);
    expect(sim.mon.day.slots[0]!.status).toBe('fed');
    for (let i = 1; i < 4; i++) expect(after[i]).toBe(before[i]! + 2 * HOUR);
    expect(sim.mon.day.slots).toHaveLength(4); // never deletes slots
    // Old slot-1 time passes without a mistake.
    sim.goto(before[1]! + 2 * HOUR + MINUTE);
    expect(sim.mistakes()).toEqual([]);
    expect(sim.mon.day.lightsOut).toBe(at(0, 24));
    expect(sim.mon.day.nextStart).toBe(at(1, 10));
  });

  it('an earlier shift never pulls today in or reopens missed slots; it applies tomorrow', () => {
    const sim = hatched().goto(at(0, 8));
    const before = sim.mon.day.slots.map((s) => s.open);
    sim.goto(before[0]! + 2 * HOUR + MINUTE); // slot 0 missed
    sim.do({ type: 'setDayStart', minutes: 6 * 60 });
    expect(sim.mon.day.slots.map((s) => s.open)).toEqual(before);
    expect(sim.mon.day.slots[0]!.status).toBe('missed');
    expect(sim.mon.day.nextStart).toBe(at(1, 6));
  });

  it('shifting at night only moves the next day start', () => {
    const sim = hatched().goto(at(0, 8));
    sim.perfectDay();
    sim.goto(at(0, 23));
    sim.do({ type: 'setDayStart', minutes: 9 * 60 });
    expect(sim.mon.day.start).toBe(at(0, 8));
    expect(sim.mon.day.nextStart).toBe(at(1, 9));
    sim.goto(at(1, 9, 1));
    expect(sim.mon.day.start).toBe(at(1, 9));
    expect(sim.mistakes()).toEqual([]);
  });

  it('an earlier shift during the night clamps so tonight’s sleep check still runs', () => {
    const sim = hatched().goto(at(0, 8));
    sim.perfectDay();
    sim.goto(at(0, 23, 30));
    sim.do({ type: 'setDayStart', minutes: 0 }); // midnight: would start before lights-out ends
    expect(sim.mon.day.nextStart).toBe(at(1, 0));
    sim.goto(at(1, 0, 1));
    expect(sim.mon.day.start).toBe(at(1, 0));
    expect(sim.mistakes()).toEqual([]);
  });
});

describe('catch-up: closed-app evolution timer', () => {
  it('evolves at the timer instant using counters as of that instant', () => {
    const baby = monDef('t:baby', 1, { poopPerGap: 3, evolutions: [{ to: 't:good', reqs: { careMistakes: '<=0' } }, { to: 't:bad' }] });
    const good = monDef('t:good', 2);
    const bad = monDef('t:bad', 2);
    const r = roster([baby, good, bad]);
    // Hatch at 09:00 (5 windows: first opens 10:20). Evolution fires at 10:00, before the first miss at 12:20.
    const sim = new Sim(r, at(0, 9));
    sim.do('hatch');
    sim.goto(at(0, 13)); // app closed for 4 hours
    expect(sim.mon.species).toBe('t:good');
    expect(sim.mon.evolvedAt).toBe(at(0, 10));
    expect(sim.mon.history).toEqual(['t:baby', 't:good']);
    expect(sim.mon.careMistakes).toBeGreaterThan(0); // mistakes after evolving don't change the branch
  });

  it('takes the fallback branch when requirements fail', () => {
    const baby = monDef('t:baby', 1, { evolutions: [{ to: 't:good', reqs: { effort: '>=1' } }, { to: 't:bad' }] });
    const sim = new Sim(roster([baby, monDef('t:good', 2), monDef('t:bad', 2)]), at(0, 9));
    sim.do('hatch');
    sim.goto(at(0, 11));
    expect(sim.mon.species).toBe('t:bad');
  });

  it('stays and rechecks when no branch matches', () => {
    const baby = monDef('t:baby', 1, { evolutions: [{ to: 't:good', reqs: { level: '>=2' } }] });
    const sim = new Sim(roster([baby, monDef('t:good', 2)]), at(0, 9));
    sim.do('hatch');
    sim.goto(at(0, 11));
    expect(sim.mon.species).toBe('t:baby');
    expect(sim.mon.nextEvolutionCheck).toBe(at(0, 10) + 24 * HOUR);
  });

  it('slot count for the day stays fixed after evolving mid-day', () => {
    const child = monDef('t:c', 3, { evolutions: [{ to: 't:a' }] });
    const adult = monDef('t:a', 4);
    const sim = new Sim(roster([child, adult]), at(0, 7));
    sim.do('hatch');
    sim.goto(at(0, 8)).perfectDay();
    sim.goto(at(1, 8)); // day 1: 4 windows as a child
    const slots = sim.mon.day.slots;
    slots.slice(0, 3).forEach((s, i) => sim.checkIn(s.open + MINUTE, i === 2));
    sim.goto(at(1, 19)); // evolves at hatch + 36h = day 1 19:00
    expect(sim.mon.stage).toBe(4);
    expect(sim.mon.day.slots).toHaveLength(4);
    sim.perfectDay(); // finishes slot 3 and lights-out as an adult
    sim.goto(at(2, 8, 1));
    expect(sim.mistakes()).toEqual([]);
    expect(sim.mon.day.slots).toHaveLength(3);
  });
});

describe('advance is pure', () => {
  it('does not mutate its input', () => {
    const sim = hatched();
    const snapshot = structuredClone(sim.state);
    sim.clock.set(at(3, 0));
    advance(sim.state, sim.ctx);
    expect(sim.state).toEqual(snapshot);
  });
});
