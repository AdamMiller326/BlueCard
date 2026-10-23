import { describe, expect, it } from 'vitest';
import { deathThreshold } from '../src/core/engine.ts';
import { earlyCheckinFrom, gapStartBefore, strengthSlotIndex, windowCount } from '../src/core/schedule.ts';
import { HOUR, MINUTE, STAGES, WINDOW_COUNT_RANGE, WINDOW_LENGTH, AWAKE_SPAN, POOP_CAP, POOP_PER_GAP_MAX, POOP_POINTS_JUMBO, VACCINE_COST } from '../src/core/tuning.ts';
import { hungerHearts } from '../src/core/view.ts';
import { CHILD, Sim, at, monDef, roster } from './helpers.ts';

function day0(r = roster([CHILD])): Sim {
  const sim = new Sim(r, at(0, 7));
  sim.do('hatch');
  return sim.goto(at(0, 8));
}

describe('schedule', () => {
  it('strength check uses the middle window, floor(n/2) for even counts', () => {
    expect(strengthSlotIndex(1)).toBe(0);
    expect(strengthSlotIndex(2)).toBe(1);
    expect(strengthSlotIndex(3)).toBe(1);
    expect(strengthSlotIndex(4)).toBe(2);
    expect(strengthSlotIndex(5)).toBe(2);
  });

  it('pack overrides are clamped to the stage range', () => {
    expect(windowCount(monDef('a', 4, { careWindows: 9 }))).toBe(WINDOW_COUNT_RANGE[4][1]);
    expect(windowCount(monDef('a', 4, { careWindows: 0 }))).toBe(WINDOW_COUNT_RANGE[4][0]);
    expect(windowCount(monDef('a', 4, { careWindows: 2 }))).toBe(2);
  });

  it('windows never overlap at any allowed count (tuning invariant)', () => {
    for (const s of STAGES) {
      const max = WINDOW_COUNT_RANGE[s][1];
      expect(AWAKE_SPAN / (max + 1)).toBeGreaterThanOrEqual(WINDOW_LENGTH);
    }
  });

  it('poop limits derive from the single cap', () => {
    expect(POOP_PER_GAP_MAX + POOP_POINTS_JUMBO).toBeLessThan(POOP_CAP + 1);
    expect(POOP_PER_GAP_MAX - 1 + POOP_POINTS_JUMBO).toBeLessThan(POOP_CAP);
  });
});

describe('hunger windows', () => {
  it('early check-in works only within half the gap before the next window', () => {
    const sim = day0();
    const d = sim.mon.day;
    const from = earlyCheckinFrom(d, 0);
    expect(from).toBe(d.slots[0]!.open - (d.slots[0]!.open - gapStartBefore(d, 0)) / 2);
    sim.goto(from - MINUTE);
    expect(sim.do('feed').message).toMatch(/Snack/);
    expect(sim.mon.day.slots[0]!.status).toBe('pending');
    sim.goto(from + MINUTE);
    expect(sim.do('feed').message).toMatch(/early/);
    expect(sim.mon.day.slots[0]!.status).toBe('fed');
  });

  it('only the next window can be resolved early', () => {
    const sim = day0();
    const s = sim.mon.day.slots;
    sim.checkIn(s[0]!.open + MINUTE);
    sim.do('feed'); // second feed in the same window: slot 1 is not yet in its early range
    expect(sim.mon.day.slots[1]!.status).toBe('pending');
  });

  it('hearts drain toward the next window and hit zero when it opens', () => {
    const sim = day0();
    const s0 = sim.mon.day.slots[0]!;
    expect(hungerHearts(sim.mon, at(0, 8))).toBeCloseTo(4);
    expect(hungerHearts(sim.mon, (at(0, 8) + s0.open) / 2)).toBeCloseTo(2);
    expect(hungerHearts(sim.mon, s0.open)).toBe(0);
    sim.checkIn(s0.open + MINUTE);
    expect(hungerHearts(sim.mon, s0.open + MINUTE)).toBeCloseTo(4);
  });

  it('overfeeding to max weight causes sickness', () => {
    const sim = day0();
    for (let i = 0; i < 30 && !sim.mon.sick; i++) sim.do('feed');
    expect(sim.mon.sick?.cause).toBe('overfeed');
  });
});

describe('strength', () => {
  it('a strength window with no training or protein is a care mistake', () => {
    const sim = day0();
    const s = sim.mon.day.slots;
    for (const slot of s) sim.checkIn(slot.open + MINUTE);
    expect(sim.mistakes()).toEqual(['strength']);
    expect(sim.mon.day.strength).toBe('fail');
  });

  it('protein is the shortcut: two fill the meter', () => {
    const sim = day0();
    const s = sim.mon.day.slots;
    for (const [i, slot] of s.entries()) {
      sim.checkIn(slot.open + MINUTE);
      if (i === sim.mon.day.strengthSlot) {
        sim.do('protein');
        sim.do('protein');
      }
    }
    expect(sim.mon.day.strength).toBe('pass');
    expect(sim.mistakes()).toEqual([]);
  });

  it('every 4 trainings is an effort heart; training lowers injury, protein raises it', () => {
    const sim = day0();
    for (let i = 0; i < 8; i++) sim.do('train');
    expect(sim.mon.stageTrainings).toBe(8);
    const base = sim.mon.injuryRate;
    for (let i = 0; i < 4; i++) sim.do('protein');
    expect(sim.mon.injuryRate).toBe(base + 2);
  });

  it('strength resets at day start', () => {
    const sim = day0();
    for (let i = 0; i < 4; i++) sim.do('train');
    sim.perfectDay();
    sim.goto(at(1, 8, 1));
    expect(sim.mon.strength).toBe(0);
  });
});

describe('sleep', () => {
  it('lights left on through the lights-out window is a care mistake', () => {
    const sim = day0();
    const d = sim.mon.day;
    d.slots.forEach((s, i) => sim.checkIn(s.open + MINUTE, i === d.strengthSlot));
    sim.goto(d.lightsOut + 2 * HOUR + MINUTE);
    expect(sim.mistakes()).toEqual(['sleep']);
  });

  it('lights turned off before the window counts once the window opens', () => {
    const sim = day0();
    const d = sim.mon.day;
    d.slots.forEach((s, i) => sim.checkIn(s.open + MINUTE, i === d.strengthSlot));
    sim.goto(d.lightsOut - 10 * MINUTE);
    sim.do('clean');
    sim.do('lights');
    sim.goto(d.lightsOut + 3 * HOUR);
    expect(sim.mon.day.lights).toBe('pass');
  });

  it('a sleeping mon refuses food and training', () => {
    const sim = day0();
    sim.perfectDay();
    expect(sim.do('feed').ok).toBe(false);
    expect(sim.do('train').ok).toBe(false);
  });
});

describe('weighted mistakes and death ratio', () => {
  it('mistake weight scales by stage', () => {
    const adult = monDef('t:adult', 4);
    const sim = day0(roster([adult]));
    sim.goto(sim.mon.day.slots[0]!.open + WINDOW_LENGTH + MINUTE);
    expect(sim.mon.mistakes).toHaveLength(1);
    expect(sim.mon.careMistakes).toBe(2);
  });

  it('death threshold is ~60% of possible failure points (doc example: Perfect → 5)', () => {
    expect(deathThreshold(monDef('p', 5), 5)).toBe(5); // 2 + 1 + 1 = 4/day × 2 days × 0.6
    expect(deathThreshold(monDef('p', 5, { careWindows: 1 }), 5)).toBe(4);
    expect(deathThreshold(monDef('c', 3), 3)).toBe(6);
  });

  it('one terrible day as a Perfect survives (4 mistakes < 5)', () => {
    const perfect = monDef('t:perfect', 5, { poopPerGap: 3 });
    const sim = day0(roster([perfect]));
    // Ignore the whole day but keep it clean so poop sickness doesn't kick in.
    for (let h = 8; h <= 24; h++) {
      sim.goto(at(0, h));
      sim.do('clean');
    }
    sim.goto(at(1, 7));
    expect(sim.mon.mistakes).toHaveLength(4);
    expect(sim.mon.dead).toBeNull();
    expect(sim.mon.careMistakes).toBe(12);
  });
});

describe('items', () => {
  it('vaccine needs bits', () => {
    const sim = day0();
    for (let i = 0; i < 30 && !sim.mon.sick; i++) sim.do('feed');
    sim.state.bits = VACCINE_COST - 1;
    expect(sim.do('vaccine').ok).toBe(false);
    sim.do({ type: 'debugAddBits', bits: 1 });
    expect(sim.do('vaccine').ok).toBe(true);
    expect(sim.state.bits).toBe(0);
  });
});
