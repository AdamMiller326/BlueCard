// Wires the pure engine to the DOM: input, render loop, saves, debug tools.
import { act, advance, newGame, peekNextEvent, type Action, type EngineContext } from '../core/engine.ts';
import { getMon, type Roster } from '../core/species.ts';
import type { GameState } from '../core/state.ts';
import { STAGE_NAMES, POOP_CAP, VACCINE_COST, WINDOW_LENGTH, type Stage } from '../core/tuning.ts';
import { viewMon, type MonView } from '../core/view.ts';
import type { Pack, PackDependency } from '../packs/schema.ts';
import { decodeSaveCode, encodeSaveCode } from '../save/code.ts';
import { clearSave, loadSave, requestPersistence, writeSave } from '../save/db.ts';
import { DebugClock } from './clock.ts';
import { render, type Anim } from './render.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function hhmm(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function stamp(t: number): string {
  return new Date(t).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

export async function startApp(packs: Pack[], roster: Roster): Promise<void> {
  const clock = new DebugClock();
  const ctx: EngineContext = { roster, clock };
  const installed: PackDependency[] = packs.map((p) => ({ id: p.manifest.id, version: p.manifest.version }));
  const assetUrls = Object.assign({}, ...packs.map((p) => p.assetUrls)) as Record<string, string>;

  const stored = await loadSave();
  let state: GameState = stored?.state ?? newGame(Date.now() >>> 0, ctx);
  let dormant = stored?.dormant ?? false;
  let dirty = !stored;
  let anim: { name: Anim; until: number } | null = null;
  void requestPersistence();

  const canvas = $<HTMLCanvasElement>('screen');
  const g = canvas.getContext('2d')!;
  const toast = $('toast');

  const persist = async () => {
    dirty = false;
    await writeSave({ state, packs: installed, dormant });
  };

  const say = (msg: string) => {
    toast.textContent = msg;
  };

  const run = (action: Action) => {
    if (dormant) return say('This copy is dormant. Import a code to continue.');
    const r = act(state, action, ctx);
    state = r.state;
    say(r.message);
    const name: Anim = !r.ok ? 'refuse' : action.type === 'feed' ? 'eat' : action.type === 'train' || action.type === 'protein' ? 'happy' : 'idle';
    anim = { name, until: performance.now() + 1500 };
    void persist();
    refreshPanels();
  };

  // --- buttons ---------------------------------------------------------------
  document.querySelectorAll<HTMLButtonElement>('#buttons button').forEach((b) => {
    b.addEventListener('click', () => run({ type: b.dataset.act } as Action));
  });

  const dayStart = $<HTMLInputElement>('day-start');
  const syncDayStart = () => {
    const m = state.dayStartMinutes;
    dayStart.value = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  dayStart.addEventListener('change', () => {
    const [h, m] = dayStart.value.split(':').map(Number);
    if (h !== undefined && m !== undefined && !Number.isNaN(h + m)) run({ type: 'setDayStart', minutes: h * 60 + m });
  });

  // --- save codes ------------------------------------------------------------
  const codeBox = $<HTMLTextAreaElement>('code');
  const exportCode = (): string | null => {
    if (!confirm('Export transfers your mon: this copy goes dormant until you import a code here again. Continue?')) return null;
    state = advance(state, ctx);
    const code = encodeSaveCode({ v: 1, exportedAt: clock.now(), packs: installed, state });
    codeBox.value = code;
    dormant = true;
    void persist();
    say('Save code exported. Copy it to your other device.');
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    refreshPanels();
    return code;
  };
  const importCode = (code: string) => {
    const r = decodeSaveCode(code, installed);
    if (!r.ok) return say(r.error);
    state = r.file.state;
    dormant = false;
    void persist();
    syncDayStart();
    say('Save imported.');
    refreshPanels();
  };
  $('export').addEventListener('click', () => exportCode());
  $('import').addEventListener('click', () => importCode(codeBox.value));
  $('download').addEventListener('click', () => {
    const code = codeBox.value.startsWith('DMV1.') ? codeBox.value : exportCode();
    if (!code) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    a.download = `dm-vpet-save-${new Date(clock.now()).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) importCode(await file.text());
  });

  // --- debug -----------------------------------------------------------------
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) =>
    b.addEventListener('click', () => {
      clock.setSpeed(Number(b.dataset.speed));
      refreshPanels();
    }),
  );
  document.querySelectorAll<HTMLButtonElement>('[data-skip]').forEach((b) => b.addEventListener('click', () => clock.skip(Number(b.dataset.skip))));
  $('skip-next').addEventListener('click', () => {
    const ev = peekNextEvent(state, ctx);
    if (ev) {
      clock.jumpTo(ev.at);
      say(`Skipped to ${ev.kind} at ${hhmm(ev.at)}.`);
    } else say('No upcoming event.');
  });
  $('real-time').addEventListener('click', () => {
    if (clock.now() > Date.now() + 1000 && !confirm('The game clock is ahead of real time. The mon will freeze until real time catches up. Continue?')) return;
    clock.resetToReal();
    refreshPanels();
  });
  $('set-level').addEventListener('click', () => run({ type: 'debugSetLevel', level: Number($<HTMLInputElement>('level').value) }));
  $('add-bits').addEventListener('click', () => run({ type: 'debugAddBits', bits: 100 }));
  $('wipe').addEventListener('click', async () => {
    if (!confirm('Delete this save and start over?')) return;
    await clearSave();
    clock.resetToReal();
    state = newGame(Date.now() >>> 0, ctx);
    dormant = false;
    await persist();
    syncDayStart();
    refreshPanels();
  });

  // --- panels ----------------------------------------------------------------
  function refreshPanels(): void {
    const t = clock.now();
    const v = viewMon(state, roster, t);
    $('dormant').hidden = !dormant;
    $<HTMLButtonElement>('hatch').hidden = !!v && !v.dead;
    const vaccineBtn = document.querySelector<HTMLButtonElement>('[data-act="vaccine"]')!;
    vaccineBtn.textContent = `Vaccine (${VACCINE_COST}b)`;
    document.querySelector('[data-act="lights"]')!.classList.toggle('on', !!v && !v.lightsOn);
    document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.classList.toggle('on', Number(b.dataset.speed) === clock.speed));

    const stats: [string, string][] = [['Bits', String(state.bits)]];
    if (v && state.mon) {
      stats.unshift(
        ['Mon', `${v.name} (${STAGE_NAMES[v.stageIndex as Stage]})`],
        ['Level', String(v.level)],
        ['Weight', `${v.weight} g`],
        ['Care mistakes', `${v.careMistakes} weighted · ${v.recentMistakes}/${v.deathAt} toward death`],
        ['Poop', `${v.poopCount} (${v.poopPoints}/${POOP_CAP} pts)`],
        ['Health', v.dead ? `dead (${state.mon.dead?.cause})` : v.danger ? 'DANGER — needs vaccine' : v.sick ? `sick (${state.mon.sick?.cause}) — treat by end of next window` : 'healthy'],
        ['Injury rate', `${state.mon.injuryRate}%`],
        ['Next evolution check', v.nextEvolutionCheck ? stamp(v.nextEvolutionCheck) : '—'],
        ['History', state.mon.history.map((id) => getMon(roster, id).name).join(' → ')],
      );
    }
    $('stats').innerHTML = stats.map(([k, val]) => `<dt>${k}</dt><dd>${escape(val)}</dd>`).join('');

    const sched: string[] = [];
    if (v && !v.dead) {
      v.slots.forEach((s) => sched.push(`${hhmm(s.open)}–${hhmm(s.open + WINDOW_LENGTH)} hunger${s.isStrength ? ' + strength' : ''}: ${s.status}`));
      sched.push(`${hhmm(v.lightsOut.from)}–${hhmm(v.lightsOut.to)} lights out: ${v.lightsOut.status}`);
      if (v.strengthCheck) sched.push(`strength check at ${hhmm(v.strengthCheck.at)}: ${v.strengthCheck.status}`);
      sched.push(`next day starts ${stamp(v.nextDayStart)}`);
    }
    $('schedule').innerHTML = sched.map((s) => `<li>${escape(s)}</li>`).join('');
    $('log').innerHTML = state.log
      .slice(-15)
      .reverse()
      .map((l) => `<li>${stamp(l.at)} — ${escape(l.text)}</li>`)
      .join('');
    $('debug-clock').textContent = `Game time ${new Date(t).toLocaleString()} · speed ${clock.speed}×${clock.isReal ? ' (real time)' : ''}`;
  }

  function lines(v: MonView | null, t: number): [string, string] {
    if (!v) return ['', ''];
    if (v.dead) return ['Passed away.', 'Press Hatch for a new egg'];
    if (v.asleep) return [`Sleeping. Wakes ${hhmm(v.nextDayStart)}`, ''];
    const l2 =
      t >= v.lightsOut.from && t < v.lightsOut.to && v.lightsOut.status === 'pending'
        ? `LIGHTS OUT until ${hhmm(v.lightsOut.to)}`
        : v.strengthCheck?.status === 'pending'
          ? `STR check ${hhmm(v.strengthCheck.at)}`
          : `Lights out ${hhmm(v.lightsOut.from)}`;
    const w = v.nextWindow;
    if (!w) return ['All fed today', l2];
    const star = w.isStrength ? ' +STR' : '';
    if (v.windowOpen) return [`HUNGRY! until ${hhmm(w.close)}${star}`, l2];
    if (v.canFeedNow) return [`Early check-in ok${star}`, l2];
    return [`Hungry at ${hhmm(w.open)}${star}`, l2];
  }

  // --- loops -----------------------------------------------------------------
  syncDayStart();
  let lastPanel = 0;
  const frame = () => {
    const t = clock.now();
    if (t > state.time) {
      const before = state.time;
      state = advance(state, ctx);
      if (state.time !== before) dirty = true;
    }
    const v = viewMon(state, roster, t);
    const mon = state.mon;
    const def = mon ? getMon(roster, mon.species) : null;
    const now = performance.now();
    if (anim && now > anim.until) anim = null;
    const baseAnim: Anim = v?.asleep ? 'sleep' : v?.sick ? 'sick' : 'idle';
    const [line1, line2] = lines(v, t);
    render(g, {
      view: v,
      def,
      spriteUrl: def ? (assetUrls[def.sprite.sheet] ?? '') : '',
      poop: mon?.poop ?? [],
      anim: anim?.name ?? baseAnim,
      tick: Math.floor(now / 250),
      clockText: hhmm(t),
      line1,
      line2,
    });
    if (now - lastPanel > 500) {
      lastPanel = now;
      refreshPanels();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  setInterval(() => {
    if (dirty) void persist();
  }, 3000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void persist();
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
