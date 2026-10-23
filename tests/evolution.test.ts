import { describe, expect, it } from 'vitest';
import { pickEvolution } from '../src/core/evolution.ts';
import { parseComparison, requirementsMet, type CounterSource, type NumericRequirement } from '../src/core/requirements.ts';
import { monDef } from './helpers.ts';

/** Evolution reads any counter source, e.g. one an active-play mode would supply. */
function source(counters: Partial<Record<NumericRequirement, number>>, bosses: string[] = []): CounterSource {
  return { counter: (k) => counters[k] ?? 0, bossCleared: (id) => bosses.includes(id) };
}

describe('requirements', () => {
  it('parses the comparison vocabulary', () => {
    expect(parseComparison('<=3')).toEqual({ op: '<=', value: 3 });
    expect(parseComparison('>= 5')).toEqual({ op: '>=', value: 5 });
    expect(parseComparison('4')).toEqual({ op: '==', value: 4 });
    expect(parseComparison('2..4')).toEqual({ op: 'range', min: 2, max: 4 });
    expect(parseComparison('4..2')).toBeNull();
    expect(parseComparison('x<3')).toBeNull();
    expect(parseComparison('alert(1)')).toBeNull();
  });

  it('all requirements must hold, including boss clears', () => {
    const reqs = { careMistakes: '<=3', level: '>=5', bossCleared: 'nsp:area12' };
    expect(requirementsMet(reqs, source({ careMistakes: 3, level: 5 }, ['nsp:area12']))).toBe(true);
    expect(requirementsMet(reqs, source({ careMistakes: 4, level: 5 }, ['nsp:area12']))).toBe(false);
    expect(requirementsMet(reqs, source({ careMistakes: 0, level: 5 }))).toBe(false);
  });

  it('malformed comparisons fail closed', () => {
    expect(requirementsMet({ level: 'lots' }, source({ level: 99 }))).toBe(false);
  });
});

describe('pickEvolution', () => {
  const mon = monDef('t:x', 2, {
    evolutions: [
      { to: 't:best', reqs: { careMistakes: '<=1', effort: '>=3' } },
      { to: 't:mid', reqs: { careMistakes: '<=4' } },
      { to: 't:worst' },
    ],
  });

  it('takes the first matching branch in pack order', () => {
    expect(pickEvolution(mon, source({ careMistakes: 0, effort: 4 }))).toBe('t:best');
    expect(pickEvolution(mon, source({ careMistakes: 0, effort: 2 }))).toBe('t:mid');
    expect(pickEvolution(mon, source({ careMistakes: 9 }))).toBe('t:worst');
  });

  it('is not hardwired to care mistakes: any counter works', () => {
    const m = monDef('t:y', 4, { evolutions: [{ to: 't:fighter', reqs: { wins: '>=10', battles: '<=12' } }] });
    expect(pickEvolution(m, source({ wins: 10, battles: 12, careMistakes: 99 }))).toBe('t:fighter');
    expect(pickEvolution(m, source({ wins: 9 }))).toBeNull();
  });
});
