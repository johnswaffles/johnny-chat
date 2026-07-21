extends RefCounted


func draw_graph(graph: Control, history: Array[Dictionary]) -> void:
	graph.draw_rect(Rect2(Vector2.ZERO, graph.size), Color(0.008, 0.022, 0.032, 0.88))
	for i in range(4):
		var y := 25.0 + float(i) / 3.0 * (graph.size.y - 31.0)
		graph.draw_line(Vector2(0, y), Vector2(graph.size.x, y), Color(0.55, 0.9, 1.0, 0.055), 1.0)
	if history.size() < 2:
		return
	_graph_line(graph, history, "microbes", Color("#55f08a"))
	_graph_line(graph, history, "amoeboids", Color("#67eaff"))
	_graph_line(graph, history, "grazers", Color("#c5e66f"))
	_graph_line(graph, history, "predators", Color("#ff7148"))


func _graph_line(graph: Control, history: Array[Dictionary], key: String, color: Color) -> void:
	var maximum := 1.0
	for item in history:
		maximum = max(maximum, float(item[key]))
	var points := PackedVector2Array()
	for i in range(history.size()):
		var item := history[i]
		var x := float(i) / float(max(1, history.size() - 1)) * graph.size.x
		var normalized: float = sqrt(float(item[key]) / maximum)
		var y := graph.size.y - normalized * (graph.size.y - 34.0) - 5.0
		points.append(Vector2(x, y))
	if points.size() > 1:
		graph.draw_polyline(points, Color(0.0, 0.0, 0.0, 0.35), 4.6)
		graph.draw_polyline(points, color, 2.2)
