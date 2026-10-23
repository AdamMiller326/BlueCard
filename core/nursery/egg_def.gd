class_name EggDef
extends Resource
## An egg the nursery can hatch.

@export var id: String = ""
@export var display_name: String = ""
## Species id of the Baby it hatches into.
@export var baby_species: String = ""
## Played seconds from placing the egg to hatching.
@export var hatch_seconds: float = 60.0
## Max total inherit value of cards this egg passes on. DNA eggs only (later).
@export var inherit_budget: int = 0
## Placeholder art colour.
@export var color: Color = Color.WHITE
