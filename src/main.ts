import './ui/style.css';
import { buildRoster, formatIssues, loadPack } from './packs/loader.ts';
import { bundledNspSource } from './ui/httpSource.ts';
import { startApp } from './ui/app.ts';

async function boot(): Promise<void> {
  const result = await loadPack(bundledNspSource());
  if (!result.pack) {
    const el = document.getElementById('pack-error')!;
    el.hidden = false;
    el.textContent = `Content pack failed validation:\n${formatIssues(result.errors)}`;
    return;
  }
  if (result.warnings.length) console.warn(`Pack warnings:\n${formatIssues(result.warnings)}`);
  await startApp([result.pack], buildRoster([result.pack]));
}

void boot();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js');
}
