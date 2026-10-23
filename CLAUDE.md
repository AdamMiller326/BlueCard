# Digital Monster V Pet

Free, fan-made vpet PWA: Pendulum Color roster with Digital Monster X gameplay. Static site on GitHub Pages, no backend.

**Read `docs/design.md` before any work.** It is the source of truth for game rules. Its "Build order" section is the plan. Work on one step at a time and don't start the next step unless asked.

## Stack

- TypeScript (strict), Vite, HTML canvas. No game engine, no UI framework.
- Vitest for tests.
- IndexedDB for saves (via a thin wrapper, e.g. `idb`).
- Deploy: GitHub Actions builds and publishes to GitHub Pages on push to `main`.
- Keep dependencies minimal. Ask before adding anything beyond Vite, Vitest, and `idb`.

## Layout

```
src/
  core/      pure game logic: no DOM, no browser APIs, no I/O
  packs/     pack schema types, loader, validator
  save/      IndexedDB persistence, save code export/import
  ui/        canvas rendering, input minigames, screens
  main.ts
packs/pendulum-nsp/   first content pack, same format users import
tests/
public/      PWA manifest, service worker, icons
docs/design.md
```

## Hard rules

1. **`core/` is pure.** No `window`, `document`, `localStorage`, `indexedDB`, `fetch`, or timers. It takes state plus inputs and returns new state.
2. **No `Date.now()` or `new Date()` in `core/`.** Time comes from an injected `Clock` interface (real, fake, or played time). This is the seam for check-in vs. active mode.
3. **No `Math.random()` anywhere in `core/`.** All randomness goes through the seeded RNG in `core/rng.ts`. Battles are `battle(monA, monB, seed, inputs)` and must be deterministic.
4. **Packs are data only.** JSON plus assets. Evolution requirements use the fixed vocabulary from the design doc (`careMistakes`, `level`, `effort`, `bossCleared`, …). Never eval or run code from a pack.
5. **No core content back doors.** The Pendulum roster loads through the same pack loader and validator as user packs.
6. **No Bandai/Digimon sprites or audio in the repo.** Use simple placeholder art (colored shapes or original pixel art). Real sprites arrive only via local pack import.
7. **Tunable numbers live in one config module** (`core/tuning.ts`), each with a comment pointing to the design doc. No magic numbers scattered in logic.
8. **The poop cap is a single constant.** The sickness threshold and per-mon limits derive from it.

## Testing

- Every `core/` change ships with tests.
- The catch-up pass is the riskiest code. Test it with a fake clock across: a normal day, a missed window, two missed windows (sickness → death path), multi-day absence, day-start shifts mid-day, and a closed-app evolution timer firing.
- Battle tests assert the same seed + inputs → identical result.
- The pack validator has tests with deliberately broken packs (missing evolution target, poop count over cap, missing frames, out-of-range window override).
- `npm test`, `npm run build`, and `npm run lint:packs` must pass before you call a step done.

## Scripts

- `npm run dev`: local dev server
- `npm test`: Vitest
- `npm run build`: production build
- `npm run lint:packs`: run the pack validator CLI over `packs/`

## Working style

- Small, reviewable commits with clear messages.
- If the design doc is ambiguous or a (tune) value is missing, pick a reasonable default, put it in `tuning.ts`, and list it in your end-of-step summary. Don't stall.
- If a design rule seems wrong once implemented, say so in the summary rather than silently changing it.
- At the end of each step, summarize what was built, what's stubbed, and any open questions.
- Personal project: never reference work accounts, work code, or employer resources.
