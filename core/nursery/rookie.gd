class_name Rookie
extends RefCounted
## What a mon carries out of the nursery into a run. Runs aren't built yet;
## this is the handoff record.

var species_id: String = ""
var quality: String = Tuning.QUALITY_NONE
var bonus_cards: int = 0
var max_hp_bonus: int = 0
## From DNA eggs (later). Always empty for basic eggs.
var inherited_cards: PackedStringArray = PackedStringArray()
var weight: int = 0
var mistakes: int = 0
var effort: int = 0


static func quality_for(total_mistakes: int, effort_points: int) -> String:
	if total_mistakes <= Tuning.PERFECT_MAX_MISTAKES and effort_points >= Tuning.PERFECT_MIN_EFFORT:
		return Tuning.QUALITY_PERFECT
	if total_mistakes <= Tuning.GOOD_MAX_MISTAKES:
		return Tuning.QUALITY_GOOD
	return Tuning.QUALITY_ROUGH


static func from_slot(slot: SlotState) -> Rookie:
	var r := Rookie.new()
	r.species_id = slot.species_id
	r.mistakes = slot.total_mistakes()
	r.effort = slot.effort()
	r.weight = slot.weight
	r.quality = quality_for(r.mistakes, r.effort)
	r._apply_bonus()
	return r


## A default starter: no quality bonus, no inherited cards.
static func default_starter(species: String) -> Rookie:
	var r := Rookie.new()
	r.species_id = species
	r._apply_bonus()
	return r


func _apply_bonus() -> void:
	var bonus: Dictionary = Tuning.QUALITY_BONUS.get(quality, Tuning.QUALITY_BONUS[Tuning.QUALITY_NONE])
	bonus_cards = int(bonus["bonus_cards"])
	max_hp_bonus = int(bonus["max_hp_bonus"])


func to_dict() -> Dictionary:
	return {
		"species_id": species_id,
		"quality": quality,
		"bonus_cards": bonus_cards,
		"max_hp_bonus": max_hp_bonus,
		"inherited_cards": Array(inherited_cards),
		"weight": weight,
		"mistakes": mistakes,
		"effort": effort,
	}


static func from_dict(d: Dictionary) -> Rookie:
	var r := Rookie.new()
	r.species_id = String(d.get("species_id", ""))
	r.quality = String(d.get("quality", Tuning.QUALITY_NONE))
	r.bonus_cards = int(d.get("bonus_cards", 0))
	r.max_hp_bonus = int(d.get("max_hp_bonus", 0))
	r.inherited_cards = PackedStringArray(d.get("inherited_cards", []))
	r.weight = int(d.get("weight", 0))
	r.mistakes = int(d.get("mistakes", 0))
	r.effort = int(d.get("effort", 0))
	return r
