extends RefCounted


func draw_graph(graph: Control, history: Array[Dictionary]) -> void:
	graph.draw_rect(Rect2(Vector2.ZERO, graph.size), Color(0.01, 0.02, 0.04, 0.62))
	for i in range(5):
		var y := float(i) / 4.0 * graph.size.y
		graph.draw_line(Vector2(0, y), Vector2(graph.size.x, y), Color(0.55, 0.9, 1.0, 0.07), 1.0)
	if history.size() < 2:
		return
	var max_value := 50.0
	for item in history:
		max_value = max(max_value, float(item.microbes), float(item.amoeboids), float(item.grazers) * 2.0, float(item.predators) * 8.0, float(item.fungal))
	_graph_line(graph, history, "microbes", Color("#55f08a"), max_value, 1.0)
	_graph_line(graph, history, "amoeboids", Color("#67eaff"), max_value, 1.0)
	_graph_line(graph, history, "grazers", Color("#87d3b9"), max_value, 2.0)
	_graph_line(graph, history, "predators", Color("#ff7148"), max_value, 8.0)
	_graph_line(graph, history, "fungal", Color("#c480ff"), max_value, 1.0)


func _graph_line(graph: Control, history: Array[Dictionary], key: String, color: Color, max_value: float, multiplier: float) -> void:
	var points := PackedVector2Array()
	for i in range(history.size()):
		var item := history[i]
		var x := float(i) / float(max(1, history.size() - 1)) * graph.size.x
		var y := graph.size.y - (float(item[key]) * multiplier / max_value) * (graph.size.y - 14.0) - 7.0
		points.append(Vector2(x, y))
	if points.size() > 1:
		graph.draw_polyline(points, color, 2.4)
