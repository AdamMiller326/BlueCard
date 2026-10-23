# Blue Card

Free, fan-made Digimon roguelike deckbuilder in **Godot 4.7 / GDScript**. You raise mons in a nursery (the vpet "raising babies" part), then take them on quest-mode runs.

**Read `docs/GAME.md` and the doc for the system you're touching (e.g. `docs/nursery.md`) before any work.** They are the source of truth. Work through GAME.md's "Build order" one step at a time and don't start the next step unless asked.

## Layout

```
core/        game logic: plain RefCounted classes, no Node/scene dependencies
  tuning.gd  every tunable constant, each commented with the doc rule it belongs to
  nursery/   nursery state, rules, schedule, evolution, Rookie record, data classes
data/        Resources (.tres): catalog, species, eggs
autoload/    PlayClock (played time + debug scale), GameState (owns state), SaveSystem
scenes/      screens; scenes/debug is debug-build only
tests/       GUT tests, headless
addons/gut/  vendored GUT 9.6.1 (don't edit)
docs/        design docs
```

## Hard rules

1. **Logic in `core/` is plain classes.** No Node, scene, Input, file or OS access. Scenes only display state and send actions.
2. **No `Time.*` or OS time in `core/`.** Time comes in as played seconds.
3. **No global randomness in `core/`.** Use a seeded `RandomNumberGenerator` held in state. Battles must be deterministic for a seed.
4. **Numbers live in data or `core/tuning.gd`**, never inline in logic.
5. **Evolution requirements use the fixed vocabulary** in `core/nursery/evolution.gd`. Data never contains code.
6. **No Bandai sprites or audio in the repo.** Placeholder shapes or original art only.
7. **Saves are versioned JSON in `user://`.** Any change to the save shape bumps `SaveSystem.VERSION` and adds a migration. Never break an old save.
8. **`NurseryLogic.advance` must stay chunk-invariant**: one big step equals many small ones. Test it when touching scheduling.

## Testing

- Every `core/` change ships with GUT tests.
- Run: `GODOT=/path/to/godot ./run_tests.sh` (headless). Must pass before calling a step done.
- Data validation lives in `Catalog.validate()`; the shipped catalog is tested to be valid.

## Working style

- Small, reviewable commits with clear messages.
- **All decisions, including code design and tuning values, are the user's.** Propose options with a recommendation, ask one question at a time, and don't build until the user agrees. This includes gaps in the docs and missing (tune) values.
- If a design rule seems wrong once implemented, say so rather than silently changing it. Record the user's decisions in the design docs.
- At the end of each step, summarize what was built, what's stubbed, and open questions.
- Use the Pendulum Virus Busters roster for greybox evolution content.
- Personal project: never reference work accounts, work code, or employer resources.
