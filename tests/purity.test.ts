// Hard rules 1–3: core/ is pure, has no wall clock and no unseeded randomness.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CORE = 'src/core';
const FORBIDDEN = [
  /\b(window|globalThis|self|navigator)\s*[.[]/,
  /\bdocument\b/,
  /\blocalStorage\b/,
  /\bindexedDB\b/,
  /\bfetch\s*\(/,
  /\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/,
  /Date\.now\s*\(/,
  /new\s+Date\s*\(/,
  /Math\.random\s*\(/,
  /\bperformance\.now\b/,
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('core purity', () => {
  for (const file of readdirSync(CORE).filter((f) => f.endsWith('.ts'))) {
    it(`${file} uses no browser APIs, wall clock, timers or Math.random`, () => {
      const code = stripComments(readFileSync(join(CORE, file), 'utf8'));
      for (const re of FORBIDDEN) expect(code, `${file} matches ${re}`).not.toMatch(re);
      expect(code).not.toMatch(/from '\.\.\/(ui|save|packs)\//);
    });
  }
});
