extends GutTest
## advance() must give the same state for any chunking of the same played time.

const H := preload("res://tests/helpers.gd")

var cat: Catalog


func before_each() -> void:
	cat = H.catalog()


func _two_eggs() -> NurseryState:
	var st := H.state_with_egg(cat, 0)
	NurseryLogic.add_egg(st, cat, 1)
	return st


func _step(st: NurseryState, seconds: float, chunk: float) -> Array:
	var events: Array = []
	var steps := int(round(seconds / chunk))
	for _i in steps:
		events.append_array(NurseryLogic.advance(st, cat, chunk))
	return events


func test_3600_in_one_call_equals_3600_calls_of_1s() -> void:
	var a := _two_eggs()
	var b := _two_eggs()
	var events_a := NurseryLogic.advance(a, cat, 3600.0)
	var events_b := _step(b, 3600.0, 1.0)
	assert_eq(a.to_dict(), b.to_dict())
	assert_eq(events_a, events_b)
	assert_gt(events_a.size(), 10, "the hour had things happen in it")


func test_full_raise_in_one_call_equals_small_steps() -> void:
	var a := _two_eggs()
	var b := _two_eggs()
	var c := _two_eggs()
	NurseryLogic.advance(a, cat, 5000.0)
	_step(b, 5000.0, 1.0)
	_step(c, 5000.0, 0.25)
	assert_eq(a.to_dict(), b.to_dict())
	assert_eq(a.to_dict(), c.to_dict())
	assert_eq(a.slots[0].stage, SlotState.ROOKIE)


func test_chunking_is_invariant_with_care_between_chunks() -> void:
	# Same actions at the same played times, different chunk sizes between them.
	var a := _two_eggs()
	var b := _two_eggs()
	for t in [400.0, 700.0, 1600.0, 2000.0, 2500.0]:
		NurseryLogic.advance(a, cat, t - a.time)
		_step(b, t - b.time, 0.5)
		for st in [a, b]:
			H.perfect_care(st, cat, [])
	assert_eq(a.to_dict(), b.to_dict())


func test_chunking_is_invariant_across_a_battle() -> void:
	var a := _two_eggs()
	var b := _two_eggs()
	NurseryLogic.advance(a, cat, 400.0)
	_step(b, 400.0, 1.0)
	for st in [a, b]:
		NurseryLogic.set_in_battle(st, true)
	NurseryLogic.advance(a, cat, 500.0)
	_step(b, 500.0, 1.0)
	for st in [a, b]:
		NurseryLogic.set_in_battle(st, false)
	NurseryLogic.advance(a, cat, 1000.0)
	_step(b, 1000.0, 1.0)
	assert_eq(a.to_dict(), b.to_dict())
