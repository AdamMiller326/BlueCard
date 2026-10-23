extends RefCounted
## Shared test helpers. Not a test script (no test_ prefix).

## Played seconds from placing the basic egg to Rookie: hatch 60 + Baby 600 + Child 3600.
const EGG_TO_ROOKIE := 4260.0


static func catalog() -> Catalog:
	return Catalog.from_def(load("res://data/catalog.tres"))


static func state_with_egg(cat: Catalog, slot: int = 0) -> NurseryState:
	var st := NurseryState.new()
	NurseryLogic.add_egg(st, cat, slot)
	return st


## Advances in 1 s steps, calling care.call(st, cat, events) after each step.
## Returns every event.
static func run(st: NurseryState, cat: Catalog, seconds: int, care: Callable = Callable()) -> Array:
	var all: Array = []
	for _i in seconds:
		var events := NurseryLogic.advance(st, cat, 1.0)
		all.append_array(events)
		if care.is_valid():
			all.append_array(care.call(st, cat, events))
	return all


## Feeds every window, cleans every poop, trains whenever the cooldown allows.
static func perfect_care(st: NurseryState, cat: Catalog, _events: Array) -> Array:
	var out: Array = []
	for i in st.slots.size():
		if CareSchedule.is_hungry(st.slots[i]):
			out.append_array(NurseryLogic.feed(st, cat, i))
		if NurseryLogic.can_clean(st, i):
			out.append_array(NurseryLogic.clean(st, cat, i))
		if NurseryLogic.can_train(st, i):
			out.append_array(NurseryLogic.train(st, cat, i))
	return out


## Feeds every window. Nothing else.
static func perfect_care_feed_only(st: NurseryState, cat: Catalog) -> void:
	for i in st.slots.size():
		if CareSchedule.is_hungry(st.slots[i]):
			NurseryLogic.feed(st, cat, i)


## Feeds and cleans, never trains.
static func feed_and_clean(st: NurseryState, cat: Catalog, _events: Array) -> Array:
	var out: Array = []
	for i in st.slots.size():
		if CareSchedule.is_hungry(st.slots[i]):
			out.append_array(NurseryLogic.feed(st, cat, i))
		if NurseryLogic.can_clean(st, i):
			out.append_array(NurseryLogic.clean(st, cat, i))
	return out


static func of_type(events: Array, type: String) -> Array:
	return events.filter(func(e): return e["type"] == type)


static func mistakes(events: Array, reason: String = "") -> Array:
	return events.filter(func(e): return e["type"] == "mistake" and (reason.is_empty() or e["reason"] == reason))


## A minimal valid species for validator tests.
static func species(id: String, stage: String, evolutions: Array = []) -> SpeciesDef:
	var sp := SpeciesDef.new()
	sp.id = id
	sp.display_name = id
	sp.stage = stage
	if stage != SlotState.ROOKIE:
		sp.stage_seconds = 600.0
		sp.hunger_interval = 300.0
		sp.poop_per_gap = 2
	sp.evolutions = evolutions
	return sp


static func egg(id: String, baby: String) -> EggDef:
	var e := EggDef.new()
	e.id = id
	e.baby_species = baby
	return e
