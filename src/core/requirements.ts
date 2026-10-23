// Evolution requirement vocabulary. Pack data uses only these keys; values
// are comparison strings, never code. design.md "Content packs".

/** Numeric counters a requirement can compare against. */
export const NUMERIC_REQUIREMENTS = [
  'careMistakes', // weighted, lifetime
  'effort', // effort hearts this stage
  'level',
  'trainings', // this stage
  'proteins', // this stage
  'weight',
  'battles', // step 2
  'wins', // step 2
] as const;
export type NumericRequirement = (typeof NUMERIC_REQUIREMENTS)[number];

export type Requirements = Partial<Record<NumericRequirement, string>> & {
  /** Area id(s) whose boss must be cleared on this save. All must be cleared. */
  bossCleared?: string | string[];
};

export const REQUIREMENT_KEYS: readonly string[] = [...NUMERIC_REQUIREMENTS, 'bossCleared'];

/**
 * Where counters come from. Evolution never reads mon state directly, so
 * check-in mode, active mode or a test can each supply their own source.
 */
export interface CounterSource {
  counter(key: NumericRequirement): number;
  bossCleared(areaId: string): boolean;
}

export type Comparison =
  | { op: '<=' | '>=' | '<' | '>' | '=='; value: number }
  | { op: 'range'; min: number; max: number };

/** Parses "<=3", ">=5", "<2", ">1", "==4", "4" (equals) or "2..4" (inclusive). Returns null if malformed. */
export function parseComparison(raw: string): Comparison | null {
  const s = raw.trim();
  const range = /^(\d+)\s*\.\.\s*(\d+)$/.exec(s);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { op: 'range', min, max } : null;
  }
  const m = /^(<=|>=|<|>|==)?\s*(\d+)$/.exec(s);
  if (!m) return null;
  const op = (m[1] ?? '==') as '<=' | '>=' | '<' | '>' | '==';
  return { op, value: Number(m[2]) };
}

export function compare(c: Comparison, n: number): boolean {
  switch (c.op) {
    case '<=':
      return n <= c.value;
    case '>=':
      return n >= c.value;
    case '<':
      return n < c.value;
    case '>':
      return n > c.value;
    case '==':
      return n === c.value;
    case 'range':
      return n >= c.min && n <= c.max;
  }
}

export function bossList(reqs: Requirements): string[] {
  const b = reqs.bossCleared;
  if (b === undefined) return [];
  return Array.isArray(b) ? b : [b];
}

/** True when every requirement holds. Malformed comparisons fail closed. */
export function requirementsMet(reqs: Requirements, src: CounterSource): boolean {
  for (const key of NUMERIC_REQUIREMENTS) {
    const raw = reqs[key];
    if (raw === undefined) continue;
    const c = parseComparison(raw);
    if (!c || !compare(c, src.counter(key))) return false;
  }
  return bossList(reqs).every((id) => src.bossCleared(id));
}

export function isUnconditional(reqs: Requirements): boolean {
  return Object.keys(reqs).length === 0;
}
