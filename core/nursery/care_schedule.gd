class_name CareSchedule
extends RefCounted
## Read-only views of a slot's schedule: poop times, hearts, timers.
## NurseryLogic uses the same functions, so the UI and the rules agree.


static func poop_points(slot: SlotState) -> int:
	return slot.poop_normal * Tuning.POOP_POINTS_NORMAL + slot.poop_jumbo * Tuning.POOP_POINTS_JUMBO


## Time of the j-th poop (1-based) in the current gap. Poops are spread evenly
## and never land on a window.
static func poop_time(slot: SlotState, j: int) -> float:
	var gap := slot.next_window_at - slot.gap_start
	return slot.gap_start + gap * float(j) / float(slot.gap_poops + 1)


## -1.0 when this gap has no poops left.
static func next_poop_at(slot: SlotState) -> float:
	if slot.gap_poops_done >= slot.gap_poops:
		return -1.0
	return poop_time(slot, slot.gap_poops_done + 1)


static func next_poop_is_jumbo(slot: SlotState) -> bool:
	return slot.gap_jumbo and slot.gap_poops_done + 1 == slot.gap_poops


## Index of the unfed window that closes first, or -1.
static func oldest_unfed(slot: SlotState) -> int:
	var best := -1
	for i in slot.deadlines.size():
		var d: Dictionary = slot.deadlines[i]
		if d["fed"]:
			continue
		if best < 0 or d["close_at"] < slot.deadlines[best]["close_at"]:
			best = i
	return best


static func is_hungry(slot: SlotState) -> bool:
	return oldest_unfed(slot) >= 0


## Hearts are a view of the schedule: full at the start of a gap, empty at the
## next window.
static func hearts(slot: SlotState, now: float) -> int:
	if not slot.is_raising() or is_hungry(slot):
		return 0
	var gap := slot.next_window_at - slot.gap_start
	if gap <= 0.0:
		return 0
	var left := (slot.next_window_at - now) / gap
	return clampi(ceili(Tuning.HEARTS_MAX * left), 0, Tuning.HEARTS_MAX)


## Seconds until hearts hit empty, or -1.0 if not raising.
static func seconds_to_hungry(slot: SlotState, now: float) -> float:
	if not slot.is_raising():
		return -1.0
	return maxf(slot.next_window_at - now, 0.0)


## Seconds left to feed the hungriest window, or -1.0 if not hungry.
## Can be 0 while a battle is holding the window open.
static func grace_left(slot: SlotState, now: float) -> float:
	var i := oldest_unfed(slot)
	if i < 0:
		return -1.0
	return maxf(slot.deadlines[i]["close_at"] - now, 0.0)


## Close time of the open strength check, or -1.0.
static func strength_check_close(slot: SlotState) -> float:
	for d in slot.deadlines:
		if d["strength"]:
			return d["close_at"]
	return -1.0


## Absolute time the next strength window opens, or -1.0 if this stage has none
## left before it ends.
static func next_strength_window(slot: SlotState, sp: SpeciesDef) -> float:
	if sp == null or sp.strength_every <= 0 or not slot.is_raising():
		return -1.0
	var t := slot.next_window_at
	var index := slot.window_index + 1
	while t < slot.stage_end:
		if index % sp.strength_every == 0:
			return t
		t += sp.hunger_interval
		index += 1
	return -1.0


## Upcoming scheduled things for the debug overlay: [{t, what}] sorted by time.
static func upcoming(slot: SlotState, sp: SpeciesDef) -> Array:
	var items: Array = []
	match slot.stage:
		SlotState.EGG:
			items.append({"t": slot.stage_end, "what": "hatch"})
		SlotState.BABY, SlotState.CHILD:
			items.append({"t": slot.stage_end, "what": "evolve"})
			if slot.next_window_at < slot.stage_end:
				items.append({"t": slot.next_window_at, "what": "hungry"})
			var strength_at := next_strength_window(slot, sp)
			if strength_at >= 0.0:
				items.append({"t": strength_at, "what": "strength check opens"})
			for j in range(slot.gap_poops_done + 1, slot.gap_poops + 1):
				var jumbo := slot.gap_jumbo and j == slot.gap_poops
				items.append({"t": poop_time(slot, j), "what": "jumbo poop" if jumbo else "poop"})
			for d in slot.deadlines:
				var what := "grace closes"
				if d["fed"]:
					what = "window ends (fed)"
				if d["strength"]:
					what += " + strength check"
				items.append({"t": d["close_at"], "what": what})
	items.sort_custom(func(a, b): return a["t"] < b["t"])
	return items
