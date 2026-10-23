# Blue Card

*Prototype name. Design as of Oct 23, 2026. Values marked (tune) are starting guesses, not commitments.*

A free, fan-made Digimon roguelike deckbuilder. You raise two monsters in a nursery, then take them on runs where they fight with a shared deck and evolve as the run goes on. Retired monsters are recycled into DNA, which makes better eggs for future runs.

It started as a Digital Monster X-style vpet and grew into a full video game. The vpet DNA is still there: care-driven evolution, poop and sickness, eggs, and lineages.

## Pillars

1. **Your monsters grow up during the run.** A run starts at Rookie and can end at Mega. Evolution is the progression, not just a stat bump.
2. **How you play decides what they become.** Care decides the Rookie. The cards each mon plays decide its later branches.
3. **Bounded combos.** Fun synergies from two card sources and Extensions, inside a 3-energy turn.
4. **Losing still moves you forward.** Default starters are always available, and retirees feed the DNA loop.
5. **Short sessions.** A run should fit in a train ride or a lunch break (tune: ~15–25 min).

## Core loop

```
Eggs ──► Nursery (care, played time) ──► 2 Rookies
                                             │
                                             ▼
                                   Run (quest mode)
                          acts / fights / evolutions / Extensions
                             │                         │
                    retire at checkpoint            lose
                             │                         │
                             ▼                         ▼
                     Retiree hall                  mons die
                             │
                     DNA recycling
                             │
                             ▼
                     Better eggs ──► Nursery
```

## Modes

### Nursery

Played-time care. Raise up to two eggs into Rookies: egg → Baby (~10 min) → Child (~60 min) → Rookie (tune). Care quality decides which Rookie you get and how strong it starts. The nursery clock runs whenever you're playing, including during runs, so you raise your next pair while running the current one. Nothing happens while the game is closed.

Full design: `docs/nursery.md`.

### Runs (quest mode)

Slay the Spire-style runs with two mons. **Detailed design still to be workshopped.** Known so far:

- **Acts are evolution stages.** Start at Rookie; beating act bosses digivolves the mons (Champion → Ultimate → Mega).
- **Branching node map** per act (fights, shop, rest, events, boss) (tune).
- **Retirement checkpoints:** at area checkpoints you can retire your pair. They go to the retiree hall safely. Pushing on risks losing them.
- **Losing the run kills both mons.** You start over with nursery Rookies or default starters.

## Battle system

- **Two mons, one shared health pool.** Nothing to position or protect.
- **One deck:** both mons' card pools are shuffled together at the start of a run.
- **3 energy per turn.** Play any cards you can afford, then end the turn (Slay the Spire structure: ~5-card hand, ~10-card starter deck) (tune).
- **The card's owner performs it:** that mon animates, and its attribute applies.
- **Attributes:** Vaccine > Virus > Data > Vaccine; Free is neutral. Applied per card against the enemy's attribute.
- **Enemy intents are shown in advance**, so you react rather than guess.
- **Evolution is per mon**, based on which cards that mon played (and other run stats). Lean on one mon and it can evolve faster or down a different branch.
- **Extensions (relics)** modify what your mons can do: +1 energy, draw a card when you block, and so on.
- **Cards are slashed.** Card plays use a Tamers-style card-slash presentation.
- **DNA digivolution (later):** a late-run payoff where the two mons fuse and their decks merge into a stronger one.

All battle randomness uses a seeded RNG so fights can be replayed, tested and simulated.

## Monsters, eggs and DNA

- **Default starters** are always available: plain Rookies with basic decks. You can always start a run.
- **Basic eggs** are always available for the nursery.
- **Good eggs come from DNA recycling.** Retired mons break down into DNA, which makes eggs with better lineages, starting bonuses and inherited cards.
- **Inheritance is capped.** Cards have an inherit value, and an egg can't exceed an inherit budget (tune). This keeps runs from getting trivial as your collection grows.
- **Retirees need no care.** The retiree hall is a collection, not a chore.

## Balancing approach

- Start from proven Slay the Spire baselines (3 energy, ~6 damage basic attack, ~5 block basic defend) and tune from there.
- Prototype tiny: two Rookies, one evolution each, ~12 cards per mon, one act, three enemies, one boss.
- **Sim bot:** a headless auto-player that runs thousands of fights and reports win rates, turn counts and which cards correlate with wins.
- All numbers live in data (Resources/JSON), never hardcoded.
- Friends playtest: watch where they die and which cards they always or never pick.

## Platform and tech

- **Godot 4.7, GDScript.** Exports to PC, Android, iOS and web from one project.
- Game logic (care, battle, evolution) lives in plain classes with no scene dependencies, so it's testable headless.
- Saves in `user://` as versioned JSON with migrations from day one.

## IP note

Free, unmonetized fan project. Digimon names and concepts are Bandai's. Keep Bandai sprites and audio out of the repo; use placeholder or original art. No donations or monetization. Keep local backups of the repo.

## Build order

1. **Nursery** (this weekend): two slots, care loop, Rookie output, saves, debug time scale. See `docs/nursery.md`.
2. **Battle prototype:** one fight with two default Rookies, shared deck, 3 energy, attributes, enemy intents. Sim bot.
3. **One act:** node map, rewards (card draft, Extensions), boss, evolution to Champion.
4. **Meta loop:** retirement, retiree hall, DNA recycling, egg inheritance.
5. **Expand:** more acts, more lines, DNA digivolution.

## Open questions

- Run structure: act count, node types, run length, checkpoint placement (next workshop)
- Evolution branch requirements from run stats
- Does a mon that dies in a run leave anything behind (DNA, a card)?
- DNA recycling rules and egg quality tiers
- Shop currency and what it sells
- Card-slash presentation
