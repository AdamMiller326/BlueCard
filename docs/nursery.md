# Nursery — Design & Architecture

*Blue Card prototype. Values marked (tune) are starting guesses. See `GAME.md` for the whole game.*

## Purpose

The nursery is where you raise your next pair of mons. It turns eggs into Rookies through short, played-time care. Care quality decides **which Rookie** you get and **how strong it starts** a run. It runs in the background while you play runs, so the next pair is growing while the current one fights.

It is not a vpet. Nothing happens while the game is closed.

## Rules

### Slots

- **Two slots.** Each holds one mon from egg to Rookie.
- **No queue.** A slot holds one mon until that Rookie is taken on a run or discarded.
- **Ready Rookies need no care.** Once a mon reaches Rookie it waits in its slot, frozen.
- An empty slot can be filled with a **basic egg** (always free) or a **DNA egg** (from recycling, later).

### Played-time clock

- The nursery clock advances only while the game is running and not paused: on the nursery screen, in menus, and during runs.
- **Stops** when the game is closed or paused. On launch, nothing is caught up.
- A debug **time scale** (×1, ×10, ×60) speeds everything up for testing.

### Stages (tune)

| Stage | Duration (played) | Next |
|---|---|---|
| Egg | ~1 min (hatch) | Baby |
| Baby | ~10 min | Child |
| Child | ~60 min | Rookie |
| Rookie | — (ready, frozen) | taken on a run |

Durations come from the mon's data so lines can differ.

### Needs

**Hunger**

- Hearts drain toward a **fixed schedule** of hunger windows (Baby: every ~5 min, Child: every ~15 min) (tune).
- When hearts hit empty, a **grace window** opens (~5 min played) (tune). Feeding in the grace window is fine. If it closes unfed, that's a **care mistake**.
- Feeding doesn't shift the schedule. Hearts are a view of the schedule, so the UI can show "hungry in 3:20".
- Overfeeding adds weight. At max weight the mon gets sick.

**Strength** (Child only)

- One strength check per ~30 min played (tune), on a hunger window.
- Filled by **training** (a short minigame; a button press is fine for the prototype) or **protein** (instant, adds weight).
- Unfilled at the check = care mistake.
- Every 4 trainings = 1 **effort** point. Effort feeds Rookie quality.

**Poop and sickness**

- Each line has a fixed **poop count per gap** between hunger windows, spread evenly. One jumbo per gap at most (tune).
- **8 poop points = sick** (normal 1, jumbo 2). The cap is one constant.
- Designed so you can't get sick unless you missed a window.
- Sickness must be treated (medicine) before the next window closes, or it's a care mistake. Missing a second window while sick = **death**.

No sleep need. The raise is too short for it.

### Battle grace rule

Care is done **between** run nodes, never during a fight. If a grace window would close during a battle, it's extended until a few seconds after the battle ends, so the player is never punished for being in a fight. The nursery still ages normally during fights.

### Care mistakes and outcomes

- Mistakes are counted per stage (Baby and Child separately).
- **Death:** reaching a mistake threshold (tune, e.g. ~60% of a stage's failure points), or untreated sickness. The slot is emptied and the player gets a free basic egg.
- **Evolution:** at each stage end, the mon's evolution list is checked in order. The first branch whose requirements are met wins.
  - Requirements are data, from a fixed vocabulary, e.g. `{"careMistakes": "<=1", "effort": ">=3"}`.
  - The last branch has no requirements (fallback).

### Rookie output

A Rookie that leaves the nursery carries:

- **Species** (which Rookie: decided by care)
- **Quality** tier from mistakes and effort, e.g. Perfect / Good / Rough (tune)
- **Starting bonus** by quality: e.g. Perfect = +1 bonus card from its pool and a small max-HP bonus to the shared pool; Rough = none (tune)
- **Inherited cards** from its egg (DNA eggs only, within the inherit budget)

**Default starters** have no quality bonus and no inherited cards. That's the whole reason to raise mons.

## Architecture (Godot 4.7, GDScript)

### Principles

- **Logic is plain classes** (`RefCounted`), with no `Node` or scene dependencies. Scenes only display state and send actions.
- **No `Time.get_*` or OS time in logic.** Time comes in as played seconds from the clock.
- **No global randomness in logic.** Use a seeded `RandomNumberGenerator` stored in state. (Poop timing is deterministic anyway.)
- **All numbers in data.** Species and tuning live in Resources (`.tres`) or JSON, never in logic code.
- **The logic is the same code runs will call.** A run's nursery check between nodes calls the same functions.

### Layout

```
res://
  core/
    nursery/
      nursery_state.gd      # slots, serializable to/from Dictionary
      slot_state.gd         # one mon: stage, age, hearts schedule, poop, sickness, mistakes, effort
      nursery_logic.gd      # advance(state, played_seconds) -> events; actions: feed, protein, train, clean, medicine
      care_schedule.gd      # computes hunger windows, strength checks, poop times for a stage
      evolution.gd          # evaluates requirement dicts against counters (shared with runs later)
      rookie.gd             # output record handed to runs
    tuning.gd               # constants: poop cap, grace length, quality thresholds
  data/
    species/*.tres          # SpeciesDef: id, name, stage, attribute, stage duration,
                            #   hunger interval, poop per gap, evolutions[{to, reqs}], card pool, sprite
    eggs/*.tres             # EggDef: id, baby species, inherit budget
  autoload/
    play_clock.gd           # emits tick(played_delta); time scale; pauses with the game
    game_state.gd           # owns NurseryState, saves/loads
    save_system.gd          # user://save.json, version field, migrations
  scenes/
    nursery/                # nursery screen, slot view, care buttons
    debug/                  # time scale, add egg, force stage, show schedule
  tests/                    # GUT or gdUnit4, headless
```

### Flow

1. `PlayClock` emits `tick(played_delta)` every frame while not paused (scaled by debug time scale).
2. `GameState` calls `NurseryLogic.advance(nursery_state, played_delta)`.
3. `advance` walks events in time order: hearts empty, grace closes, strength check, poop, sickness deadline, stage end → evolution. It returns a list of events for the UI (`hungry`, `pooped`, `sick`, `evolved`, `died`, `mistake`).
4. Player actions (`feed`, `train`, `clean`, …) are functions that take state and return new state plus events.
5. `GameState` autosaves on events and on a timer.

Because `advance` handles any `played_delta` in event order, a big jump (debug ×60, or a long frame) behaves the same as many small ones. That's the property tests check.

### Battle grace

Runs tell the nursery when a battle starts and ends (`NurseryLogic.set_in_battle(state, bool)`). While in battle, grace deadlines that would expire are pushed to battle end + a small buffer.

### Saves

- `user://save.json` with `"version"`. Every change to the save shape adds a migration function. Never break an old save.
- Nursery state serializes to a Dictionary of plain values (no object references).

## Tests

- Normal raise with perfect care → expected Rookie, quality Perfect.
- One missed feed → one mistake, still evolves.
- Missed windows past the death threshold → death, slot empties.
- Poop: no misses never reaches the sickness cap; one miss on a 4+ poop line → sick.
- Sickness untreated through two windows → death; medicine in time → recovers.
- Battle grace: a deadline inside a battle is extended; same deadline outside a battle is not.
- **Chunk invariance:** advancing 3600 s in one call equals 3600 calls of 1 s.
- Save round-trip: serialize → deserialize → identical state.
- Evolution: first matching branch wins; fallback always matches.

## Debug tools

- Time scale ×1 / ×10 / ×60
- Add egg to slot, force next stage, force sick
- Overlay showing upcoming hunger windows, poop times, deadlines and mistake count
- Hide debug UI in release builds

## Prototype content

- **One egg line, two Rookie outcomes** (good care / poor care), placeholder art (colored shapes).
- A second line if time allows, so both slots can raise different mons.

## Out of scope for this weekend

Runs, battles, cards, Extensions, retirement, DNA recycling and DNA eggs. Stub the `Rookie` record and a "Send to run" button that just logs it.

## Open questions

- Stage durations: is ~70 min to Rookie right?
- Discarding a mon in a slot: allowed? Does it give anything?
- What do quality tiers give exactly?
- Should the nursery be reachable mid-run only at rest nodes, or between every node?
