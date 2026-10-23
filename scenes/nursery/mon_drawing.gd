extends Control
## Placeholder art for one slot: coloured shapes, hearts and poop.

var slot_index := 0

const BG := Color(0.11, 0.13, 0.17)
const HEART_ON := Color(0.9, 0.25, 0.3)
const HEART_OFF := Color(0.3, 0.3, 0.35)
const POOP := Color(0.45, 0.3, 0.15)


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), BG)
	var st: NurseryState = GameState.state
	if st == null:
		return
	var s := st.slots[slot_index]
	var c := size / 2.0 + Vector2(0, 6)
	var bob := sin(Time.get_ticks_msec() / 300.0) * 3.0
	match s.stage:
		SlotState.EMPTY:
			draw_arc(c, 36, 0, TAU, 40, Color(0.35, 0.35, 0.4), 2.0)
		SlotState.EGG:
			var egg := GameState.catalog.get_egg(s.egg_id)
			var wobble := sin(Time.get_ticks_msec() / 150.0) * 0.08 if s.stage_end - st.time < 10.0 else 0.0
			_ellipse(c, Vector2(30, 40), egg.color, wobble)
			draw_circle(c + Vector2(-10, -8).rotated(wobble), 5, egg.color.darkened(0.25))
			draw_circle(c + Vector2(9, 10).rotated(wobble), 6, egg.color.darkened(0.25))
		SlotState.BABY, SlotState.CHILD, SlotState.ROOKIE:
			_draw_mon(s, c + Vector2(0, bob))
	if s.is_raising():
		_draw_hearts(CareSchedule.hearts(s, st.time))
		_draw_poop(s)
		if CareSchedule.is_hungry(s) and int(Time.get_ticks_msec() / 400) % 2 == 0:
			draw_string(ThemeDB.fallback_font, c + Vector2(34, -34), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 32, HEART_ON)


func _draw_mon(s: SlotState, c: Vector2) -> void:
	var sp := GameState.catalog.get_species(s.species_id)
	if sp == null:
		return
	if sp.sprite:
		draw_texture(sp.sprite, c - sp.sprite.get_size() / 2.0)
		return
	var col := sp.color
	match s.stage:
		SlotState.BABY:
			draw_circle(c, 24, col)
			_eyes(c, 7, 3)
		SlotState.CHILD:
			draw_colored_polygon(PackedVector2Array([c + Vector2(-30, -18), c + Vector2(-18, -52), c + Vector2(-6, -26)]), col.darkened(0.15))
			draw_colored_polygon(PackedVector2Array([c + Vector2(30, -18), c + Vector2(18, -52), c + Vector2(6, -26)]), col.darkened(0.15))
			draw_circle(c, 36, col)
			_eyes(c, 11, 4)
		SlotState.ROOKIE:
			draw_rect(Rect2(c - Vector2(42, 42), Vector2(84, 84)), col)
			_eyes(c + Vector2(0, -8), 14, 5)
			draw_line(c + Vector2(-12, 18), c + Vector2(12, 18), Color.BLACK, 3.0)
			if s.quality == Tuning.QUALITY_PERFECT:
				draw_string(ThemeDB.fallback_font, c + Vector2(30, -40), "*", HORIZONTAL_ALIGNMENT_LEFT, -1, 36, Color(1, 0.85, 0.2))


func _eyes(c: Vector2, spread: float, r: float) -> void:
	draw_circle(c + Vector2(-spread, -r), r, Color.BLACK)
	draw_circle(c + Vector2(spread, -r), r, Color.BLACK)


func _draw_hearts(hearts: int) -> void:
	for i in Tuning.HEARTS_MAX:
		draw_rect(Rect2(Vector2(10 + i * 18, 10), Vector2(14, 14)), HEART_ON if i < hearts else HEART_OFF)


func _draw_poop(s: SlotState) -> void:
	var x := size.x - 18.0
	for _i in s.poop_jumbo:
		if x < size.x / 2.0:
			return
		draw_circle(Vector2(x, size.y - 18), 12, POOP)
		x -= 28.0
	for _i in s.poop_normal:
		if x < size.x / 2.0:
			return
		draw_circle(Vector2(x, size.y - 14), 7, POOP)
		x -= 18.0


func _ellipse(c: Vector2, radii: Vector2, col: Color, rotation: float) -> void:
	var points := PackedVector2Array()
	for i in 32:
		var a := TAU * i / 32.0
		points.append(c + Vector2(cos(a) * radii.x, sin(a) * radii.y).rotated(rotation))
	draw_colored_polygon(points, col)
