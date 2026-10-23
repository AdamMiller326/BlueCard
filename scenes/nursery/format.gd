extends RefCounted
## Text helpers for the nursery UI.


static func clock(seconds: float) -> String:
	var s := maxi(ceili(seconds), 0)
	@warning_ignore("integer_division")
	var h := s / 3600
	@warning_ignore("integer_division")
	var m := (s % 3600) / 60
	if h > 0:
		return "%d:%02d:%02d" % [h, m, s % 60]
	return "%d:%02d" % [m, s % 60]


static func species_name(catalog: Catalog, id: String) -> String:
	var sp := catalog.get_species(id)
	return sp.display_name if sp else id


static func event_text(ev: Dictionary, catalog: Catalog) -> String:
	var who := "Slot %d: " % (ev["slot"] + 1) if ev["slot"] >= 0 else ""
	var what: String
	match ev["type"]:
		"egg_added": what = "egg placed"
		"hatched": what = "hatched into %s" % species_name(catalog, ev["species"])
		"evolved": what = "%s evolved into %s" % [species_name(catalog, ev["from"]), species_name(catalog, ev["species"])]
		"ready": what = "%s is ready (%s)" % [species_name(catalog, ev["species"]), ev["quality"]]
		"hungry": what = "hungry" + (" + strength check" if ev["strength_check"] else "")
		"fed": what = "fed"
		"overfed": what = "overfed (weight %d)" % ev["weight"]
		"protein": what = "protein (weight %d)" % ev["weight"]
		"trained": what = "trained (%d)" % ev["trainings"]
		"effort": what = "effort up to %d" % ev["effort"]
		"pooped": what = "jumbo poop" if ev["jumbo"] else "pooped"
		"cleaned": what = "cleaned"
		"mistake": what = "CARE MISTAKE (%s)" % ev["reason"]
		"sent": what = "sent to run"
		"discarded": what = "discarded"
		"battle_started": what = "battle started"
		"battle_ended": what = "battle ended"
		"rejected": what = "can't %s now" % ev["action"]
		_: what = ev["type"]
	return "[%s] %s%s" % [clock(ev["t"]), who, what]
