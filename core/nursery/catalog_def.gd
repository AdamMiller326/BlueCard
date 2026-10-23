class_name CatalogDef
extends Resource
## Lists every species and egg the game ships with. data/catalog.tres.

@export var species: Array = []
@export var eggs: Array = []
## The always-free egg.
@export var basic_egg: String = ""
