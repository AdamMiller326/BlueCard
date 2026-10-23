class_name SlotState
extends RefCounted
## One nursery slot: a mon from egg to Rookie. All times are absolute
## nursery played seconds (NurseryState.time). -1.0 means "none".

const EMPTY := ""
const EGG := "egg"
const BABY := "baby"
const CHILD := "child"
const ROOKIE := "rookie"

var stage: String = EMPTY
var egg_id: String = ""
var species_id: String = ""
var stage_start: float = 0.0
var stage_end: float = -1.0

## Hunger schedule. A gap runs from one window opening to the next.
var next_window_at: float = -1.0
var gap_start: float = 0.0
var gap_poops: int = 0
var gap_jumbo: bool = false
var gap_poops_done: int = 0
## Windows opened in the current stage. Drives strength checks.
var window_index: int = 0
## Open hunger windows: [{open_at, close_at, fed, strength}]. Usually 0 or 1;
## more can stack while a battle defers closes.
var deadlines: Array = []

var poop_normal: int = 0
var poop_jumbo: int = 0
## True once the poop cap has cost a mistake; cleared by cleaning.
var poop_mistake_given: bool = false

var strength_filled: bool = false
var mistakes: Dictionary = {BABY: 0, CHILD: 0}
var trainings: int = 0
var last_train_at: float = -1.0
var overfeeds: int = 0
var proteins: int = 0
var weight: int = 0

## Set when the mon reaches Rookie.
var quality: String = ""
var rookie: Dictionary = {}


func is_empty() -> bool:
	return stage == EMPTY


## Baby or Child: the stages that need care.
func is_raising() -> bool:
	return stage == BABY or stage == CHILD


func effort() -> int:
	@warning_ignore("integer_division")
	return mini(trainings / Tuning.TRAININGS_PER_EFFORT, Tuning.EFFORT_MAX)


func total_mistakes() -> int:
	return int(mistakes.get(BABY, 0)) + int(mistakes.get(CHILD, 0))


func to_dict() -> Dictionary:
	return {
		"stage": stage,
		"egg_id": egg_id,
		"species_id": species_id,
		"stage_start": stage_start,
		"stage_end": stage_end,
		"next_window_at": next_window_at,
		"gap_start": gap_start,
		"gap_poops": gap_poops,
		"gap_jumbo": gap_jumbo,
		"gap_poops_done": gap_poops_done,
		"window_index": window_index,
		"deadlines": deadlines.duplicate(true),
		"poop_normal": poop_normal,
		"poop_jumbo": poop_jumbo,
		"poop_mistake_given": poop_mistake_given,
		"strength_filled": strength_filled,
		"mistakes": mistakes.duplicate(),
		"trainings": trainings,
		"last_train_at": last_train_at,
		"overfeeds": overfeeds,
		"proteins": proteins,
		"weight": weight,
		"quality": quality,
		"rookie": rookie.duplicate(true),
	}


static func from_dict(d: Dictionary) -> SlotState:
	var s := SlotState.new()
	s.stage = String(d.get("stage", EMPTY))
	s.egg_id = String(d.get("egg_id", ""))
	s.species_id = String(d.get("species_id", ""))
	s.stage_start = float(d.get("stage_start", 0.0))
	s.stage_end = float(d.get("stage_end", -1.0))
	s.next_window_at = float(d.get("next_window_at", -1.0))
	s.gap_start = float(d.get("gap_start", 0.0))
	s.gap_poops = int(d.get("gap_poops", 0))
	s.gap_jumbo = bool(d.get("gap_jumbo", false))
	s.gap_poops_done = int(d.get("gap_poops_done", 0))
	s.window_index = int(d.get("window_index", 0))
	s.deadlines = []
	for raw in d.get("deadlines", []):
		s.deadlines.append({
			"open_at": float(raw.get("open_at", 0.0)),
			"close_at": float(raw.get("close_at", 0.0)),
			"fed": bool(raw.get("fed", false)),
			"strength": bool(raw.get("strength", false)),
		})
	s.poop_normal = int(d.get("poop_normal", 0))
	s.poop_jumbo = int(d.get("poop_jumbo", 0))
	s.poop_mistake_given = bool(d.get("poop_mistake_given", false))
	s.strength_filled = bool(d.get("strength_filled", false))
	var m: Dictionary = d.get("mistakes", {})
	s.mistakes = {BABY: int(m.get(BABY, 0)), CHILD: int(m.get(CHILD, 0))}
	s.trainings = int(d.get("trainings", 0))
	s.last_train_at = float(d.get("last_train_at", -1.0))
	s.overfeeds = int(d.get("overfeeds", 0))
	s.proteins = int(d.get("proteins", 0))
	s.weight = int(d.get("weight", 0))
	s.quality = String(d.get("quality", ""))
	s.rookie = Rookie.from_dict(d["rookie"]).to_dict() if d.get("rookie", {}) else {}
	return s
