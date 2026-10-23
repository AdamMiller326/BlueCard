# Nursery — Design & Architecture

*Blue Card prototype. Values marked (tune) are starting guesses. See `GAME.md` for the whole game.*

## Purpose

The nursery raises Rookies through short, played-time care, **one mon at a time**: egg → In-Training → Rookie in about 11 minutes of played time. Care decides **which Rookie** you get and **how strong it starts** a run. Finished Rookies go to your **Rookie roster**, so you build up an army of Rookies while you play runs, then pick two from the roster for each run.

It is not a vpet. Nothing happens while the game is closed.

## Rules

### Slot and roster

- **One nursery slot.** One mon at a time, from egg to Rookie.
- **A finished Rookie moves to the roster** and the slot frees up for the next egg.
- **Roster Rookies need no care.** They wait until you take them on a run.
- **Starting a run:** pick any two Rookies from the roster (or default starters).
- An empty slot takes an egg from any **unlocked egg group** (free), or a **DNA egg** (from recycling, later).

### Egg groups

- Each egg group hatches an In-Training mon that can become **one of ~3 Rookies**, decided by care.
- **Groups overlap.** Two groups can share a Rookie, the way Digimon lines web together. Example: the first group gives 3 possible Rookies; unlocking a second group brings the total to 5.
- **Ideally one Rookie per deck archetype.** Over time, the egg groups cover every Rookie archetype.
- **You start with one egg group.** More unlock through:
  - **Run progress:** clearing areas or beating specific bosses.
  - **DNA recycling:** retiring mons can unlock a group early (e.g. ending a run early and retiring a Champion).
- Unlock conditions are data, using the same requirement vocabulary as evolution.

### Played-time clock

- The nursery clock advances only while the game is running and not paused: on the nursery screen, in menus, and during runs.
- **Stops** when the game is closed or paused. On launch, nothing is caught up.
- A debug **time scale** (×1, ×10, ×60) speeds everything up for testing.

### Stages (tune)

| Stage | Duration (played) | Next |
|---|---|---|
| Egg | ~1 min (hatch) | In-Training |
| In-Training | ~10 min | Rookie (one of the group's outcomes) |
| Rookie | — (ready) | moves to the roster |

No Baby I (Fresh) stage: eggs hatch straight into In-Training. Durations come from the mon's data so groups can differ.

### Needs

**Hunger**

- Hearts drain on a **fixed schedule**. Each species sets its own hunger interval in its data, e.g. ~2.5 min played (~4 per raise) (tune).
- When hearts hit empty, the mon **calls** (the usual vpet alert) and a **call timer** starts (~2 min played) (tune). Feeding before it runs out is fine. If it runs out unfed, that's a **care mistake**.
- The UI presents this as a vpet call: alert when hungry, call timer. No "window" wording for the player.
- Feeding doesn't shift the schedule. Hearts are a view of the schedule, so the UI can show "hungry in 1:20".
- Overfeeding adds weight. Weight has no effect in the nursery; it carries over on the Rookie (reaching 100 matters later, as on the DMX/Pendulum).

**Strength**

- **One strength check per raise**, on the middle hunger call (tune).
- Filled by **training** (a short minigame; a button press is fine for the prototype) or **protein** (instant, adds weight).
- Unfilled at the check = care mistake.
- Every 2 trainings = 1 **effort** point, so each training is half an effort heart (tune). Effort feeds which Rookie you get and its quality.
- **Spamming training is fine.** No cooldown. Training counts up to **8 times per raise**; **effort is capped at 4**.
- **Training is a timing minigame** (based on the DMX one). Each success gives **+1 or +2 to a random stat** depending on timing. Stat gains carry to the Rookie. (Random stat uses the seeded RNG in state.)
- Rookies with lower effort requirements get **higher base stats** to compensate.
- Later: different training types and minigames that stat-train the mon, giving its Rookie different effects.

**Poop**

- Each egg group has a fixed **poop count per gap** between hunger calls (2–4), spread evenly. One jumbo per gap at most (tune).
- Poop is removed with the **Clean** menu action.
- **8 poop points = one care mistake** (normal 1, jumbo 2). The cap is one constant. It can't cost another mistake until you clean.
- Designed so you can't hit the cap if you clean once per gap.

**No sickness and no death in the nursery.** No sleep need either. The raise is too short for it.

### Battle grace rule

Care is done **between** run nodes, never during a fight. If a call timer would run out during a battle, it's extended until a few seconds after the battle ends, so the player is never punished for being in a fight. The nursery still ages normally during fights.

### Care mistakes and outcomes

- Mistakes are counted over the raise.
- Care mistakes are shown as **condition hearts**, the way the Pendulum Color shows them. The number of hearts is per species (Nyaromon has 2).
- **No death.** Mistakes only change which Rookie you get and its quality. Bad care still gives a Rookie, just a worse one (e.g. Numemon).
- **Evolution:** when In-Training ends, its evolution list is checked in order. The first branch whose requirements are met wins.
  - Requirements are data, from a fixed vocabulary that matches Humulos: `conditionHearts` (hearts left: the species' condition hearts minus care mistakes, floor 0) and `effort` (effort hearts, 0–4). `careMistakes` stays as the internal counter the hearts come from.
  - Example for a group with three outcomes:
    - `{"conditionHearts": ">=2", "effort": ">=2"}` → Rookie A
    - `{"conditionHearts": ">=1"}` → Rookie B
    - `{}` → Rookie C (fallback)

### Rookie output

A Rookie that enters the roster carries:

- **Species** (which Rookie: decided by care)
- **Quality** tier from mistakes and effort, e.g. Perfect / Good / Rough (tune)
- **Starting bonus** by quality: e.g. Perfect = +1 bonus card from its pool and a small max-HP bonus to the shared pool; Rough = none (tune)
- **Inherited cards** from its egg (DNA eggs only, within the inherit budget)

**Default starters** have no quality bonus and no inherited cards. They exist so a brand-new player, or one with an empty roster, can always start a run.

## Architecture (Godot 4.7, GDScript)

### Principles

- **Logic is plain classes** (`RefCounted`), with no `Node` or scene dependencies. Scenes only display state and send actions.
- **No `Time.get_*` or OS time in logic.** Time comes in as played seconds from the clock.
- **No global randomness in logic.** Use a seeded `RandomNumberGenerator` stored in state. (Poop timing is deterministic anyway.)
- **All numbers in data.** Species, egg groups and tuning live in Resources (`.tres`) or JSON, never in logic code.
- **The logic is the same code runs will call.** A run's nursery check between nodes calls the same functions.

### Layout

```
res://
  core/
    nursery/
      nursery_state.gd      # the slot, the roster, unlocked egg groups; serializable to/from Dictionary
      slot_state.gd         # one mon: stage, age, hearts schedule, poop, mistakes, effort
      nursery_logic.gd      # advance(state, played_seconds) -> events; actions: start_egg, feed, protein, train, clean
      care_schedule.gd      # computes hunger calls, strength check, poop times for a raise
      evolution.gd          # evaluates requirement dicts against counters (shared with runs later)
      unlocks.gd            # evaluates egg group unlock conditions (same requirement vocabulary)
      rookie.gd             # roster entry handed to runs
    tuning.gd               # constants: poop cap, grace length, quality thresholds
  data/
    species/*.tres          # SpeciesDef: id, name, stage, attribute, stage duration,
                            #   hunger interval, poop per gap, evolutions[{to, reqs}], card pool, sprite
    egg_groups/*.tres       # EggGroupDef: id, in_training species, unlock reqs, inherit budget
  autoload/
    play_clock.gd           # emits tick(played_delta); time scale; pauses with the game
    game_state.gd           # owns NurseryState, saves/loads
    save_system.gd          # user://save.json, version field, migrations
  scenes/
    nursery/                # nursery screen, slot view, care buttons, egg picker
    roster/                 # Rookie roster, pick two for a run
    debug/                  # time scale, unlock group, force stage, show schedule
  tests/                    # GUT or gdUnit4, headless
```

### Flow

1. `PlayClock` emits `tick(played_delta)` every frame while not paused (scaled by debug time scale).
2. `GameState` calls `NurseryLogic.advance(nursery_state, played_delta)`.
3. `advance` walks events in time order: hearts empty, grace closes, strength check, poop, stage end → evolution → roster. It returns a list of events for the UI (`hatched`, `hungry`, `pooped`, `evolved`, `to_roster`, `mistake`).
4. Player actions (`start_egg`, `feed`, `train`, `clean`, …) are functions that take state and return new state plus events.
5. `GameState` autosaves on events and on a timer.

Because `advance` handles any `played_delta` in event order, a big jump (debug ×60, or a long frame) behaves the same as many small ones. That's the property tests check.

### Battle grace

Runs tell the nursery when a battle starts and ends (`NurseryLogic.set_in_battle(state, bool)`). While in battle, grace deadlines that would expire are pushed to battle end + a small buffer.

### Saves

- `user://save.json` with `"version"`. Every change to the save shape adds a migration function. Never break an old save.
- Nursery state (slot, roster, unlocks) serializes to a Dictionary of plain values (no object references).

## Tests

- Normal raise with perfect care → Rookie A, quality Perfect, lands in the roster, slot empties.
- One missed feed → one mistake, still evolves (Rookie B).
- Poor care → fallback Rookie C.
- No care at all → still reaches Rookie (fallback), no death.
- Poop: cleaning every gap never reaches the cap; one missed clean on a 4-poop group → one mistake.
- Battle grace: a deadline inside a battle is extended; same deadline outside a battle is not.
- Egg picker only offers unlocked groups; an unlock condition being met unlocks its group.
- **Chunk invariance:** advancing 660 s in one call equals 660 calls of 1 s.
- Save round-trip: serialize → deserialize → identical state.
- Evolution: first matching branch wins; fallback always matches.

## Debug tools

- Time scale ×1 / ×10 / ×60
- Unlock egg group, force next stage, add Rookie to roster
- Overlay showing upcoming hunger calls, poop times, deadlines and mistake count
- Hide debug UI in release builds

## Prototype content

- **Greybox with the Pendulum Virus Busters roster**, placeholder art (colored shapes).
- Egg group: **Nyaromon** (In-Training). Its Rookies are Agumon, Gabumon, Plotmon and Gammamon.
- **First slice uses two Rookies: Agumon and Gabumon.** Plotmon and Gammamon come later.
- Nyaromon (2 condition hearts): `{"conditionHearts": ">=1"}` → **Agumon**; `{}` → **Gabumon** (fallback). When Plotmon is added: Gabumon `{"conditionHearts": "0", "effort": ">=1"}`, Plotmon `{}`.
- Champions for the slice (runs, later): Greymon, Leomon and Garurumon.
- A second, overlapping egg group if time allows, to test unlocks and shared Rookies.

## Out of scope for this weekend

Runs, battles, cards, Extensions, retirement, DNA recycling and DNA eggs. Stub the `Rookie` record and a "Send to run" button that picks two roster Rookies and just logs them.

## Open questions

- Could the nursery (the vpet side) grow into how meta progression is handled?
- Is ~11 min per Rookie right?
- Roster cap? Can roster Rookies be released or recycled directly?
- Exactly what unlocks each egg group (which bosses/areas, which retirements)?
- Should the nursery be reachable mid-run only at rest nodes, or between every node?
- What do quality tiers give exactly?
