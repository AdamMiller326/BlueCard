# Blue Card

*Prototype name. Design as of Oct 23, 2026. Values marked (tune) are starting guesses, not commitments.*

A free, fan-made Digimon roguelike deckbuilder. You raise monsters in a nursery to build a roster of Rookies, then take two at a time on runs where they fight with a shared deck and evolve as the run goes on. Retired monsters are recycled into DNA, which makes better eggs for future runs.

It started as a Digital Monster X-style vpet and grew into a full video game. The vpet DNA is still there: care-driven evolution, poop, eggs, and lineages.

## Pillars

1. **Your monsters grow up during the run.** A run starts at Rookie and can end at Mega. Evolution is the progression, not just a stat bump.
2. **How you play decides what they become.** Care decides the Rookie. The cards each mon plays decide its later branches.
3. **Bounded combos.** Fun synergies from two card sources, elements and Extensions, inside a 3-energy turn.
4. **Clarity.** Every number the player needs is on screen. No mental math.
5. **Losing still moves you forward.** Default starters are always available, and retirees feed the DNA loop.

## Core loop

```
Egg groups ──► Nursery (one at a time) ──► Rookie roster (pick 2)
                                             │
                                             ▼
                                            Run
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
          Better eggs + new egg groups ──► Nursery
```

## Opening and tutorial

1. The player swipes a **blue card** into an original device (not a D-Arc lookalike). It creates their first Rookie (fixed for the prototype; maybe a choice later).
2. They also get an egg for the nursery and learn feeding and cleaning.
3. **First mini-run with just the Rookie**: one mon and a small deck to learn energy, block, attributes and intents.
4. The tutorial nursery runs fast (~3 min). Between nodes the player goes back to care for it.
5. **It reaches Rookie and joins the run.** The two decks shuffle together; the game explains shared HP and card owners.
6. The tutorial boss triggers an evolution, then a checkpoint teaches retirement and DNA.

## Nursery

Played-time care, one mon at a time: egg (~1 min) → In-Training (~10 min) → Rookie (tune). Care decides which Rookie you get; training decides its starting stats. Finished Rookies join a **roster**, so you build an army of Rookies while playing runs and pick two for each run. The nursery clock runs whenever you're playing, including during runs. Nothing happens while the game is closed.

- **Egg groups:** each group's In-Training mon can become one of ~3 Rookies. Groups overlap and share Rookies, so lines web together like Digimon. Ideally there's one Rookie per deck archetype.
- **Unlocks:** you start with one egg group. Run progress unlocks more, and DNA recycling (e.g. retiring a Champion from an early-ended run) can unlock them early.

Full design: `docs/nursery.md`.

## Runs

Slay the Spire-style runs with two mons. Four tiers, one per stage:

| Tier | Stage | Notes |
|---|---|---|
| Act 1 (longer) | Rookie → Champion | Starts on File Island. A **mid-act mini-boss** (e.g. Seadramon) digivolves the mons to Champion, and the world transforms (e.g. into Spiral Mountain). |
| Act 2 | Champion → Ultimate | Evolve at the act boss. |
| Act 3 | Ultimate → Mega | Evolve at the act boss. |
| Final | Mega | Always **Cyberspace**: a short final region (a couple of fights and the final boss). |

- **Each act has a branching node map** (fights, shop, rest, events, boss) (tune).
- **Fixed forks.** Each act ends at a fork between two known bosses (e.g. Devimon or a holy boss). The choice leads to a different next area. Routes can merge again later (a lattice, not a tree), so content stays buildable.
- **Information up front:** the boss options are shown at the start of the act, and map nodes show enemy attributes, so a bad matchup is a path choice, not bad luck.
- **Retirement checkpoints** at the end of each area: retire the pair to the retiree hall safely, or push on and risk them.
- **Losing the run kills both mons.** You start over with nursery Rookies or default starters.

## Battle system

- **Two mons, one shared health pool.** Nothing to position or protect. HP carries between fights.
- **One deck:** both mons' cards are shuffled together at the start of a run.
- **3 energy per turn.** Play any cards you can afford, then end the turn. ~5-card hand (tune).
- **Enemy intents are shown in advance.** No turn-order or speed system: you see what's coming, respond, then the enemy acts.
- **The card's owner performs it:** that mon animates, and its stats, passive and attribute apply.

### Stats and damage

- Each mon form has a small stat block: **ATK** (multiplies attack cards) and **DEF** (multiplies block cards). Maybe **SPR** for heals and stacks later.
- **Traits** are additive bonuses (like Slay the Spire's Strength).
- `damage = (card base × ATK multiplier + trait bonuses) × attribute modifier`
- **Display:** cards in hand show the player-side number (stats + traits applied). Hovering an enemy shows the final outcome (attribute, enemy block, debuffs).

### Attributes

- **Vaccine > Virus > Data > Vaccine; Free is neutral.** Names are placeholders until original ones are chosen. Always called *attributes* in the UI.
- **±25%** damage modifier (tune). A nudge, not a hard counter.
- Attributes can change along a line (Agumon is Vaccine, SkullGreymon is Virus), so choosing an evolution branch is also choosing a matchup.

### Elements

Elements describe status effects and archetypes. They are never called types or attributes, and there is no element weakness chart.

| Element | Verb | Mechanic |
|---|---|---|
| Fire / Burn | Burst | Stacks build like a time bomb, then detonate (by a card or a countdown). |
| Poison | Drain over time | Ticks every turn and decays. |
| Ice | Control | Builds up, then freezes the enemy. Needs limits: rising threshold, bosses resist, stacks consumed on freeze. |
| Holy | Heal | Healing and protection. |
| Darkness | Drain | Lifesteal; self-damage for power (zombie lines). |
| Air | Draw | Card draw and hand manipulation. |
| Electricity | Charge | Energy: store unused energy, bonus energy after chains. |
| Rock | Fortify | Block that persists between turns, Thorns. |
| Grass | Grow | Cards get stronger each time they're played in a fight. |

Don't force every element into the prototype. Add them when a line needs one.

## Monsters and cards

### A mon's cards

Every mon form brings **6 cards**:

- **5 basics** (3 attack, 2 defend).
- **1 signature** card that expresses the line's identity (e.g. Pepper Breath detonates Burn).

On evolution:

- **Basics swap** to the new form's basics, but only in slots that still exist. A deleted basic is gone forever; evolution won't bring it back.
- **The signature upgrades in place** (Pepper Breath becomes Nova Blast). Signatures can't be deleted.
- **Drafted cards stay** through every evolution.

### Passive ability (identity)

- Each form has an always-on **passive** that defines the line. No draw needed. E.g. Agumon's attacks apply 1 Burn; the signature cashes it in.
- Evolving upgrades the passive. **Old forms leave their passive behind as stacked traits**, so every evolution path leaves a fingerprint.
- Signatures should *do* something (detonate, freeze, execute, drain), not just be bigger numbers.

### Evolution

- **Per mon**, based on which cards that mon played (and other run stats).
- **Branch requirements are visible** ahead of time ("Play 6 more attack cards with Agumon → Greymon"), so steering toward a branch (and its attribute) is skill, not guesswork.

### Jogress (DNA digivolution)

- **Only specific pairs fuse**, defined in data, at the stage they canonically fuse (e.g. ExVeemon + Stingmon → Paildramon at Ultimate). Other pairs evolve individually.
- A reward for planning your nursery pair around it.
- **Fusing must beat staying two:** the fused mon gets the merged deck, its own signature, and a big bonus (e.g. +1 energy or stronger stats).
- **Discoverability:** hints in the collection, mon descriptions, or a roster glow when a compatible pair is selected for a run.

## Card and item types

| Name | What it is | Notes |
|---|---|---|
| **Install** | Persistent card (Slay the Spire's Powers) | Optional build choices like Firewall. Scoped to the owner. Exhaust on play. Cheap installs have small effects. |
| **Extension** | Relic | E.g. +1 energy, draw on block, first Install each fight costs 0. |
| **Trainer card** | Consumable (potion) | Limited slots. |
| **Blue card** | Rare trainer card | One-battle digivolve. The player picks which next-stage branch. The panic button. |
| **Yellow card** | Rarest trainer card | Lets a compatible jogress pair fuse early, for the rest of the act. |
| **Delete** | Card removal | Deleting basics is permanent. |
| **Patch** | Card upgrade | Can make an Install Innate or 0-cost. |

Keep plain words for common actions (Attack, Block). Save computer flavor for special mechanics.

## Monsters, eggs and DNA

- **Default starters** are always available: plain Rookies with basic decks. You can always start a run.
- **Egg groups** are free once unlocked. Run progress and recycling unlock new groups.
- **DNA eggs come from recycling.** Retired mons break down into DNA, which makes eggs with starting bonuses and inherited cards, and can unlock egg groups early.
- **Inheritance is capped.** Cards have an inherit value, and an egg can't exceed an inherit budget (tune).
- **Retirees need no care.** The retiree hall is a collection, not a chore.

## Balancing approach

- Start from Slay the Spire baselines (3 energy, ~6 damage basic attack, ~5 block basic defend) and tune from there.
- Prototype tiny: two Rookies, one evolution each, ~12 cards per mon, Act 1 only, three enemies, one mini-boss, one boss.
- **Sim bot:** a headless auto-player that runs thousands of fights and reports win rates, turn counts and which cards correlate with wins.
- All numbers live in data (Godot Resources), never hardcoded.
- Watch for outscaling too early (an act going flat) and cross-run creep from DNA inheritance.
- Friends playtest: watch where they die and which cards they always or never pick.

## Platform and tech

- **Godot 4.7, GDScript.** Exports to PC, Android, iOS and web from one project.
- Game logic (care, battle, evolution) lives in plain classes with no scene dependencies, so it's testable headless.
- All battle randomness uses a seeded RNG so fights can be replayed, tested and simulated.
- Saves in `user://` as versioned JSON with migrations from day one.

## IP note

Free, unmonetized fan project. Digimon names and concepts are Bandai's. Keep Bandai sprites and audio out of the repo; use placeholder or original art. Don't copy Digimon Card Game card text or art. No donations or monetization. Keep local backups of the repo.

## Build order

1. **Nursery** (this weekend): one slot, care loop, Rookie roster, egg groups and unlocks, saves, debug time scale. Greybox branching with the Pendulum Virus Busters roster. See `docs/nursery.md`.
2. **Battle prototype:** one fight with two default Rookies, shared deck, 3 energy, stats, attributes, one element (Burn), enemy intents. Sim bot.
3. **Act 1:** node map, rewards (card draft, Extensions, trainer cards), Seadramon mini-boss, evolution to Champion, area transform, boss fork.
4. **Meta loop:** retirement, retiree hall, DNA recycling, egg inheritance, tutorial.
5. **Expand:** Acts 2–3, Cyberspace, more lines and elements, jogress.

## Open questions

- Act length, node types and run length (playtest)
- Roster cap, and exactly what unlocks each egg group
- Branch requirements from run stats: exact vocabulary
- Does a mon that dies in a run leave anything behind?
- DNA recycling rules and egg quality tiers
- Shop currency and what it sells
- Original names for the attributes
- Card-slash presentation
