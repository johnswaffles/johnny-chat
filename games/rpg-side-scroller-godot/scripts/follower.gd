extends Node2D

signal cast_projectile(origin: Vector2, velocity: Vector2, damage: int)

const PixelArt = preload("res://scripts/pixel_art.gd")

var target: Node2D
var cooldown := 0.0
var sprite: AnimatedSprite2D

func _ready() -> void:
	_build_visual()

func _process(delta: float) -> void:
	if cooldown > 0.0:
		cooldown -= delta
	if not target:
		return
	var desired := target.global_position + Vector2(-82.0 * target.facing, -42.0)
	global_position = global_position.lerp(desired.round(), min(1.0, delta * 8.5))

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
	sprite = AnimatedSprite2D.new()
	sprite.sprite_frames = _build_frames()
	sprite.animation = "float"
	sprite.play()
	sprite.scale = Vector2(3.2, 3.2)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(sprite)

func _build_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	frames.add_animation("float")
	frames.set_animation_loop("float", true)
	frames.set_animation_speed("float", 4.0)
	for i in range(3):
		frames.add_frame("float", _mage_frame(i))
	return frames

func _mage_frame(step: int) -> Texture2D:
	var bob: int = [-1, 0, 1][step]
	return PixelArt.texture(28, 30, Color.TRANSPARENT, [
		{"x": 6, "y": 12 + bob, "w": 16, "h": 14, "color": Color("#58dfff", 0.45)},
		{"x": 8, "y": 11 + bob, "w": 12, "h": 15, "color": Color("#62d6ff")},
		{"x": 10, "y": 5 + bob, "w": 9, "h": 7, "color": Color("#ffe4ba")},
		{"x": 8, "y": 3 + bob, "w": 13, "h": 4, "color": Color("#d8f8ff")},
		{"x": 11, "y": 8 + bob, "w": 2, "h": 2, "color": Color("#1b3150")},
		{"x": 17, "y": 8 + bob, "w": 2, "h": 2, "color": Color("#1b3150")},
		{"x": 5, "y": 17 + bob, "w": 4, "h": 7, "color": Color("#3aa5d8")},
		{"x": 19, "y": 17 + bob, "w": 4, "h": 7, "color": Color("#3aa5d8")},
		{"x": 12, "y": 25 + bob, "w": 5, "h": 3, "color": Color("#9cf7ff", 0.9)},
	])

func _pulse() -> void:
	scale = Vector2(1.22, 1.22)
	var tween := create_tween()
	tween.tween_property(self, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)
