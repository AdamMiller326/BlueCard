extends GutTest

const H := preload("res://tests/helpers.gd")
const TEST_PATH := "user://test_save.json"

var cat: Catalog


func before_each() -> void:
	cat = H.catalog()


func after_each() -> void:
	if FileAccess.file_exists(TEST_PATH):
		DirAccess.remove_absolute(TEST_PATH)


## A state with something in every field: open windows, poop, a battle, a Rookie.
func _busy_state() -> NurseryState:
	var st := H.state_with_egg(cat, 0)
	H.run(st, cat, int(H.EGG_TO_ROOKIE), H.perfect_care)
	NurseryLogic.add_egg(st, cat, 1)
	H.run(st, cat, 1600)  # slot 1 in Child, hungry, poop on the floor
	NurseryLogic.train(st, cat, 1)
	NurseryLogic.feed(st, cat, 1)
	NurseryLogic.set_in_battle(st, true)
	H.run(st, cat, 3)
	return st


func test_round_trip_is_identical() -> void:
	var st := _busy_state()
	assert_gt(st.slots[1].deadlines.size(), 0)
	assert_gt(CareSchedule.poop_points(st.slots[1]), 0)
	var back := SaveSystem.decode(SaveSystem.encode(st))
	assert_not_null(back)
	assert_eq(back.to_dict(), st.to_dict())


func test_round_trip_keeps_behaving_the_same() -> void:
	var st := _busy_state()
	var back := SaveSystem.decode(SaveSystem.encode(st))
	NurseryLogic.set_in_battle(st, false)
	NurseryLogic.set_in_battle(back, false)
	var events_a := NurseryLogic.advance(st, cat, 3000.0)
	var events_b := NurseryLogic.advance(back, cat, 3000.0)
	assert_eq(events_a, events_b)
	assert_eq(back.to_dict(), st.to_dict())


func test_file_save_and_load() -> void:
	var st := _busy_state()
	assert_eq(SaveSystem.save(st, TEST_PATH), OK)
	var loaded := SaveSystem.load_state(TEST_PATH)
	assert_eq(loaded["error"], "")
	assert_eq(loaded["state"].to_dict(), st.to_dict())


func test_missing_file_is_not_an_error() -> void:
	var loaded := SaveSystem.load_state("user://does_not_exist.json")
	assert_null(loaded["state"])
	assert_eq(loaded["error"], "")


func test_save_has_version() -> void:
	var data = JSON.parse_string(SaveSystem.encode(NurseryState.new()))
	assert_eq(int(data["version"]), SaveSystem.VERSION)


func test_unreadable_saves_are_rejected() -> void:
	assert_null(SaveSystem.decode("not json"))
	assert_null(SaveSystem.decode("{}"), "no version")
	assert_null(SaveSystem.decode(JSON.stringify({"version": SaveSystem.VERSION + 1, "nursery": {}})), "newer build")


func test_migrations_run_in_order() -> void:
	var steps := {
		1: func(d: Dictionary) -> Dictionary:
			d["trail"] = d.get("trail", []) + ["1->2"]
			return d,
		2: func(d: Dictionary) -> Dictionary:
			d["trail"] = d.get("trail", []) + ["2->3"]
			return d,
	}
	var out := SaveSystem.migrate({"version": 1}, steps, 3)
	assert_eq(out["version"], 3)
	assert_eq(out["trail"], ["1->2", "2->3"])
	assert_eq(SaveSystem.migrate({"version": 0}, steps, 3), {}, "gap in migrations")
