extends GutTest
## Baby window opens at 360 and its grace closes at 660 (see test_nursery_care.gd).

const H := preload("res://tests/helpers.gd")

var cat: Catalog


func before_each() -> void:
	cat = H.catalog()


func test_deadline_outside_battle_closes_on_time() -> void:
	var st := H.state_with_egg(cat)
	var events := H.run(st, cat, 660)
	var m := H.mistakes(events)
	assert_eq(m.size(), 1)
	assert_eq(m[0]["t"], 660.0)


func test_deadline_inside_battle_is_extended_past_battle_end() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 400)
	NurseryLogic.set_in_battle(st, true)
	var events := H.run(st, cat, 300)  # to 700, past the 660 close
	assert_eq(H.mistakes(events).size(), 0, "no mistake during a fight")
	assert_eq(st.slots[0].stage, SlotState.CHILD, "the nursery still ages during fights")
	NurseryLogic.set_in_battle(st, false)
	var buffer := int(Tuning.BATTLE_GRACE_BUFFER_SECONDS)
	events = H.run(st, cat, buffer - 1)
	assert_eq(H.mistakes(events).size(), 0, "buffer after the fight")
	events = H.run(st, cat, 1)
	assert_eq(H.mistakes(events, "hunger").size(), 1)
	assert_eq(H.mistakes(events)[0]["t"], 700.0 + buffer)


func test_feeding_in_battle_buffer_avoids_mistake() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 400)
	NurseryLogic.set_in_battle(st, true)
	H.run(st, cat, 300)
	NurseryLogic.set_in_battle(st, false)
	H.run(st, cat, 2)
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "fed")
	var events := H.run(st, cat, 30)
	assert_eq(H.mistakes(events, "hunger").size(), 0)


func test_deadline_after_battle_is_not_moved() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 370)  # window open, closes at 660
	NurseryLogic.set_in_battle(st, true)
	H.run(st, cat, 30)
	NurseryLogic.set_in_battle(st, false)
	assert_eq(st.slots[0].deadlines[0]["close_at"], 660.0)


func test_no_care_during_battle() -> void:
	var st := H.state_with_egg(cat)
	H.run(st, cat, 400)
	NurseryLogic.set_in_battle(st, true)
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "rejected")
	assert_eq(NurseryLogic.clean(st, cat, 0)[0]["type"], "rejected")
	NurseryLogic.set_in_battle(st, false)
	assert_eq(NurseryLogic.feed(st, cat, 0)[0]["type"], "fed")


func test_set_in_battle_is_idempotent() -> void:
	var st := H.state_with_egg(cat)
	assert_eq(NurseryLogic.set_in_battle(st, true).size(), 1)
	assert_eq(NurseryLogic.set_in_battle(st, true).size(), 0)
	assert_eq(NurseryLogic.set_in_battle(st, false).size(), 1)
	assert_eq(NurseryLogic.set_in_battle(st, false).size(), 0)
