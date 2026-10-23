extends GutTest

const H := preload("res://tests/helpers.gd")


func _valid_lists() -> Dictionary:
	return {
		"species": [
			H.species("baby", "baby", [{"to": "child", "reqs": {}}]),
			H.species("child", "child", [{"to": "rookie_a", "reqs": {"careMistakes": "<=1"}}, {"to": "rookie_b", "reqs": {}}]),
			H.species("rookie_a", "rookie"),
			H.species("rookie_b", "rookie"),
		],
		"eggs": [H.egg("egg", "baby")],
	}


func _errors(lists: Dictionary, basic_egg: String = "egg") -> PackedStringArray:
	return Catalog.from_lists(lists["species"], lists["eggs"], basic_egg).validate()


func _has_error(errors: PackedStringArray, fragment: String) -> bool:
	for e in errors:
		if fragment in e:
			return true
	return false


func test_shipped_catalog_is_valid() -> void:
	assert_eq(H.catalog().validate(), PackedStringArray())


func test_minimal_catalog_is_valid() -> void:
	assert_eq(_errors(_valid_lists()), PackedStringArray())


func test_missing_evolution_target() -> void:
	var lists := _valid_lists()
	lists["species"][0].evolutions = [{"to": "nobody", "reqs": {}}]
	assert_true(_has_error(_errors(lists), "evolution target 'nobody' not found"))


func test_evolution_target_wrong_stage() -> void:
	var lists := _valid_lists()
	lists["species"][0].evolutions = [{"to": "rookie_a", "reqs": {}}]
	assert_true(_has_error(_errors(lists), "expected child"))


func test_last_branch_must_be_fallback() -> void:
	var lists := _valid_lists()
	lists["species"][1].evolutions = [{"to": "rookie_a", "reqs": {"careMistakes": "<=1"}}]
	assert_true(_has_error(_errors(lists), "fallback"))


func test_unknown_requirement_key() -> void:
	var lists := _valid_lists()
	lists["species"][1].evolutions[0]["reqs"] = {"sleepDisturbances": "<=1"}
	assert_true(_has_error(_errors(lists), "unknown requirement 'sleepDisturbances'"))


func test_poop_per_gap_at_or_over_cap() -> void:
	var lists := _valid_lists()
	lists["species"][0].poop_per_gap = 7
	lists["species"][0].jumbo_per_gap = true  # 6 normal + 1 jumbo = 8 points
	assert_true(_has_error(_errors(lists), "under the cap"))
	lists["species"][0].jumbo_per_gap = false  # 7 points is fine
	assert_eq(_errors(lists), PackedStringArray())


func test_bad_durations() -> void:
	var lists := _valid_lists()
	lists["species"][0].stage_seconds = 0.0
	lists["species"][1].hunger_interval = -5.0
	var errors := _errors(lists)
	assert_true(_has_error(errors, "stage_seconds"))
	assert_true(_has_error(errors, "hunger_interval"))


func test_egg_with_missing_or_wrong_baby() -> void:
	var lists := _valid_lists()
	lists["eggs"] = [H.egg("egg", "ghost"), H.egg("egg2", "child")]
	var errors := _errors(lists)
	assert_true(_has_error(errors, "baby species 'ghost' not found"))
	assert_true(_has_error(errors, "'child' is not a baby"))


func test_missing_basic_egg_and_duplicates() -> void:
	var lists := _valid_lists()
	lists["species"].append(H.species("baby", "baby", [{"to": "child", "reqs": {}}]))
	var errors := _errors(lists, "golden_egg")
	assert_true(_has_error(errors, "basic egg 'golden_egg' not found"))
	assert_true(_has_error(errors, "duplicate species id 'baby'"))
