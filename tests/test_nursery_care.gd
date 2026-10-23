extends GutTest
## Care loop with the shipped data. Timeline for an egg placed at t=0:
##   hatch 60 -> Punimon (Baby, windows every 300: 360)
##   660 -> Tsunomon (Child, windows every 900: 660, 1560*, 2460, 3360*; * = strength check)
##   4260 -> Gabumon (good care) or Numemon (poor care)
## Grace is 300 s after each window opens.

const H := preload("res://tests/helpers.gd")

var cat: Catalog


func before_each() -> void:
	cat = H.catalog()


func test_stages_follow_played_time() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, 59)
	assert_eq(st.slots[0].stage, SlotState.EGG)
	events = H.run(st, cat, 1)
	assert_eq(H.of_type(events, "hatched").size(), 1)
	assert_eq(st.slots[0].species_id, "punimon")
	H.run(st, cat, 600)
	assert_eq(st.slots[0].species_id, "tsunomon")
	assert_eq(st.slots[0].stage, SlotState.CHILD)
	H.run(st, cat, 3600)
	assert_eq(st.slots[0].stage, SlotState.ROOKIE)


func test_perfect_care_gives_good_rookie_perfect_quality() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), H.perfect_care)
	var s := st.slots[0]
	assert_eq(H.mistakes(events).size(), 0, "no mistakes")
	assert_eq(s.stage, SlotState.ROOKIE)
	assert_eq(s.species_id, "gabumon")
	assert_eq(s.quality, Tuning.QUALITY_PERFECT)
	assert_eq(s.rookie["bonus_cards"], 1)
	assert_gt(s.rookie["max_hp_bonus"], 0)
	assert_eq(H.of_type(events, "ready").size(), 1)


func test_one_missed_feed_is_one_mistake_and_still_evolves() -> void:
	var st := H.state_with_egg(cat)
	var skip := {"open_at": -1.0}
	var care := func(s: NurseryState, c: Catalog, events: Array) -> Array:
		for ev in events:
			if ev["type"] == "hungry" and s.slots[0].stage == SlotState.CHILD and skip["open_at"] < 0.0:
				skip["open_at"] = ev["t"]
		var slot := s.slots[0]
		var w := CareSchedule.oldest_unfed(slot)
		if w >= 0 and slot.deadlines[w]["open_at"] != skip["open_at"]:
			NurseryLogic.feed(s, c, 0)
		if NurseryLogic.can_clean(s, 0):
			NurseryLogic.clean(s, c, 0)
		if NurseryLogic.can_train(s, 0):
			NurseryLogic.train(s, c, 0)
		return []
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), care)
	var s := st.slots[0]
	assert_eq(H.mistakes(events).size(), 1)
	assert_eq(H.mistakes(events, "hunger").size(), 1)
	assert_eq(s.mistakes[SlotState.CHILD], 1)
	assert_eq(s.species_id, "gabumon", "1 mistake is within the good branch")
	assert_eq(s.quality, Tuning.QUALITY_GOOD)


func test_no_care_still_reaches_rookie_with_poor_branch() -> void:
	# No death in the nursery: neglect only changes the outcome.
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE))
	var s := st.slots[0]
	assert_eq(s.stage, SlotState.ROOKIE)
	assert_eq(s.species_id, "numemon")
	assert_eq(s.quality, Tuning.QUALITY_ROUGH)
	assert_eq(s.rookie["bonus_cards"], 0)
	assert_eq(s.rookie["max_hp_bonus"], 0)
	assert_eq(s.mistakes[SlotState.BABY], 1, "baby: one missed feed")
	# child: 4 missed feeds, 2 strength checks, 1 poop cap (no cleaning, so only once)
	assert_eq(H.mistakes(events, "strength").size(), 2)
	assert_eq(H.mistakes(events, "poop").size(), 1)
	assert_eq(s.mistakes[SlotState.CHILD], 7)


func test_mistakes_are_counted_per_stage() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 700)  # baby window at 360 closes unfed at 660, then child starts
	assert_eq(st.slots[0].mistakes[SlotState.BABY], 1)
	assert_eq(st.slots[0].mistakes[SlotState.CHILD], 0)


func test_feeding_and_cleaning_without_training_misses_strength() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), H.feed_and_clean)
	assert_eq(H.mistakes(events, "strength").size(), 2)
	assert_eq(H.mistakes(events, "hunger").size(), 0)
	assert_eq(st.slots[0].species_id, "numemon", "no effort")


func test_one_training_per_check_fills_strength() -> void:
	var st := H.state_with_egg(cat)
	var care := func(s: NurseryState, c: Catalog, events: Array) -> Array:
		H.feed_and_clean(s, c, events)
		if CareSchedule.strength_check_close(s.slots[0]) >= 0.0 and not s.slots[0].strength_filled:
			NurseryLogic.train(s, c, 0)
		return []
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), care)
	assert_eq(H.mistakes(events).size(), 0)
	assert_eq(st.slots[0].trainings, 2)


func test_strength_checks_are_child_only_and_every_other_window() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE))
	var checks := H.of_type(events, "hungry").filter(func(e): return e["strength_check"])
	assert_eq(checks.map(func(e): return e["t"]), [1560.0, 3360.0])


func test_protein_fills_strength_and_adds_weight() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 1560, H.feed_and_clean)  # strength window just opened
	var s := st.slots[0]
	var before := s.weight
	var events := NurseryLogic.protein(st, cat, 0)
	assert_eq(events[0]["type"], "protein")
	assert_eq(s.weight, before + Tuning.WEIGHT_PER_PROTEIN)
	events = H.run(st, cat, 400, H.feed_and_clean)
	assert_eq(H.mistakes(events).size(), 0)


func test_protein_and_training_are_child_only() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 100)  # baby
	assert_eq(NurseryLogic.protein(st, cat, 0)[0]["type"], "rejected")
	assert_eq(NurseryLogic.train(st, cat, 0)[0]["type"], "rejected")


func test_training_cooldown_and_effort() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 700)
	var s := st.slots[0]
	assert_eq(NurseryLogic.train(st, cat, 0)[0]["type"], "trained")
	assert_eq(NurseryLogic.train(st, cat, 0)[0]["type"], "rejected", "cooldown")
	var effort_events: Array = []
	for _i in 3:
		H.run(st, cat, int(Tuning.TRAIN_COOLDOWN_SECONDS))
		effort_events.append_array(H.of_type(NurseryLogic.train(st, cat, 0), "effort"))
	assert_eq(s.trainings, 4)
	assert_eq(s.effort(), 1)
	assert_eq(effort_events.size(), 1)


func test_effort_is_capped() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 700)
	var effort_events: Array = []
	for _i in 40:
		effort_events.append_array(H.of_type(NurseryLogic.train(st, cat, 0), "effort"))
		H.run(st, cat, int(Tuning.TRAIN_COOLDOWN_SECONDS))
	assert_eq(st.slots[0].trainings, 40)
	assert_eq(st.slots[0].effort(), Tuning.EFFORT_MAX)
	assert_eq(effort_events.size(), Tuning.EFFORT_MAX)


func test_training_never_drops_below_base_weight() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 700)
	var s := st.slots[0]
	NurseryLogic.protein(st, cat, 0)  # base + 2
	for _i in 5:
		NurseryLogic.train(st, cat, 0)
		H.run(st, cat, int(Tuning.TRAIN_COOLDOWN_SECONDS))
	assert_eq(s.weight, cat.get_species("tsunomon").base_weight)


func test_overfeeding_adds_weight_and_keeps_schedule() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 100)
	var s := st.slots[0]
	var next := s.next_window_at
	var w := s.weight
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "overfed")
	assert_eq(s.weight, w + Tuning.WEIGHT_PER_OVERFEED)
	assert_eq(s.overfeeds, 1)
	assert_eq(s.next_window_at, next)


func test_weight_is_capped() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 100)
	for _i in 200:
		NurseryLogic.feed(st, cat, 0)
	assert_eq(st.slots[0].weight, Tuning.WEIGHT_MAX)


func test_hearts_are_a_view_of_the_schedule() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 60)
	var s := st.slots[0]
	assert_eq(CareSchedule.hearts(s, st.time), Tuning.HEARTS_MAX)
	assert_eq(CareSchedule.seconds_to_hungry(s, st.time), 300.0)
	H.run(st, cat, 299)
	assert_eq(CareSchedule.hearts(s, st.time), 1)
	H.run(st, cat, 1)
	assert_true(CareSchedule.is_hungry(s))
	assert_eq(CareSchedule.hearts(s, st.time), 0)
	assert_eq(CareSchedule.grace_left(s, st.time), Tuning.GRACE_SECONDS)
	NurseryLogic.feed(st, cat, 0)
	assert_false(CareSchedule.is_hungry(s))
	assert_eq(CareSchedule.hearts(s, st.time), Tuning.HEARTS_MAX)


func test_feeding_inside_grace_is_fine() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 360 + 299)  # one second of grace left
	NurseryLogic.feed(st, cat, 0)
	var events := H.run(st, cat, 10)
	assert_eq(H.mistakes(events).size(), 0)


func test_poop_never_hits_cap_when_cleaned_every_window() -> void:
	var st := H.state_with_egg(cat)
	var care := func(s: NurseryState, c: Catalog, events: Array) -> Array:
		H.perfect_care_feed_only(s, c)
		for ev in events:
			if ev["type"] == "hungry":
				NurseryLogic.clean(s, c, 0)
		return []
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), care)
	assert_gt(H.of_type(events, "pooped").size(), 0)
	assert_eq(H.mistakes(events, "poop").size(), 0)


func test_one_missed_clean_on_four_poop_line_hits_cap() -> void:
	var st := H.state_with_egg(cat)
	var care := func(s: NurseryState, c: Catalog, events: Array) -> Array:
		H.perfect_care_feed_only(s, c)
		for ev in events:
			if ev["type"] == "hungry" and ev["t"] != 1560.0:
				NurseryLogic.clean(s, c, 0)
		return []
	var events := H.run(st, cat, int(H.EGG_TO_ROOKIE), care)
	var poop := H.mistakes(events, "poop")
	assert_eq(poop.size(), 1)
	assert_eq(poop[0]["stage"], SlotState.CHILD)


func test_poop_is_deterministic_and_spread_evenly() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, 1560)
	var times := H.of_type(events, "pooped").map(func(e): return e["t"])
	# Baby gaps 60-360, 360-660 (2 each), child gap 660-1560 (4, last is jumbo).
	assert_eq(times, [160.0, 260.0, 460.0, 560.0, 840.0, 1020.0, 1200.0, 1380.0])
	assert_eq(H.of_type(events, "pooped")[-1]["jumbo"], true)


func test_poop_cap_mistake_only_once_until_cleaned() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, 2460)
	assert_eq(H.mistakes(events, "poop").size(), 1)
	NurseryLogic.feed(st, cat, 0)
	NurseryLogic.clean(st, cat, 0)
	assert_eq(CareSchedule.poop_points(st.slots[0]), 0)
	events = H.run(st, cat, 900)  # one more gap: 5 points, under the cap
	assert_eq(H.mistakes(events, "poop").size(), 0)


func test_care_needs_a_raising_mon() -> void:
	var st := NurseryState.new()
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "rejected", "empty")
	NurseryLogic.add_egg(st, cat, 0)
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "rejected", "egg")
	assert_eq(NurseryLogic.add_egg(st, cat, 0)[0]["type"], "rejected", "slot taken")
	H.run(st, cat, int(H.EGG_TO_ROOKIE))
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "rejected", "rookie")


func test_ready_rookie_is_frozen() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, int(H.EGG_TO_ROOKIE))
	var before := st.slots[0].to_dict()
	var events := NurseryLogic.advance(st, cat, 100000.0)
	assert_eq(events.size(), 0)
	assert_eq(st.slots[0].to_dict(), before)


func test_send_to_run_hands_off_rookie_and_empties_slot() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, int(H.EGG_TO_ROOKIE), H.perfect_care)
	var events := NurseryLogic.send_to_run(st, cat, 0)
	assert_eq(events[0]["type"], "sent")
	var rookie := Rookie.from_dict(events[0]["rookie"])
	assert_eq(rookie.species_id, "gabumon")
	assert_eq(rookie.quality, Tuning.QUALITY_PERFECT)
	assert_eq(rookie.inherited_cards.size(), 0)
	assert_true(st.slots[0].is_empty())


func test_default_starter_has_no_bonus() -> void:
	var r := Rookie.default_starter("gabumon")
	assert_eq(r.quality, Tuning.QUALITY_NONE)
	assert_eq(r.bonus_cards, 0)
	assert_eq(r.max_hp_bonus, 0)


func test_two_slots_are_independent() -> void:
	var st := H.state_with_egg(cat, 0)
	H.run(st, cat, 500)
	NurseryLogic.add_egg(st, cat, 1)
	H.run(st, cat, int(H.EGG_TO_ROOKIE) - 500)
	assert_eq(st.slots[0].stage, SlotState.ROOKIE)
	assert_eq(st.slots[1].stage, SlotState.CHILD)
	H.run(st, cat, 500)
	assert_eq(st.slots[1].stage, SlotState.ROOKIE)


func test_force_next_stage() -> void:
	var st := H.state_with_egg(cat)
	assert_eq(H.of_type(NurseryLogic.force_next_stage(st, cat, 0), "hatched").size(), 1)
	assert_eq(st.slots[0].stage, SlotState.BABY)
	NurseryLogic.force_next_stage(st, cat, 0)
	assert_eq(st.slots[0].stage, SlotState.CHILD)
	NurseryLogic.force_next_stage(st, cat, 0)
	assert_eq(st.slots[0].stage, SlotState.ROOKIE)
	assert_eq(NurseryLogic.force_next_stage(st, cat, 0).size(), 0)
