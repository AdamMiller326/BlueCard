extends PanelContainer
## One nursery slot: placeholder mon, status text and care buttons.

const Fmt := preload("res://scenes/nursery/format.gd")
const MonDrawing := preload("res://scenes/nursery/mon_drawing.gd")
const ACTIONS := {
	"feed": "Feed",
	"protein": "Protein",
	"train": "Train",
	"clean": "Clean",
	"add_egg": "Add egg",
	"send": "Send to run",
}

var slot_index := 0

var _title: Label
var _status: Label
var _buttons := {}


func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var box := VBoxContainer.new()
	add_child(box)
	_title = Label.new()
	_title.add_theme_font_size_override("font_size", 22)
	box.add_child(_title)
	var drawing := MonDrawing.new()
	drawing.slot_index = slot_index
	drawing.custom_minimum_size = Vector2(0, 140)
	box.add_child(drawing)
	_status = Label.new()
	_status.custom_minimum_size = Vector2(0, 140)
	box.add_child(_status)
	var row := HFlowContainer.new()
	box.add_child(row)
	for action in ACTIONS:
		var b := Button.new()
		b.text = ACTIONS[action]
		b.pressed.connect(GameState.act.bind(action, slot_index))
		row.add_child(b)
		_buttons[action] = b


func _process(_delta: float) -> void:
	var st: NurseryState = GameState.state
	var s := st.slots[slot_index]
	_title.text = "Slot %d  %s" % [slot_index + 1, _name(s)]
	_status.text = _status_text(st, s)
	_buttons["feed"].visible = s.is_raising()
	_buttons["clean"].visible = s.is_raising()
	_buttons["feed"].disabled = not NurseryLogic.can_feed(st, slot_index)
	_buttons["protein"].disabled = not NurseryLogic.can_protein(st, slot_index)
	_buttons["train"].disabled = not NurseryLogic.can_train(st, slot_index)
	_buttons["clean"].disabled = not NurseryLogic.can_clean(st, slot_index)
	_buttons["add_egg"].visible = s.is_empty()
	_buttons["send"].visible = s.stage == SlotState.ROOKIE
	_buttons["send"].disabled = not NurseryLogic.can_send(st, slot_index)
	_buttons["protein"].visible = s.stage == SlotState.CHILD
	_buttons["train"].visible = s.stage == SlotState.CHILD


func _name(s: SlotState) -> String:
	match s.stage:
		SlotState.EMPTY: return "(empty)"
		SlotState.EGG: return GameState.catalog.get_egg(s.egg_id).display_name
		_: return "%s (%s)" % [Fmt.species_name(GameState.catalog, s.species_id), s.stage.capitalize()]


func _status_text(st: NurseryState, s: SlotState) -> String:
	var now := st.time
	var lines: PackedStringArray = []
	match s.stage:
		SlotState.EMPTY:
			lines.append("Place a basic egg (free).")
		SlotState.EGG:
			lines.append("Hatches in %s" % Fmt.clock(s.stage_end - now))
		SlotState.BABY, SlotState.CHILD:
			lines.append("Evolves in %s" % Fmt.clock(s.stage_end - now))
			if CareSchedule.is_hungry(s):
				var left := CareSchedule.grace_left(s, now)
				lines.append("HUNGRY! Feed within %s" % (Fmt.clock(left) if left > 0.0 else "(after battle)"))
			else:
				lines.append("Hungry in %s" % Fmt.clock(CareSchedule.seconds_to_hungry(s, now)))
			if s.stage == SlotState.CHILD:
				var check := CareSchedule.strength_check_close(s)
				var when := "closes in %s" % Fmt.clock(check - now) if check >= 0.0 else "next check soon"
				var next := CareSchedule.next_strength_window(s, GameState.catalog.get_species(s.species_id))
				if check < 0.0:
					when = "next check in %s" % Fmt.clock(next - now) if next >= 0.0 else "no more checks"
				lines.append("Strength: %s, %s" % ["full" if s.strength_filled else "EMPTY", when])
			lines.append("Poop: %d / %d" % [CareSchedule.poop_points(s), Tuning.POOP_CAP])
			lines.append("Mistakes: baby %d, child %d" % [s.mistakes[SlotState.BABY], s.mistakes[SlotState.CHILD]])
			lines.append("Effort %d (%d trainings)   Weight %d" % [s.effort(), s.trainings, s.weight])
		SlotState.ROOKIE:
			var r := s.rookie
			lines.append("Ready! Quality: %s" % String(r["quality"]).capitalize())
			lines.append("Bonus: +%d card, +%d max HP" % [r["bonus_cards"], r["max_hp_bonus"]])
			lines.append("Mistakes %d, effort %d, weight %d" % [r["mistakes"], r["effort"], r["weight"]])
	return "\n".join(lines)
