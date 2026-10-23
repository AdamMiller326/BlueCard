class_name Catalog
extends RefCounted
## Species and egg lookup, plus the data validator. Built from Resources; it
## does no file I/O itself.

const STAGES := [SlotState.BABY, SlotState.CHILD, SlotState.ROOKIE]
const NEXT_STAGE := {SlotState.BABY: SlotState.CHILD, SlotState.CHILD: SlotState.ROOKIE}
const ATTRIBUTES := ["vaccine", "data", "virus", "free"]

var species: Dictionary = {}
var eggs: Dictionary = {}
var basic_egg_id: String = ""
var _load_errors := PackedStringArray()


static func from_def(def: CatalogDef) -> Catalog:
	return from_lists(def.species, def.eggs, def.basic_egg)


static func from_lists(species_list: Array, egg_list: Array, basic_egg: String) -> Catalog:
	var c := Catalog.new()
	c.basic_egg_id = basic_egg
	for sp in species_list:
		if not sp is SpeciesDef:
			c._load_errors.append("species list has a non-SpeciesDef entry")
		elif c.species.has(sp.id):
			c._load_errors.append("duplicate species id '%s'" % sp.id)
		else:
			c.species[sp.id] = sp
	for egg in egg_list:
		if not egg is EggDef:
			c._load_errors.append("egg list has a non-EggDef entry")
		elif c.eggs.has(egg.id):
			c._load_errors.append("duplicate egg id '%s'" % egg.id)
		else:
			c.eggs[egg.id] = egg
	return c


func get_species(id: String) -> SpeciesDef:
	return species.get(id)


func get_egg(id: String) -> EggDef:
	return eggs.get(id)


## Every problem with the data. Empty means valid.
func validate() -> PackedStringArray:
	var errors := _load_errors.duplicate()
	if not eggs.has(basic_egg_id):
		errors.append("basic egg '%s' not found" % basic_egg_id)
	for id in species:
		for e in _validate_species(species[id]):
			errors.append("species '%s': %s" % [id, e])
	for id in eggs:
		for e in _validate_egg(eggs[id]):
			errors.append("egg '%s': %s" % [id, e])
	return errors


func _validate_species(sp: SpeciesDef) -> PackedStringArray:
	var errors := PackedStringArray()
	if sp.id.is_empty():
		errors.append("empty id")
	if not sp.stage in STAGES:
		errors.append("unknown stage '%s'" % sp.stage)
		return errors
	if not sp.attribute in ATTRIBUTES:
		errors.append("unknown attribute '%s'" % sp.attribute)
	if sp.stage == SlotState.ROOKIE:
		return errors

	if sp.stage_seconds <= 0.0:
		errors.append("stage_seconds must be > 0")
	if sp.hunger_interval <= 0.0:
		errors.append("hunger_interval must be > 0")
	if sp.poop_per_gap < 0:
		errors.append("poop_per_gap must be >= 0")
	if sp.jumbo_per_gap and sp.poop_per_gap < 1:
		errors.append("jumbo_per_gap needs at least one poop per gap")
	# Cleaning once per gap must keep you under the cap.
	var gap_points := sp.poop_per_gap * Tuning.POOP_POINTS_NORMAL
	if sp.jumbo_per_gap:
		gap_points += Tuning.POOP_POINTS_JUMBO - Tuning.POOP_POINTS_NORMAL
	if gap_points >= Tuning.POOP_CAP:
		errors.append("poop per gap (%d points) must be under the cap (%d)" % [gap_points, Tuning.POOP_CAP])
	if sp.strength_every < 0:
		errors.append("strength_every must be >= 0")

	if sp.evolutions.is_empty():
		errors.append("no evolutions")
		return errors
	for i in sp.evolutions.size():
		var branch = sp.evolutions[i]
		if not branch is Dictionary:
			errors.append("evolution %d is not a dictionary" % i)
			continue
		var to := String(branch.get("to", ""))
		var target := get_species(to)
		if target == null:
			errors.append("evolution target '%s' not found" % to)
		elif target.stage != NEXT_STAGE[sp.stage]:
			errors.append("evolution target '%s' is %s, expected %s" % [to, target.stage, NEXT_STAGE[sp.stage]])
		for e in Evolution.validate_reqs(branch.get("reqs", {})):
			errors.append("evolution %d: %s" % [i, e])
	var last = sp.evolutions[-1]
	if last is Dictionary and not (last.get("reqs", {}) as Dictionary).is_empty():
		errors.append("last evolution must have no reqs (fallback)")
	return errors


func _validate_egg(egg: EggDef) -> PackedStringArray:
	var errors := PackedStringArray()
	var baby := get_species(egg.baby_species)
	if baby == null:
		errors.append("baby species '%s' not found" % egg.baby_species)
	elif baby.stage != SlotState.BABY:
		errors.append("baby species '%s' is not a baby" % egg.baby_species)
	if egg.hatch_seconds <= 0.0:
		errors.append("hatch_seconds must be > 0")
	if egg.inherit_budget < 0:
		errors.append("inherit_budget must be >= 0")
	return errors
