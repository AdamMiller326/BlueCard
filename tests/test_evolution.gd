extends GutTest

const BRANCHES := [
	{"to": "best", "reqs": {"careMistakes": "<=0", "effort": ">=3"}},
	{"to": "good", "reqs": {"careMistakes": "<=2"}},
	{"to": "fallback", "reqs": {}},
]


func test_first_matching_branch_wins() -> void:
	# Meets both "best" and "good"; the earlier one wins.
	assert_eq(Evolution.pick(BRANCHES, {"careMistakes": 0, "effort": 3}), "best")
	assert_eq(Evolution.pick(BRANCHES, {"careMistakes": 0, "effort": 1}), "good")
	assert_eq(Evolution.pick(BRANCHES, {"careMistakes": 2, "effort": 9}), "good")


func test_fallback_always_matches() -> void:
	assert_eq(Evolution.pick(BRANCHES, {"careMistakes": 99, "effort": 0}), "fallback")
	assert_eq(Evolution.pick(BRANCHES, {}), "fallback")


func test_operators() -> void:
	assert_true(Evolution.compare(1.0, "<=1"))
	assert_false(Evolution.compare(2.0, "<=1"))
	assert_true(Evolution.compare(3.0, ">=3"))
	assert_true(Evolution.compare(1.0, "<2"))
	assert_false(Evolution.compare(2.0, "<2"))
	assert_true(Evolution.compare(1.0, ">0"))
	assert_true(Evolution.compare(0.0, "==0"))
	assert_true(Evolution.compare(1.0, "!=0"))
	assert_true(Evolution.compare(4.0, "4"))
	assert_true(Evolution.compare(4.0, 4))
	assert_true(Evolution.compare(2.0, " <= 2 "))


func test_bad_expression_never_matches() -> void:
	assert_false(Evolution.compare(1.0, "about 1"))
	assert_false(Evolution.compare(1.0, "<="))
	assert_false(Evolution.parse("=>1")["ok"])


func test_missing_counter_fails_requirement() -> void:
	assert_false(Evolution.meets({"weight": "<=10"}, {"careMistakes": 0}))


func test_validate_reqs_rejects_unknown_keys_and_bad_values() -> void:
	assert_eq(Evolution.validate_reqs({"careMistakes": "<=1", "effort": 2}).size(), 0)
	assert_eq(Evolution.validate_reqs({"bossCleared": true}).size(), 1)
	assert_eq(Evolution.validate_reqs({"effort": "lots"}).size(), 1)
	assert_eq(Evolution.validate_reqs([]).size(), 1)
