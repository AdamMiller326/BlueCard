class_name NurseryLogic
extends RefCounted
## Nursery rules (docs/nursery.md). Static functions that change a NurseryState
## in place and return events for the UI: [{type, slot, t, ...}].
##
## advance() handles scheduled things strictly in time order, so one big step
## gives the same state as many small ones. Runs call these same functions.

## Order for events at the same instant. A window closing at a stage boundary
## belongs to the old stage; a window opening there belongs to the new one.
enum Kind { CLOSE, POOP, STAGE_END, OPEN }

const _MAX_EVENTS_PER_ADVANCE := 1000000


# --- Time ---------------------------------------------------------------------

static func advance(state: NurseryState, catalog: Catalog, played_seconds: float) -> Array:
	var events: Array = []
	var target := state.time + maxf(played_seconds, 0.0)
	var guard := 0
	while guard < _MAX_EVENTS_PER_ADVANCE:
		guard += 1
		var next := _next_event(state)
		if next.is_empty() or next["t"] > target:
			break
		state.time = maxf(state.time, next["t"])
		_apply(state, catalog, next, events)
	if guard >= _MAX_EVENTS_PER_ADVANCE:
		push_error("NurseryLogic.advance: event limit hit; schedule is not moving forward")
	state.time = target
	return events


## Runs tell the nursery when a fight starts and ends. While in battle no grace
## window closes; any that would have closed get until battle end + a buffer.
static func set_in_battle(state: NurseryState, in_battle: bool) -> Array:
	if state.in_battle == in_battle:
		return []
	state.in_battle = in_battle
	if not in_battle:
		var extend_to := state.time + Tuning.BATTLE_GRACE_BUFFER_SECONDS
		for s in state.slots:
			for d in s.deadlines:
				if d["close_at"] <= state.time:
					d["close_at"] = extend_to
	return [_event("battle_started" if in_battle else "battle_ended", -1, state.time)]


# --- Player actions -----------------------------------------------------------

static func can_care(state: NurseryState, i: int) -> bool:
	return not state.in_battle and state.slots[i].is_raising()


static func can_feed(state: NurseryState, i: int) -> bool:
	return can_care(state, i)


static func can_protein(state: NurseryState, i: int) -> bool:
	return can_care(state, i) and state.slots[i].stage == SlotState.CHILD


static func can_train(state: NurseryState, i: int) -> bool:
	if not can_protein(state, i):
		return false
	var last := state.slots[i].last_train_at
	return last < 0.0 or state.time - last >= Tuning.TRAIN_COOLDOWN_SECONDS


static func can_clean(state: NurseryState, i: int) -> bool:
	return can_care(state, i) and CareSchedule.poop_points(state.slots[i]) > 0


static func can_add_egg(state: NurseryState, i: int) -> bool:
	return state.slots[i].is_empty()


static func can_send(state: NurseryState, i: int) -> bool:
	return not state.in_battle and state.slots[i].stage == SlotState.ROOKIE


## Feeding an open window satisfies it. Feeding with no open window is
## overfeeding: it adds weight and doesn't move the schedule.
static func feed(state: NurseryState, _catalog: Catalog, i: int) -> Array:
	if not can_feed(state, i):
		return [_rejected(state, i, "feed")]
	var s := state.slots[i]
	var w := CareSchedule.oldest_unfed(s)
	if w >= 0:
		s.deadlines[w]["fed"] = true
		return [_event("fed", i, state.time)]
	s.overfeeds += 1
	_add_weight(s, Tuning.WEIGHT_PER_OVERFEED)
	return [_event("overfed", i, state.time, {"weight": s.weight})]


## Fills strength instantly, adds weight. Child only.
static func protein(state: NurseryState, _catalog: Catalog, i: int) -> Array:
	if not can_protein(state, i):
		return [_rejected(state, i, "protein")]
	var s := state.slots[i]
	s.strength_filled = true
	s.proteins += 1
	_add_weight(s, Tuning.WEIGHT_PER_PROTEIN)
	return [_event("protein", i, state.time, {"weight": s.weight})]


## Fills strength and counts toward effort. Child only, with a cooldown.
static func train(state: NurseryState, catalog: Catalog, i: int) -> Array:
	if not can_train(state, i):
		return [_rejected(state, i, "train")]
	var s := state.slots[i]
	s.strength_filled = true
	s.trainings += 1
	s.last_train_at = state.time
	var floor_weight := catalog.get_species(s.species_id).base_weight
	if s.weight > floor_weight:
		_add_weight(s, maxi(Tuning.WEIGHT_PER_TRAINING, floor_weight - s.weight))
	var events := [_event("trained", i, state.time, {"trainings": s.trainings})]
	if s.trainings % Tuning.TRAININGS_PER_EFFORT == 0 \
			and s.trainings <= Tuning.EFFORT_MAX * Tuning.TRAININGS_PER_EFFORT:
		events.append(_event("effort", i, state.time, {"effort": s.effort()}))
	return events


static func clean(state: NurseryState, _catalog: Catalog, i: int) -> Array:
	if not can_clean(state, i):
		return [_rejected(state, i, "clean")]
	var s := state.slots[i]
	s.poop_normal = 0
	s.poop_jumbo = 0
	s.poop_mistake_given = false
	return [_event("cleaned", i, state.time)]


## Puts an egg in an empty slot. Defaults to the free basic egg.
static func add_egg(state: NurseryState, catalog: Catalog, i: int, egg_id: String = "") -> Array:
	if egg_id.is_empty():
		egg_id = catalog.basic_egg_id
	var egg := catalog.get_egg(egg_id)
	if egg == null or not can_add_egg(state, i):
		return [_rejected(state, i, "add_egg")]
	var s := SlotState.new()
	s.stage = SlotState.EGG
	s.egg_id = egg_id
	s.stage_start = state.time
	s.stage_end = state.time + egg.hatch_seconds
	state.slots[i] = s
	return [_event("egg_added", i, state.time, {"egg": egg_id})]


## Hands the Rookie to a run and empties the slot. The event carries the record.
static func send_to_run(state: NurseryState, _catalog: Catalog, i: int) -> Array:
	if not can_send(state, i):
		return [_rejected(state, i, "send")]
	var rookie := state.slots[i].rookie.duplicate(true)
	state.slots[i] = SlotState.new()
	return [_event("sent", i, state.time, {"rookie": rookie})]


## Empties a slot, giving nothing back. Debug only for now (open question).
static func discard(state: NurseryState, _catalog: Catalog, i: int) -> Array:
	if state.slots[i].is_empty():
		return []
	state.slots[i] = SlotState.new()
	return [_event("discarded", i, state.time)]


## Debug: end the current stage now.
static func force_next_stage(state: NurseryState, catalog: Catalog, i: int) -> Array:
	var s := state.slots[i]
	if s.stage != SlotState.EGG and not s.is_raising():
		return []
	s.stage_end = state.time
	return advance(state, catalog, 0.0)


# --- Scheduled events ---------------------------------------------------------

static func _next_event(state: NurseryState) -> Dictionary:
	var best := {}
	for i in state.slots.size():
		var s := state.slots[i]
		match s.stage:
			SlotState.EGG:
				best = _earlier(best, s.stage_end, Kind.STAGE_END, i, -1)
			SlotState.BABY, SlotState.CHILD:
				if not state.in_battle:
					for d_i in s.deadlines.size():
						best = _earlier(best, s.deadlines[d_i]["close_at"], Kind.CLOSE, i, d_i)
				var poop_at := CareSchedule.next_poop_at(s)
				if poop_at >= 0.0:
					best = _earlier(best, poop_at, Kind.POOP, i, -1)
				best = _earlier(best, s.stage_end, Kind.STAGE_END, i, -1)
				best = _earlier(best, s.next_window_at, Kind.OPEN, i, -1)
	return best


static func _earlier(best: Dictionary, t: float, kind: int, slot: int, index: int) -> Dictionary:
	if best.is_empty() or t < best["t"] or (t == best["t"] and kind < best["kind"]):
		return {"t": t, "kind": kind, "slot": slot, "index": index}
	return best


static func _apply(state: NurseryState, catalog: Catalog, ev: Dictionary, events: Array) -> void:
	var i: int = ev["slot"]
	var s := state.slots[i]
	match ev["kind"]:
		Kind.CLOSE:
			_close_window(s, i, ev["index"], state.time, events)
		Kind.POOP:
			_poop(s, i, state.time, events)
		Kind.OPEN:
			_open_window(s, catalog, i, state.time, events)
		Kind.STAGE_END:
			if s.stage == SlotState.EGG:
				_hatch(s, catalog, i, events)
			else:
				_evolve(s, catalog, i, events)


static func _open_window(s: SlotState, catalog: Catalog, i: int, t: float, events: Array) -> void:
	var sp := catalog.get_species(s.species_id)
	s.window_index += 1
	var strength := sp.strength_every > 0 and s.window_index % sp.strength_every == 0
	s.deadlines.append({
		"open_at": t,
		"close_at": t + Tuning.GRACE_SECONDS,
		"fed": false,
		"strength": strength,
	})
	_start_gap(s, sp, t)
	events.append(_event("hungry", i, t, {"strength_check": strength}))


static func _close_window(s: SlotState, i: int, index: int, t: float, events: Array) -> void:
	var d: Dictionary = s.deadlines[index]
	s.deadlines.remove_at(index)
	if not d["fed"]:
		_mistake(s, i, t, "hunger", events)
	if d["strength"]:
		if not s.strength_filled:
			_mistake(s, i, t, "strength", events)
		s.strength_filled = false


static func _poop(s: SlotState, i: int, t: float, events: Array) -> void:
	var jumbo := CareSchedule.next_poop_is_jumbo(s)
	s.gap_poops_done += 1
	if jumbo:
		s.poop_jumbo += 1
	else:
		s.poop_normal += 1
	events.append(_event("pooped", i, t, {"jumbo": jumbo}))
	if CareSchedule.poop_points(s) >= Tuning.POOP_CAP and not s.poop_mistake_given:
		s.poop_mistake_given = true
		_mistake(s, i, t, "poop", events)


static func _hatch(s: SlotState, catalog: Catalog, i: int, events: Array) -> void:
	var t := s.stage_end
	var sp := catalog.get_species(catalog.get_egg(s.egg_id).baby_species)
	s.species_id = sp.id
	s.stage = SlotState.BABY
	s.stage_start = t
	s.stage_end = t + sp.stage_seconds
	s.weight = sp.base_weight
	s.window_index = 0
	_start_gap(s, sp, t)
	events.append(_event("hatched", i, t, {"species": sp.id}))


static func _evolve(s: SlotState, catalog: Catalog, i: int, events: Array) -> void:
	var t := s.stage_end
	var sp := catalog.get_species(s.species_id)
	var to := Evolution.pick(sp.evolutions, _counters(s))
	var next := catalog.get_species(to)
	_add_weight(s, next.base_weight - sp.base_weight)
	s.species_id = next.id
	s.stage = next.stage
	s.stage_start = t
	s.window_index = 0
	events.append(_event("evolved", i, t, {"from": sp.id, "species": next.id}))
	if next.stage != SlotState.ROOKIE:
		s.stage_end = t + next.stage_seconds
		return
	# Ready Rookies are frozen: no schedule, no needs.
	s.stage_end = -1.0
	s.next_window_at = -1.0
	s.deadlines.clear()
	s.gap_poops = 0
	s.gap_poops_done = 0
	s.poop_normal = 0
	s.poop_jumbo = 0
	s.poop_mistake_given = false
	s.strength_filled = false
	var rookie := Rookie.from_slot(s)
	s.quality = rookie.quality
	s.rookie = rookie.to_dict()
	events.append(_event("ready", i, t, {"species": next.id, "quality": s.quality}))


## A gap runs from one window opening to the next. Its poop count is fixed at
## the start so poop times never shift.
static func _start_gap(s: SlotState, sp: SpeciesDef, t: float) -> void:
	s.gap_start = t
	s.next_window_at = t + sp.hunger_interval
	s.gap_poops = sp.poop_per_gap
	s.gap_jumbo = sp.jumbo_per_gap
	s.gap_poops_done = 0


static func _counters(s: SlotState) -> Dictionary:
	return {
		"careMistakes": int(s.mistakes.get(s.stage, 0)),
		"effort": s.effort(),
		"trainings": s.trainings,
		"overfeeds": s.overfeeds,
		"proteins": s.proteins,
		"weight": s.weight,
	}


static func _mistake(s: SlotState, i: int, t: float, reason: String, events: Array) -> void:
	s.mistakes[s.stage] = int(s.mistakes.get(s.stage, 0)) + 1
	events.append(_event("mistake", i, t, {"reason": reason, "stage": s.stage}))


static func _add_weight(s: SlotState, delta: int) -> void:
	s.weight = clampi(s.weight + delta, Tuning.WEIGHT_MIN, Tuning.WEIGHT_MAX)


static func _event(type: String, slot: int, t: float, extra: Dictionary = {}) -> Dictionary:
	var ev := {"type": type, "slot": slot, "t": t}
	ev.merge(extra)
	return ev


static func _rejected(state: NurseryState, i: int, action: String) -> Dictionary:
	return _event("rejected", i, state.time, {"action": action})
