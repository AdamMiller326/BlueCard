class_name Tuning
extends RefCounted
## Nursery tuning constants. Every value here is a starting guess (tune).
## Per-species numbers (stage lengths, hunger interval, poop per gap) live in
## data/species/*.tres instead. See docs/nursery.md for the rules.

## Slots in the nursery. (nursery.md: Slots)
const SLOT_COUNT := 2

## Played seconds a hunger window stays open after hearts hit empty.
## (nursery.md: Needs > Hunger, "grace window ~5 min")
const GRACE_SECONDS := 300.0
## Hearts shown when full. Display only. (nursery.md: Needs > Hunger)
const HEARTS_MAX := 4

## Poop points that count as a care mistake. The one poop cap constant.
## (nursery.md: Needs > Poop)
const POOP_CAP := 8
const POOP_POINTS_NORMAL := 1
const POOP_POINTS_JUMBO := 2

## Trainings per effort point. (nursery.md: Needs > Strength, "every 4 trainings")
const TRAININGS_PER_EFFORT := 4
## Played seconds before another training counts. Stops button-mashing effort.
## (nursery.md: Needs > Strength)
const TRAIN_COOLDOWN_SECONDS := 20.0

## Weight. Tracked and carried on the Rookie, no effect in the nursery.
## (nursery.md: Needs > Weight)
const WEIGHT_PER_OVERFEED := 1
const WEIGHT_PER_PROTEIN := 2
const WEIGHT_PER_TRAINING := -1
const WEIGHT_MIN := 1
const WEIGHT_MAX := 99

## Seconds after a battle ends before a deferred grace window may close.
## (nursery.md: Battle grace rule, "a few seconds")
const BATTLE_GRACE_BUFFER_SECONDS := 5.0

## Rookie quality tiers. Mistakes are Baby + Child combined.
## (nursery.md: Rookie output)
const QUALITY_PERFECT := "perfect"
const QUALITY_GOOD := "good"
const QUALITY_ROUGH := "rough"
## Default starters, which never went through the nursery.
const QUALITY_NONE := "none"
const PERFECT_MAX_MISTAKES := 0
const PERFECT_MIN_EFFORT := 3
const GOOD_MAX_MISTAKES := 2

## Starting bonus by quality. (nursery.md: Rookie output)
const QUALITY_BONUS := {
	QUALITY_PERFECT: {"bonus_cards": 1, "max_hp_bonus": 5},
	QUALITY_GOOD: {"bonus_cards": 0, "max_hp_bonus": 2},
	QUALITY_ROUGH: {"bonus_cards": 0, "max_hp_bonus": 0},
	QUALITY_NONE: {"bonus_cards": 0, "max_hp_bonus": 0},
}
