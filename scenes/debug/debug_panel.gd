extends PanelContainer
## Debug tools: time scale, battle toggle, force stage, clear slot, and an
## overlay of each slot's upcoming schedule. Only added in debug builds.

const Fmt := preload("res://scenes/nursery/format.gd")

var _columns: Array[Label] = []
var _scale_buttons := {}
var _battle: CheckButton


func _ready() -> void:
	var box := VBoxContainer.new()
	add_child(box)

	var row := HBoxContainer.new()
	box.add_child(row)
	var title := Label.new()
	title.text = "DEBUG  time:"
	row.add_child(title)
	var group := ButtonGroup.new()
	for scale in PlayClock.SCALES:
		var b := Button.new()
		b.text = "x%d" % scale
		b.toggle_mode = true
		b.button_group = group
		b.button_pressed = is_equal_approx(PlayClock.time_scale, scale)
		b.pressed.connect(func(): PlayClock.time_scale = scale)
		row.add_child(b)
		_scale_buttons[scale] = b
	_battle = CheckButton.new()
	_battle.text = "In battle"
	_battle.toggled.connect(GameState.set_in_battle)
	row.add_child(_battle)
	var reset := Button.new()
	reset.text = "Reset save"
	reset.pressed.connect(GameState.reset)
	row.add_child(reset)

	var slot_row := HBoxContainer.new()
	box.add_child(slot_row)
	for i in Tuning.SLOT_COUNT:
		var force := Button.new()
		force.text = "Slot %d: next stage" % (i + 1)
		force.pressed.connect(GameState.act.bind("force_stage", i))
		slot_row.add_child(force)
		var clear := Button.new()
		clear.text = "Slot %d: clear" % (i + 1)
		clear.pressed.connect(GameState.act.bind("discard", i))
		slot_row.add_child(clear)

	var overlay := HBoxContainer.new()
	box.add_child(overlay)
	for i in Tuning.SLOT_COUNT:
		var col := Label.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_theme_font_size_override("font_size", 12)
		overlay.add_child(col)
		_columns.append(col)


func _process(_delta: float) -> void:
	var st: NurseryState = GameState.state
	_battle.set_pressed_no_signal(st.in_battle)
	for scale in _scale_buttons:
		_scale_buttons[scale].set_pressed_no_signal(is_equal_approx(PlayClock.time_scale, scale))
	for i in st.slots.size():
		var s := st.slots[i]
		var sp := GameState.catalog.get_species(s.species_id)
		var lines: PackedStringArray = ["Slot %d upcoming:" % (i + 1)]
		for item in CareSchedule.upcoming(s, sp).slice(0, 6):
			lines.append("  %s  %s" % [Fmt.clock(item["t"] - st.time), item["what"]])
		_columns[i].text = "\n".join(lines)
