// lint:packs — validates every pack folder under the given directory, using
// the same loader and validator as the app. Exits non-zero on any error.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatIssues, loadPack } from '../src/packs/loader.ts';
import type { Pack } from '../src/packs/schema.ts';
import { fsPackSource } from './fs-source.ts';

const root = process.argv[2] ?? 'packs';
const dirs = readdirSync(root)
  .map((d) => join(root, d))
  .filter((d) => statSync(d).isDirectory());

// Validate in dependency order: retry packs whose deps aren't loaded yet.
const loaded: Pack[] = [];
let pending = [...dirs];
let failed = false;
let progress = true;
const lastResult = new Map<string, Awaited<ReturnType<typeof loadPack>>>();
while (pending.length > 0 && progress) {
  progress = false;
  const next: string[] = [];
  for (const dir of pending) {
    const result = await loadPack(fsPackSource(dir), loaded);
    lastResult.set(dir, result);
    if (result.pack) {
      loaded.push(result.pack);
      progress = true;
      console.log(`ok   ${dir} (${result.pack.manifest.id}@${result.pack.manifest.version}, ${result.pack.mons.length} mons)`);
      if (result.warnings.length) console.log(`warn ${dir}\n${formatIssues(result.warnings)}`);
    } else next.push(dir);
  }
  pending = next;
}
for (const dir of pending) {
  const r = lastResult.get(dir);
  failed = true;
  console.error(`FAIL ${dir}\n${formatIssues(r?.errors ?? [])}`);
}
if (dirs.length === 0) console.log(`no packs found in ${root}`);
process.exit(failed ? 1 : 0);
