// Node filesystem PackSource for the lint:packs CLI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { PackSource } from '../src/packs/loader.ts';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function fsPackSource(root: string): PackSource {
  return {
    list: async () => walk(root).map((p) => relative(root, p).split(sep).join('/')),
    readText: async (path) => readFileSync(join(root, path), 'utf8'),
    readBytes: async (path) => new Uint8Array(readFileSync(join(root, path))),
    assetUrl: (path) => join(root, path),
  };
}
