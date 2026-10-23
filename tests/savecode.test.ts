import { describe, expect, it } from 'vitest';
import { decodeSaveCode, encodeSaveCode, type SaveFile } from '../src/save/code.ts';
import { CHILD, Sim, at, roster } from './helpers.ts';

function sampleFile(): SaveFile {
  const sim = new Sim(roster([CHILD]), at(0, 9));
  sim.do('hatch');
  sim.goto(at(0, 15));
  return { v: 1, exportedAt: at(0, 15), packs: [{ id: 'nsp', version: '0.1.0' }], state: sim.state };
}

describe('save codes', () => {
  it('round-trips a save exactly', () => {
    const file = sampleFile();
    const code = encodeSaveCode(file);
    expect(code).toMatch(/^DMV1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    const r = decodeSaveCode(code, [{ id: 'nsp', version: '0.3.1' }]);
    expect(r.ok && r.file).toEqual(file);
  });

  it('tolerates whitespace and line breaks from copy-paste', () => {
    const code = encodeSaveCode(sampleFile());
    const wrapped = code.replace(/(.{40})/g, '$1\n  ');
    expect(decodeSaveCode(wrapped, [{ id: 'nsp', version: '0.1.0' }]).ok).toBe(true);
  });

  it('fails clearly when a pack is missing or the wrong major version', () => {
    const code = encodeSaveCode(sampleFile());
    const missing = decodeSaveCode(code, []);
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.error).toMatch(/Missing content pack\(s\): nsp@0\.1\.0/);
    expect(decodeSaveCode(code, [{ id: 'nsp', version: '1.0.0' }]).ok).toBe(false);
  });

  it('detects corruption', () => {
    const code = encodeSaveCode(sampleFile());
    const i = code.indexOf('.') + 20;
    const broken = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    const r = decodeSaveCode(broken, [{ id: 'nsp', version: '0.1.0' }]);
    expect(!r.ok && r.error).toMatch(/damaged/);
    expect(decodeSaveCode('hello', []).ok).toBe(false);
  });
});
