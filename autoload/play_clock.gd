extends Node
## Played-time clock. Emits tick(played_delta) every frame while the game runs
## and isn't paused. Nothing is caught up after the game was closed.

signal tick(played_delta: float)

## Debug time scales. Release builds always run at x1.
const SCALES := [1.0, 10.0, 60.0]
## Real seconds one frame may count for, so a hitch or a suspended process
## doesn't dump minutes of played time at once.
const MAX_FRAME_SECONDS := 0.25

var time_scale: float = 1.0:
	set(value):
		time_scale = value if OS.is_debug_build() else 1.0
## Player pause. The clock also stops when the SceneTree is paused.
var paused: bool = false

var _backgrounded := false


func _process(delta: float) -> void:
	if paused or _backgrounded:
		return
	tick.emit(minf(delta, MAX_FRAME_SECONDS) * time_scale)


func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED:
			_backgrounded = true
		NOTIFICATION_APPLICATION_RESUMED:
			_backgrounded = false
