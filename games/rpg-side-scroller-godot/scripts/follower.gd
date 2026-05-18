extends Node2D

signal cast_projectile(origin: Vector2, velocity: Vector2, damage: int)

var target: Node2D
var cooldown := 0.0

func _ready() -> void:
	_build_visual()

func _process(delta: float) -> void:
	if cooldown > 0.0:
		cooldown -= delta
	if not target:
		return
	var desired := target.global_position + Vector2(-82.0 * target.facing, -42.0)
	global_position = global_position.lerp(desired, min(1.0, delta * 7.5))

func try_cast(enemies: Array) -> void:
	if cooldown > 0.0 or enemies.is_empty():
		return
	var nearest: Node2D = null
	var nearest_distance := 999999.0
	for enemy in enemies:
		if not is_instance_valid(enemy):
			continue
		var distance := global_position.distance_to(enemy.global_position)
		if distance < nearest_distance:
			nearest = enemy
			nearest_distance = distance
	if nearest and nearest_distance < 780.0:
		cooldown = 0.85
		var direction := (nearest.global_position - global_position).normalized()
		cast_projectile.emit(global_position, direction * 680.0, 16)
		_pulse()

func _build_visual() -> void:
	var glow := Polygon2D.new()
	glow.polygon = PackedVector2Array([Vector2(0, -32), Vector2(28, -10), Vector2(18, 24), Vector2(-18, 24), Vector2(-28, -10)])
	glow.color = Color("#4ee8ff", 0.32)
	add_child(glow)

	var robe := Polygon2D.new()
	robe.polygon = PackedVector2Array([Vector2(-18, -18), Vector2(18, -18), Vector2(25, 28), Vector2(-25, 28)])
	robe.color = Color("#62d6ff")
	add_child(robe)

	var face := Polygon2D.new()
	face.polygon = PackedVector2Array([Vector2(-11, -38), Vector2(11, -38), Vector2(14, -18), Vector2(-14, -18)])
	face.color = Color("#ffe4ba")
	add_child(face)

func _pulse() -> void:
	scale = Vector2(1.22, 1.22)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE, 0.22)
