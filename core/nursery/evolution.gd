class_name Evolution
extends RefCounted
## Evaluates evolution requirement dicts against counters. Shared with runs later.
##
## A requirement is {counter: expr}. expr is a number (equals) or a string
## "<=1", ">=3", "<2", ">0", "==0", "!=0". All requirements must hold.

## Counters the nursery provides. Anything else fails validation.
const VOCABULARY := ["careMistakes", "effort", "trainings", "overfeeds", "proteins", "weight"]

const _OPS := ["<=", ">=", "==", "!=", "<", ">"]


## Species id of the first branch whose reqs are met, or "" if none match.
static func pick(evolutions: Array, counters: Dictionary) -> String:
	for branch in evolutions:
		if meets(branch.get("reqs", {}), counters):
			return String(branch.get("to", ""))
	return ""


static func meets(reqs: Dictionary, counters: Dictionary) -> bool:
	for key in reqs:
		if not counters.has(key):
			return false
		if not compare(float(counters[key]), reqs[key]):
			return false
	return true


## {"ok": bool, "op": String, "value": float}
static func parse(expr: Variant) -> Dictionary:
	if expr is int or expr is float:
		return {"ok": true, "op": "==", "value": float(expr)}
	if not expr is String:
		return {"ok": false, "op": "", "value": 0.0}
	var text := (expr as String).strip_edges()
	var op := "=="
	for candidate in _OPS:
		if text.begins_with(candidate):
			op = candidate
			text = text.substr(candidate.length()).strip_edges()
			break
	if not text.is_valid_float():
		return {"ok": false, "op": op, "value": 0.0}
	return {"ok": true, "op": op, "value": text.to_float()}


static func compare(actual: float, expr: Variant) -> bool:
	var p := parse(expr)
	if not p["ok"]:
		return false
	var v: float = p["value"]
	match p["op"]:
		"<=": return actual <= v
		">=": return actual >= v
		"<": return actual < v
		">": return actual > v
		"!=": return actual != v
		_: return actual == v


## Problems with one requirement dict, for the catalog validator.
static func validate_reqs(reqs: Variant) -> PackedStringArray:
	var errors := PackedStringArray()
	if not reqs is Dictionary:
		errors.append("reqs must be a dictionary")
		return errors
	for key in reqs:
		if not key in VOCABULARY:
			errors.append("unknown requirement '%s'" % key)
		elif not parse(reqs[key])["ok"]:
			errors.append("bad expression for '%s': %s" % [key, reqs[key]])
	return errors
