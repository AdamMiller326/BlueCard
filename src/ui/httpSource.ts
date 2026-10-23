import type { PackSource } from '../packs/loader.ts';

/** PackSource over a map of pack-relative path → URL (bundled packs). */
export function httpPackSource(files: Record<string, string>): PackSource {
  const get = async (path: string) => {
    const url = files[path];
    if (!url) throw new Error(`no such file ${path}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
    return res;
  };
  return {
    list: async () => Object.keys(files),
    readText: async (p) => (await get(p)).text(),
    readBytes: async (p) => new Uint8Array(await (await get(p)).arrayBuffer()),
    assetUrl: (p) => files[p] ?? '',
  };
}

// Every file in packs/pendulum-nsp, emitted as a static asset by Vite.
const bundled = import.meta.glob('/packs/pendulum-nsp/**/*', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export function bundledNspSource(): PackSource {
  const files: Record<string, string> = {};
  for (const [path, url] of Object.entries(bundled)) files[path.replace('/packs/pendulum-nsp/', '')] = url;
  return httpPackSource(files);
}
