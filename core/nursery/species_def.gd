class_name SpeciesDef
extends Resource
## One mon species at one stage. Pure data: the nursery reads these, never the
## other way round. Validated by Catalog.validate().

@export var id: String = ""
@export var display_name: String = ""
## "baby", "child" or "rookie".
@export var stage: String = "baby"
## "vaccine", "data", "virus" or "free".
@export var attribute: String = "free"
## Played seconds in this stage before evolving. Unused for rookies.
@export var stage_seconds: float = 0.0
## Played seconds between hunger windows.
@export var hunger_interval: float = 0.0
## Poops per gap between hunger windows, spread evenly.
@export var poop_per_gap: int = 0
## If true, the last poop of each gap is a jumbo.
@export var jumbo_per_gap: bool = false
## Every Nth hunger window in this stage is also a strength check. 0 = none.
@export var strength_every: int = 0
## Weight on entering this stage. Later stages add the difference.
@export var base_weight: int = 5
## Checked in order at stage end; the first match wins.
## [{"to": "species_id", "reqs": {"careMistakes": "<=1"}}, ...]
## The last branch must have empty reqs (fallback).
@export var evolutions: Array = []
## Card ids this mon brings to a run. Runs are not built yet.
@export var card_pool: PackedStringArray = PackedStringArray()
## Placeholder art colour. Used when sprite is null.
@export var color: Color = Color.WHITE
@export var sprite: Texture2D
