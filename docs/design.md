# Digital Monster V Pet — Design

*Decisions as of Oct 23, 2026. Values marked (tune) are starting guesses for playtesting, not commitments.*

## Concept

A free, fan-made vpet: **Pendulum Color roster with Digital Monster X gameplay** (care-driven evolution, levels/XP, quest mode, battles). No X-Antibody forms or X sickness in the base game; a content pack could add an X line later. It's a hands-off check-in game, not a time sink. Vibe-coded side project, kept separate from Island.

## Platform

- **Static web app (PWA) on GitHub Pages.** Free, HTTPS, redeploys on push. No server, no backend.
- **Stack:** TypeScript + canvas, built with Vite. No game engine.
- **Targets:** iPhone, Android and PC browsers, off the app stores.
- **Install-first onboarding:** "Add to Home Screen." iOS Safari can wipe site storage after ~7 days without a visit unless installed.
- **Saves:** IndexedDB, with export/import from day one.
- **No push notifications.** The fixed care schedule makes them unnecessary. PC can optionally fire local notifications while the tab is open.
- **Work hygiene:** personal devices and accounts only.

### Device transfer

- **Save codes** (code or file). Export on one device, import on another; the old copy goes dormant. One mon, one device at a time. Deliberately retro.
- Save codes list the content packs they need (id + version). Import fails clearly if one is missing.

## Care model: fixed check-in windows

The mon needs care on a **predictable daily schedule**, like meals. The player knows when to show up, so no alerts are needed. Time keeps running while the app is closed; everything missed is evaluated on next open (the catch-up pass).

### Hunger drives the schedule

- Hunger draining is the reason windows exist. Hearts drain at a stage-scaled rate, and a **window is when they hit empty**.
- **Hearts are a view of the schedule, not a free simulation.** They visually drain toward the next window time. The UI can show "hungry at 2:00", and that time never moves.
- **Feeding never shifts the schedule.** A dynamic "feed again at" timer was rejected because it drifts and forces the player to check the app (see Rejected).
- **Early check-in:** the next window (only the next one) can be resolved early, up to ~half the gap before it opens (tune).

### Strength

Strength is the "did you engage or take the shortcut" bar, mirroring Pendulum.

- **One strength check per day, on the same window as a hunger check.** It uses the middle hunger window; with an even count, the window at index floor(n/2) (e.g. 2 windows → the 2nd, 4 → the 3rd).
- **Training** (uses the same 3 move-input minigames as battle) fills strength, sheds weight, lowers injury rate, and builds effort hearts (every 4 trainings = 1 effort heart; effort feeds evolution).
- **Protein** is the shortcut: fills strength and restores DP, but adds weight and raises injury rate on loss.
- **Full strength** gives a battle power bonus, scaled by stage (Pendulum: +5 / +8 / +15 / +20 for stages III–VI).

### Three failure points

| Failure point | Frequency | Care mistake if… |
|---|---|---|
| Hunger | Stage-scaled windows per day | a window passes without feeding |
| Strength | Once per day, on a hunger window | not filled (training or protein) in that window |
| Sleep | Once per night | lights not turned off within the lights-out window |

### Stage scaling

Higher stages need care **less often**. Windows get further apart; each window stays the same length.

| Stage | Hunger windows/day (tune) |
|---|---|
| Baby | 4–5 |
| Child | 3–4 |
| Adult / Champion | 2–3 |
| Perfect / Mega | 1–2 |

- Window length: ~2 hours at every stage (tune).
- Mons can override their stage's window count in pack data (validator clamps the range).
- **Care windows are separate from time alive.** Lifetime and evolution timers run on real elapsed hours.

### Clock and day start

- The player can freely shift their **day start**.
- **Resolved slots are locked.** Changing the clock never reopens a fed or missed window.
- **Slot count is fixed when each day starts.** Shifting moves unresolved slots later, never deletes them.
- Lifetime and evolution timers ignore the clock setting.
- Uses the device's local clock, so travel just works.

### Window-skip items (concept, to revisit)

- **Big meat / big pills:** resolve the next hunger or strength slot in advance.
- At most **one pending skip per type**, so they can't be stacked to skip a whole day.
- A skipped slot counts as a success, so the death-ratio math doesn't change.

## Poop and sickness

### Poop

- **8 poop points = sick.** Normal poop = 1, jumbo = 2.
- **Deterministic, not random.** Each mon has a **poop count per gap** between windows (3–6), spread evenly across the gap so it stretches with however the player sets their day.
- **At most one jumbo per gap.** Worst case without a miss: 5 + jumbo = 7 points, always safe.
- **No poops during sleep.**
- A missed window merges two gaps. Mons at 4–6 per gap get sick from one miss; mons at 3 forgive one miss on poop (the missed feed is still a care mistake). The variance gives mons different maintenance feels.
- The poop cap lives in one constant; the sickness threshold and per-mon limits read from it, so it can be raised later.

**Design goal:** you can't log in to a sick mon unless you skipped a check-in.

### Sickness and injury

- Sources: poop overflow (only possible after a missed window), overfeeding to max weight (only during active play), and injury from losing battles.
- **Must be treated by the end of the next window after it starts.** One missed window = care mistake and a visible danger state. Missing the next one too = death.
- **Vaccine item** (costs bits): rescues a mon in the danger state. The bail-out for forgetting.
- **Injury on loss** follows Pendulum: ~10% base chance, +2 points per 4 protein, −2 per win or training, capped at 50% (tune).

## Care mistakes and death

- Mistakes are weighted by stage, e.g. Baby ×1, Child ×1, Adult ×2, Perfect ×3 (tune). Higher stages have tighter thresholds for good evolution branches.
- A few mistakes mean worse outcomes (worse evolution, lower power, more sickness), not death.
- **Death = about 60% of the stage's possible failure points** (tune), not a flat count. Window counts can be tuned (including per-mon overrides) without silently making a stage easier or deadlier.
  - Example: a Perfect with 2 hunger + 1 strength + 1 sleep = 4 failure points/day, 8 over 48h. Death at 5. One terrible day = 4 mistakes: it survives, but evolution is likely wrecked.
- **Goal:** death feels like the player checked out, not like bad luck.

## Quest mode (DMX-style)

- **Areas** made of several battles ending in a **boss**. Beating the boss clears the area and unlocks the next.
- **No losses allowed:** a loss in an area restarts it.
- **DP** gates battles, following Pendulum for now: each battle costs 1 DP; full refill after ≥8h sleep; +1 DP per 4 protein. May be retuned to match check-ins later.
- No hunger gate on quests (DMX's was arbitrary: players just top up before fighting).
- **Hard mode** per stage/area: tougher fights, more XP and bits, and a chance at better item drops. Bias the bonus toward drops, not a big bits multiplier, so bits don't flood the shop.
- **Daily XAI dropped**; hard mode gives the same risk/reward choice, but the player picks it.
- **Rewards:** XP, bits, items.
- **Boss clears unlock certain evolutions**, permanently for the save (not per mon).
- **Area clears unlock home backgrounds**; clear thresholds unlock digivice colors (or let them be bought with bits).
- **Progress belongs to the save, not the mon**, so a death doesn't reset the game.

## Battles and moves

- Each mon has a **moveset** referencing a shared move list.
- Each move has one of **3 input styles**:
  - **Button mash** (scored against the device or rate-capped so phone and PC are equally fair)
  - **Meter**: stop the arrow at the highest point
  - **Sequential press**
- Each move has **3 result tiers: bad, good, great**. The input picks the tier.
- A mon's moveset decides how it feels to play, which is a hook for choosing between evolution branches.
- Battle math uses Pendulum's hit rate idea: power share plus/minus attribute advantage (Vaccine > Virus > Data > Vaccine; Free neutral).
- **Core is seeded:** `battle(monA, monB, seed, inputs)`. Nothing in battle math may use unseeded randomness.

## Levels, evolution and traited eggs

- **Levels and XP** from quest wins, with **DMX's per-stage level caps**: I=1, II=3, III=4, IV=6, V=8, VI=10.
- **Levels reset** when a mon dies.
- **Traited egg (DMX rule):** if the mon survived 48h after its last evolution before dying, every mon from the next egg starts at level 3.
- Evolution reads: care mistakes, effort (stages II–III), level (stages IV–VI), boss-clear unlocks.

### Converting Pendulum evolutions to DMX levels

- Level caps are the same as DMX.
- Pendulum's win-ratio requirements (used for stages V and VI) become level requirements: the **highest win-ratio branches map to max level** for that stage, and lower tiers are spread down from there to get ranges similar to DMX.
- Pendulum's win ratio was probabilistic (80%+ = guaranteed, 70–79% = 70% chance, 40–69% = 40% chance). Level requirements are deterministic, so converted branches become guaranteed once met.
- Traited eggs start at level 3, so requirements at or below 3 are free for traited lines (same as DMX).

## Economy and shop

- **Bits** are the currency, earned from quests.
- **Shop tiers unlock through quest progress only** (for now).
- Items include quest items (DMX-style, e.g. skip to boss, double XP, temporary stat boosts), vaccine, big meat / big pills.
- **Later:** a trainer level from quest clears plus raising a variety of mons (album entries), possibly spent as skill points on new item selections. Keep it out of v1.

## Content packs

The roster is **pack-driven**. The Pendulum roster ships as the first pack, in the exact format users get. No back doors for core content.

```
packs/pendulum-nsp/
  manifest.json   id, version, author, depends
  mons/*.json     name, desc, stage, attribute, power,
                  moveset, poopPerGap, careWindows (optional override),
                  evolutions[{to, reqs}], sprite, sfx
  moves.json      id, style (mash|meter|sequence), tiers {bad, good, great}, anim
  assets/         sprite sheets, audio
```

- **Namespaced IDs** (`nsp:agumon`). Evolutions can target another pack's mons if it's listed in `depends`.
- **Requirements are data, never code.** Fixed vocabulary, e.g. `{careMistakes: "<=3", level: ">=5", bossCleared: "nsp:area12"}`. No scripts in packs.
- **Fixed sprite spec:** frame size and a required animation list (idle, eat, attack, sleep, sick, …).
- **Validator / pack linter:** every evolution target exists, boss unlocks point at real mons and areas, poop counts within the cap, window overrides within range, all required frames present. Run it in dev and on import.
- **Distribution:**
  - **Local import** into IndexedDB (e.g. someone imports a Virus Busters pack and has that line). This is the path for anything using Bandai sprites, keeping that art off the repo.
  - **PRs to the repo** for curated packs; original art only.

## PvP (later)

- **Battle codes:** each player exports their mon as a code or QR; the battle runs locally from both codes and a shared seed.
- **Codes are self-contained:** they embed the mon's stats and moves, so a battle works even if the opponent lacks the pack (placeholder sprite).
- No player input in PvP: each move's tier is rolled from the seed, with odds improving with level (e.g. 30/50/20 at low level → 10/50/40 at max; tune).
- Forged codes are acceptable for a free fan game. A live online layer is out of scope.

## Architecture seams

Build swappable seams from day one so an active-play mode can be playtested later on the same engine:

- **Clock:** real time (check-in) vs. played time (active)
- **Mistake source:** missed windows (check-in) vs. in-session failures (active)
- **Encounter source:** quest areas as fixed battle lists (check-in) vs. encounters placed on a walkable map (active). Areas are pure data either way.
- **Move input:** tier from minigame (quests), seeded roll (PvP), real-time input (active).

Evolution, battles, packs, the shop and save codes read counters (mistakes, effort, level, battles) and don't care where they come from. **Caveat:** active mode's real cost is content, not the rule swap. Prototype one small area first.

## Engineering notes

- **The catch-up pass is the riskiest code.** On open, it replays windows, poops, sickness deadlines, DP and evolution timers in order. Test it with fake clocks.
- **Move inputs need feel tuning** across phone and PC.
- **Battle core must stay deterministic** (seeded RNG only).
- Most of the remaining work is data, which is why the validator matters.

## Build order

1. Check-in mode, single mon: windows, strength, poop/sickness, care mistakes, evolution, saves and save codes. Pack format + validator from day one, with one Pendulum line as the first pack.
2. Quest mode: areas, battles with move inputs, levels/XP, DP, bits, shop.
3. Roster expansion via packs (full Pendulum roster); local pack import.
4. PvP battle codes.
5. Active-mode prototype (one area) on the same engine.

## Rejected alternatives

- **Native iOS app:** App Store rejects Digimon IP; TestFlight is invite-only with 90-day builds.
- **Android-only APK:** drops iPhone (over half of US phones).
- **Web push via Cloudflare Worker + D1 + Queues:** needs a server, ~800 daily-player free-tier ceiling, and only needed for timer-based calls, which fixed windows remove.
- **Full Next Order-style active raising as the main mode:** too much of a time sink and content work. Kept as a later experiment.
- **DMX hunger gate on quests:** arbitrary; players just top up first. Replaced by DP.
- **Daily XAI roll:** RNG difficulty. Replaced by player-chosen hard mode.
- **Dynamic "feed again" timer:** feeding early/late would drift the schedule and force app checks, bringing back the notification problem. Replaced by fixed windows + early check-in.
- **Pendulum win ratio for evolution:** replaced by DMX levels.
- **X sickness / X-Antibody:** removed from the base game.
- **Pendulum shake input:** PC can't shake and iOS gates motion behind a permission prompt.

## Open questions

- All (tune) values: window counts and length, stage mistake weights, death share (~60%), early check-in lead time, poop counts, injury rates, DP numbers, hard-mode rewards, PvP tier odds
- Big meat / big pills as window skips: final design
- Missed days: a "sitter" item, or does the skip item cover it?
- Injury death rule beyond the treat-by-next-window deadline (e.g. Pendulum's 12 injuries per form)?
- Sequential-press input details
- Trainer level and skill points (later)
- Visuals: how hearts, danger state and windows are shown

## IP note

Using Bandai's Digimon IP is tolerated in free, unmonetized fan projects, not protected. A DMCA notice to GitHub would disable the repo, so keep local backups. Sprites live in packs so original art can replace them, and Bandai-sprite packs should be distributed via local import rather than hosted in the repo.
