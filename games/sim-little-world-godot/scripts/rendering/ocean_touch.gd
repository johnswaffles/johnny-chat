extends RefCounted

# Track only fingers that began over the ocean, never drags out of UI panels.
var points: Dictionary = {}
var starts: Dictionary = {}
var tap_allowed := false

func reset() -> void:
	points.clear()
	starts.clear()
	tap_allowed = false

func release(index: int) -> void:
	points.erase(index)
	starts.erase(index)
	if points.is_empty(): tap_allowed = false

func handle(game: Node, event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if not game.camera.frame.has_point(event.position): return
			points[event.index] = event.position
			starts[event.index] = event.position
			tap_allowed = points.size() == 1 and not game.pan_mode
		else:
			if points.has(event.index) and points.size() == 1 and tap_allowed:
				if event.position.distance_to(starts[event.index]) <= 18.0:
					game._use_selected_tool(event.position)
			release(event.index)
	elif event is InputEventScreenDrag and points.has(event.index):
		var old: Vector2 = points[event.index]
		points[event.index] = event.position
		if points.size() == 2:
			tap_allowed = false
			var keys := points.keys()
			var other: Vector2 = points[keys[1] if keys[0] == event.index else keys[0]]
			var old_distance := old.distance_to(other)
			var distance: float = event.position.distance_to(other)
			if old_distance > 8.0 and distance > 8.0:
				game._zoom_camera(distance / old_distance, (old + other) * 0.5)
				game._pan_camera((event.position - old) * 0.5)
		elif points.size() == 1:
			if event.position.distance_to(starts[event.index]) > 18.0:
				tap_allowed = false
			if not tap_allowed:
				game._pan_camera(event.position - old)
