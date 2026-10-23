extends Control
## Nursery screen: two slots, played time, event log, debug panel.

const Fmt := preload("res://scenes/nursery/format.gd")
const SlotView := preload("res://scenes/nursery/slot_view.gd")
const DebugPanel := preload("res://scenes/debug/debug_panel.gd")

var _time: Label
var _pause: Button
var _log: Label


func _ready() -> void:
	GameState.start()

	var bg := ColorRect.new()
	bg.color = Color(0.07, 0.08, 0.11)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 12)
	add_child(margin)
	var box := VBoxContainer.new()
	margin.add_child(box)

	var header := HBoxContainer.new()
	box.add_child(header)
	var title := Label.new()
	title.text = "Nursery"
	title.add_theme_font_size_override("font_size", 26)
	header.add_child(title)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	_time = Label.new()
	header.add_child(_time)
	_pause = Button.new()
	_pause.pressed.connect(func(): PlayClock.paused = not PlayClock.paused)
	header.add_child(_pause)

	var slots := HBoxContainer.new()
	slots.add_theme_constant_override("separation", 12)
	box.add_child(slots)
	for i in Tuning.SLOT_COUNT:
		var view := SlotView.new()
		view.slot_index = i
		slots.add_child(view)

	_log = Label.new()
	_log.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_log.add_theme_font_size_override("font_size", 12)
	_log.add_theme_color_override("font_color", Color(0.7, 0.72, 0.78))
	box.add_child(_log)

	if OS.is_debug_build():
		box.add_child(DebugPanel.new())


func _process(_delta: float) -> void:
	_time.text = "Played %s  x%d  " % [Fmt.clock(GameState.state.time), PlayClock.time_scale]
	_pause.text = "Resume" if PlayClock.paused else "Pause"
	var lines: PackedStringArray = []
	for ev in GameState.event_log.slice(-4):
		lines.append(Fmt.event_text(ev, GameState.catalog))
	_log.text = "\n".join(lines)
