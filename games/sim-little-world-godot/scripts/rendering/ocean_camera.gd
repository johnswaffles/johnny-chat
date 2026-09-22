extends RefCounted

const Simulation = preload("res://scripts/simulation/planet_simulation.gd")
const BOUNDS := Rect2(Simulation.WORLD_OFFSET, Simulation.WORLD_SIZE)
var frame := BOUNDS
var zoom := 1.0
var center := BOUNDS.get_center()

func scale() -> Vector2:
	return frame.size / BOUNDS.size * zoom

func origin() -> Vector2:
	return frame.get_center() - center * scale()

func to_world(point: Vector2) -> Vector2:
	return (point - origin()) / scale()

func to_screen(point: Vector2) -> Vector2:
	return origin() + point * scale()

func set_zoom(value: float, anchor: Vector2) -> void:
	var before := to_world(anchor)
	zoom = clampf(value, 1.0, 4.0)
	center += before - to_world(anchor)
	constrain()

func pan(screen_delta: Vector2) -> void:
	center -= screen_delta / scale()
	constrain()

func constrain() -> void:
	var half_visible := BOUNDS.size / (2.0 * zoom)
	center = center.clamp(BOUNDS.position + half_visible, BOUNDS.end - half_visible)

func fit() -> void:
	zoom = 1.0
	center = BOUNDS.get_center()
