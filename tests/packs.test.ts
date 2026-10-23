import { describe, expect, it } from 'vitest';
import { buildRoster, loadPack } from '../src/packs/loader.ts';
import { validatePack, type RawPack } from '../src/packs/validate.ts';
import { fsPackSource } from '../scripts/fs-source.ts';
import { FRAME_SIZE } from '../src/packs/schema.ts';

const ANIMS = { idle: [0, 1], eat: [2], happy: [3], refuse: [0], sleep: [1], sick: [2], attack: [3] };

function mon(id: string, stage: number, extra: Record<string, unknown> = {}) {
  const key = id.split(':')[1];
  return {
    id,
    name: key,
    desc: '',
    stage,
    attribute: 'data',
    power: 5,
    moveset: ['x:hit'],
    poopPerGap: 4,
    evolutions: [],
    sprite: { sheet: `assets/${key}.png`, frames: 4, animations: ANIMS },
    ...extra,
  };
}

/** A minimal valid two-mon pack; each test breaks one thing. */
function goodPack(): RawPack {
  return {
    manifest: { id: 'x', name: 'X', version: '1.0.0', author: 'me', depends: [], starters: ['x:a'] },
    moves: [{ id: 'x:hit', name: 'Hit', style: 'mash', tiers: { bad: 1, good: 2, great: 3 }, anim: 'hit' }],
    areas: [{ id: 'x:area1', name: 'A1', boss: 'x:b' }],
    mons: {
      'mons/a.json': mon('x:a', 1, { evolutions: [{ to: 'x:b', reqs: {} }] }),
      'mons/b.json': mon('x:b', 2, { evolutions: [{ to: 'x:c', reqs: { careMistakes: '<=3', bossCleared: 'x:area1' } }, { to: 'x:c' }] }),
      'mons/c.json': mon('x:c', 3, { evolutions: [{ to: 'x:d' }] }),
      'mons/d.json': mon('x:d', 4, { evolutions: [{ to: 'x:e' }] }),
      'mons/e.json': mon('x:e', 5),
    },
    assets: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((k) => [`assets/${k}.png`, { width: 4 * FRAME_SIZE, height: FRAME_SIZE }])),
  };
}

function errorsOf(raw: RawPack): string[] {
  return validatePack(raw).errors.map((e) => `${e.file}: ${e.message}`);
}

describe('pack validator', () => {
  it('accepts a valid pack', () => {
    const r = validatePack(goodPack());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.pack?.mons).toHaveLength(5);
  });

  it('rejects a missing evolution target', () => {
    const raw = goodPack();
    (raw.mons['mons/a.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'x:nope', reqs: {} }];
    expect(errorsOf(raw).join('\n')).toMatch(/evolution target "x:nope" does not exist/);
  });

  it('rejects poop count over the cap', () => {
    const raw = goodPack();
    (raw.mons['mons/a.json'] as { poopPerGap: number }).poopPerGap = 7;
    expect(errorsOf(raw).join('\n')).toMatch(/poopPerGap must be an integer 3–6/);
  });

  it('rejects missing animation frames', () => {
    const raw = goodPack();
    const sprite = (raw.mons['mons/a.json'] as { sprite: { animations: Record<string, number[]> } }).sprite;
    const { sleep: _drop, ...rest } = sprite.animations;
    sprite.animations = { ...rest, eat: [9] };
    const errs = errorsOf(raw).join('\n');
    expect(errs).toMatch(/missing required animation "sleep"/);
    expect(errs).toMatch(/animation "eat" uses a frame outside 0–3/);
  });

  it('rejects a sprite sheet whose size does not match the frame spec', () => {
    const raw = goodPack();
    raw.assets['assets/a.png'] = { width: 64, height: 32 };
    expect(errorsOf(raw).join('\n')).toMatch(/expected 128×32/);
  });

  it('rejects an out-of-range window override', () => {
    const raw = goodPack();
    (raw.mons['mons/d.json'] as { careWindows?: number }).careWindows = 5;
    expect(errorsOf(raw).join('\n')).toMatch(/careWindows override must be an integer 2–3 for stage 4/);
  });

  it('rejects unknown requirement keys and code-like values', () => {
    const raw = goodPack();
    (raw.mons['mons/a.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'x:b', reqs: { script: 'run()', level: 'alert(1)' } }];
    const errs = errorsOf(raw).join('\n');
    expect(errs).toMatch(/unknown requirement "script"/);
    expect(errs).toMatch(/requirement level: "alert\(1\)" is not a comparison/);
  });

  it('rejects boss unlocks that point at unknown areas or mons', () => {
    const raw = goodPack();
    (raw.areas as { boss: string }[])[0]!.boss = 'x:ghost';
    (raw.mons['mons/b.json'] as { evolutions: { reqs: object }[] }).evolutions[0]!.reqs = { bossCleared: 'x:area9' };
    const errs = errorsOf(raw).join('\n');
    expect(errs).toMatch(/boss "x:ghost" is not a known mon/);
    expect(errs).toMatch(/bossCleared "x:area9" is not a known area/);
  });

  it('rejects cross-pack targets that are not in depends, and missing dependencies', () => {
    const raw = goodPack();
    (raw.mons['mons/a.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'other:b', reqs: {} }];
    expect(errorsOf(raw).join('\n')).toMatch(/pack "other", which is not in depends/);
    (raw.manifest as { depends: unknown[] }).depends = [{ id: 'other', version: '1.0.0' }];
    expect(errorsOf(raw).join('\n')).toMatch(/missing dependency pack "other"/);
  });

  it('allows evolving into a dependency pack', () => {
    const dep = goodPack();
    (dep.manifest as { id: string }).id = 'other';
    const depRaw = JSON.parse(JSON.stringify(dep).replaceAll('"x:', '"other:')) as RawPack;
    const depPack = validatePack(depRaw).pack!;
    const raw = goodPack();
    (raw.manifest as { depends: unknown[] }).depends = [{ id: 'other', version: '1.2.0' }];
    (raw.mons['mons/a.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'other:b', reqs: {} }];
    expect(validatePack(raw, [depPack]).errors).toEqual([]);
  });

  it('rejects wrong-stage targets, duplicate ids and non-namespaced ids', () => {
    const raw = goodPack();
    (raw.mons['mons/a.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'x:c', reqs: {} }];
    raw.mons['mons/a2.json'] = mon('x:a', 1);
    raw.mons['mons/z.json'] = mon('z', 1);
    const errs = errorsOf(raw).join('\n');
    expect(errs).toMatch(/is stage 3; expected stage 2/);
    expect(errs).toMatch(/duplicate mon id x:a/);
    expect(errs).toMatch(/id must be "x:<name>"/);
  });

  it('rejects script-like assets', () => {
    const raw = goodPack();
    raw.assets['assets/evil.js'] = null;
    expect(errorsOf(raw).join('\n')).toMatch(/asset type not allowed/);
  });

  it('warns when a care-driven stage has no fallback branch', () => {
    const raw = goodPack();
    (raw.mons['mons/c.json'] as { evolutions: unknown[] }).evolutions = [{ to: 'x:d', reqs: { effort: '>=4' } }];
    expect(validatePack(raw).warnings.map((w) => w.message).join()).toMatch(/no unconditional fallback/);
  });

  it('rejects malformed JSON via the loader', async () => {
    const files: Record<string, string> = { 'manifest.json': '{ nope', 'moves.json': '[]' };
    const r = await loadPack({
      list: async () => Object.keys(files),
      readText: async (p) => files[p]!,
      readBytes: async () => new Uint8Array(),
      assetUrl: (p) => p,
    });
    expect(r.pack).toBeNull();
    expect(r.errors[0]?.message).toMatch(/could not read JSON/);
  });
});

describe('packs/pendulum-nsp', () => {
  it('loads through the same loader and validator as user packs', async () => {
    const r = await loadPack(fsPackSource('packs/pendulum-nsp'));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    const roster = buildRoster([r.pack!]);
    expect(roster.starters).toEqual(['nsp:punimon']);
    expect(Object.keys(roster.mons).length).toBeGreaterThanOrEqual(6);
  });
});
