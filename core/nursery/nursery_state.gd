class_name NurseryState
extends RefCounted
## The whole nursery. Serializes to a Dictionary of plain values.

## Total played seconds the nursery has run. Only ever moves forward.
var time: float = 0.0
## Set by runs via NurseryLogic.set_in_battle(). Grace windows can't close while true.
var in_battle: bool = false
var slots: Array[SlotState] = []


func _init() -> void:
	for i in Tuning.SLOT_COUNT:
		slots.append(SlotState.new())


func to_dict() -> Dictionary:
	var slot_dicts: Array = []
	for s in slots:
		slot_dicts.append(s.to_dict())
	return {"time": time, "in_battle": in_battle, "slots": slot_dicts}


static func from_dict(d: Dictionary) -> NurseryState:
	var st := NurseryState.new()
	st.time = float(d.get("time", 0.0))
	st.in_battle = bool(d.get("in_battle", false))
	var raw: Array = d.get("slots", [])
	for i in Tuning.SLOT_COUNT:
		if i < raw.size():
			st.slots[i] = SlotState.from_dict(raw[i])
	return st
