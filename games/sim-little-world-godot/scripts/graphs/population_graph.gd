extends RefCounted

const KEYS := ["microbes", "amoeboids", "grazers", "predators"]
const COLORS := [Color("#55f08a"), Color("#67eaff"), Color("#c5e66f"), Color("#ff7148")]

func sample_tick(history: Array[Dictionary], index: int, current_tick: int) -> int:
	# Older saves sampled every 30 ticks without storing a timestamp.
	return int(history[index].get("tick", maxi(0, (current_tick / 30 - history.size() + 1 + index) * 30)))

func plot_rect(size: Vector2, expanded: bool) -> Rect2:
	return Rect2(Vector2(54, 16), size - Vector2(72, 52)) if expanded else Rect2(Vector2(0, 27), size - Vector2(0, 33))

func series_max(history: Array[Dictionary], keys: Array, rounded := true) -> float:
	var maximum := 1.0
	for item in history:
		for key in keys:
			maximum = maxf(maximum, float(item[key]))
	return ceil(maximum / 10.0) * 10.0 if rounded else maximum

func index_at(position: Vector2, size: Vector2, count: int) -> int:
	var plot := plot_rect(size, true)
	if count == 0 or not plot.has_point(position):
		return -1
	return clampi(roundi((position.x - plot.position.x) / plot.size.x * (count - 1)), 0, count - 1)

func draw_graph(graph: Control, history: Array[Dictionary], events: Array[Dictionary] = [], current_tick := 0, expanded := false, relative := true, enabled: Array = KEYS, hover_index := -1) -> void:
	graph.draw_rect(Rect2(Vector2.ZERO, graph.size), Color(0.008, 0.022, 0.032, 0.94))
	var plot := plot_rect(graph.size, expanded)
	var maximum := series_max(history, enabled)
	for i in range(5):
		var y := plot.position.y + float(i) / 4.0 * plot.size.y
		graph.draw_line(Vector2(plot.position.x, y), Vector2(plot.end.x, y), Color(0.55, 0.9, 1.0, 0.1), 1.0)
		if expanded:
			var label := "%d%%" % (100 - i * 25) if relative else "%d" % roundi(maximum * (1.0 - float(i) / 4.0))
			graph.draw_string(ThemeDB.fallback_font, Vector2(4, y + 5), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#9cbdbf"))
	if history.size() < 2:
		if expanded:
			graph.draw_string(ThemeDB.fallback_font, plot.position + Vector2(20, 45), "Let the ocean run to record its first population changes.", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#b4d8d3"))
		return
	var first_tick := sample_tick(history, 0, current_tick)
	var last_tick := sample_tick(history, history.size() - 1, current_tick)
	var span := maxi(1, last_tick - first_tick)
	if expanded:
		for event in events:
			var event_tick := int(event.get("tick", (int(event.day) - 1) * 180))
			if event_tick < first_tick or event_tick > last_tick:
				continue
			var x := plot.position.x + float(event_tick - first_tick) / span * plot.size.x
			graph.draw_line(Vector2(x, plot.position.y), Vector2(x, plot.end.y), Color(1.0, 0.8, 0.4, 0.15), 1.0)
			graph.draw_circle(Vector2(x, plot.end.y + 5), 2.4, Color("#ddbd76"))
		graph.draw_string(ThemeDB.fallback_font, Vector2(plot.position.x, graph.size.y - 8), "Day %.1f" % (1.0 + first_tick / 180.0), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#9cbdbf"))
		graph.draw_string(ThemeDB.fallback_font, Vector2(plot.end.x - 80, graph.size.y - 8), "Day %.1f" % (1.0 + last_tick / 180.0), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#9cbdbf"))
	for k in range(KEYS.size()):
		var key: String = KEYS[k]
		if not key in enabled:
			continue
		var peak := series_max(history, [key], false) if relative else maximum
		var points := PackedVector2Array()
		for i in range(history.size()):
			var x := plot.position.x + float(sample_tick(history, i, current_tick) - first_tick) / span * plot.size.x
			var y := plot.end.y - float(history[i][key]) / peak * plot.size.y
			points.append(Vector2(x, y))
		graph.draw_polyline(points, Color(0, 0, 0, 0.35), 4.0, true)
		graph.draw_polyline(points, COLORS[k], 2.0, true)
	if expanded and hover_index >= 0 and hover_index < history.size():
		var x := plot.position.x + float(sample_tick(history, hover_index, current_tick) - first_tick) / span * plot.size.x
		graph.draw_line(Vector2(x, plot.position.y), Vector2(x, plot.end.y), Color("#e8fff2"), 1.0)
