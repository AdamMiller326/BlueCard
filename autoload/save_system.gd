class_name SaveSystem
extends RefCounted
## Versioned JSON saves in user://. Every change to the save shape bumps
## VERSION and adds a migration from the previous version. Never break an old save.

const VERSION := 1
const PATH := "user://save.json"


## version -> Callable(data: Dictionary) -> Dictionary at version + 1.
static func migrations() -> Dictionary:
	return {}


static func encode(state: NurseryState) -> String:
	return JSON.stringify({"version": VERSION, "nursery": state.to_dict()}, "\t", true, true)


## null if the text is not a save this build can read.
static func decode(text: String) -> NurseryState:
	var json := JSON.new()
	if json.parse(text) != OK:
		return null
	var data = json.data
	if not data is Dictionary:
		return null
	data = migrate(data)
	if data.is_empty() or not data.get("nursery") is Dictionary:
		return null
	return NurseryState.from_dict(data["nursery"])


## Walks a save forward one version at a time. {} if it can't: missing version,
## a gap in the migrations, or a save from a newer build.
static func migrate(data: Dictionary, steps: Dictionary = migrations(), target: int = VERSION) -> Dictionary:
	if not data.has("version"):
		return {}
	var v := int(data["version"])
	if v > target:
		return {}
	while v < target:
		if not steps.has(v):
			return {}
		data = steps[v].call(data)
		v += 1
		data["version"] = v
	return data


## Writes to a temp file, then swaps it in, so a crash mid-write keeps the old save.
static func save(state: NurseryState, path: String = PATH) -> Error:
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return FileAccess.get_open_error()
	f.store_string(encode(state))
	f.close()
	return DirAccess.rename_absolute(tmp, path)


## {"state": NurseryState or null, "error": String}. A missing file is not an error.
static func load_state(path: String = PATH) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {"state": null, "error": ""}
	var text := FileAccess.get_file_as_string(path)
	var state := decode(text)
	if state == null:
		return {"state": null, "error": "unreadable save at %s" % path}
	return {"state": state, "error": ""}


## Keeps an unreadable save aside instead of overwriting it.
static func back_up(path: String = PATH) -> void:
	if FileAccess.file_exists(path):
		DirAccess.copy_absolute(path, path + ".unreadable.%d" % Time.get_unix_time_from_system())
