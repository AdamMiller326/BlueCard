import { requirementsMet, type CounterSource } from './requirements.ts';
import type { MonDef } from './species.ts';
import type { GameState, Mon } from './state.ts';
import { EFFORT_MAX, TRAININGS_PER_EFFORT } from './tuning.ts';

/** First branch (in pack order) whose requirements all hold, or null. */
export function pickEvolution(def: MonDef, src: CounterSource): string | null {
  for (const evo of def.evolutions) {
    if (requirementsMet(evo.reqs, src)) return evo.to;
  }
  return null;
}

export function effortHearts(mon: Mon): number {
  return Math.min(EFFORT_MAX, Math.floor(mon.stageTrainings / TRAININGS_PER_EFFORT));
}

/** Check-in mode's counter source: counters come from the mon and the save. */
export function checkInCounters(state: GameState, mon: Mon): CounterSource {
  return {
    counter(key) {
      switch (key) {
        case 'careMistakes':
          return mon.careMistakes;
        case 'effort':
          return effortHearts(mon);
        case 'level':
          return mon.level;
        case 'trainings':
          return mon.stageTrainings;
        case 'proteins':
          return mon.stageProteins;
        case 'weight':
          return mon.weight;
        case 'battles':
        case 'wins':
          return 0; // quest mode arrives in build step 2
      }
    },
    bossCleared: (id) => state.bossCleared.includes(id),
  };
}
