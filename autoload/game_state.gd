extends Node
## Owns the NurseryState, feeds it played time, runs player actions and saves.
## Nothing happens until start() is called, so headless tests don't touch saves.

signal events_emitted(events: Array)

const CATALOG_PATH := "res://data/catalog.tres"
## Real seconds between autosaves, on top of saving after every event.
const AUTOSAVE_SECONDS := 10.0
const LOG_SIZE := 12

var catalog: Catalog
var state: NurseryState
## Most recent events, oldest first. For the on-screen log.
var event_log: Array = []

var _started := false
var _since_save := 0.0


func start() -> void:
	if _started:
		return
	_started = true
	catalog = Catalog.from_def(load(CATALOG_PATH))
	for e in catalog.validate():
		push_error("catalog: " + e)
	var loaded := SaveSystem.load_state()
	if loaded["error"]:
		push_warning(loaded["error"] + "; starting fresh and keeping a copy")
		SaveSystem.back_up()
	state = loaded["state"] if loaded["state"] != null else NurseryState.new()
	PlayClock.tick.connect(_on_tick)


func _on_tick(played_delta: float) -> void:
	_handle(NurseryLogic.advance(state, catalog, played_delta))


func _process(delta: float) -> void:
	if not _started:
		return
	_since_save += delta
	if _since_save >= AUTOSAVE_SECONDS:
		save()


## action: feed, protein, train, clean, add_egg, send, discard, force_stage.
func act(action: String, slot: int) -> Array:
	var events: Array
	match action:
		"feed": events = NurseryLogic.feed(state, catalog, slot)
		"protein": events = NurseryLogic.protein(state, catalog, slot)
		"train": events = NurseryLogic.train(state, catalog, slot)
		"clean": events = NurseryLogic.clean(state, catalog, slot)
		"add_egg": events = NurseryLogic.add_egg(state, catalog, slot)
		"send": events = NurseryLogic.send_to_run(state, catalog, slot)
		"discard": events = NurseryLogic.discard(state, catalog, slot)
		"force_stage": events = NurseryLogic.force_next_stage(state, catalog, slot)
		_:
			push_error("unknown action " + action)
			return []
	_handle(events)
	return events


func set_in_battle(in_battle: bool) -> void:
	_handle(NurseryLogic.set_in_battle(state, in_battle))


## Debug: wipe the nursery.
func reset() -> void:
	state = NurseryState.new()
	event_log.clear()
	save()


func save() -> void:
	_since_save = 0.0
	if state == null:
		return
	var err := SaveSystem.save(state)
	if err != OK:
		push_warning("save failed: %s" % error_string(err))


func _handle(events: Array) -> void:
	if events.is_empty():
		return
	for ev in events:
		if ev["type"] == "sent":
			# Runs don't exist yet; the handoff just logs the record.
			print("Send to run: ", ev["rookie"])
	event_log.append_array(events)
	if event_log.size() > LOG_SIZE:
		event_log = event_log.slice(event_log.size() - LOG_SIZE)
	events_emitted.emit(events)
	save()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		save()
