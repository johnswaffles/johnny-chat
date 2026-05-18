extends CharacterBody2D

signal defeated(enemy: Node)
signal effect_requested(kind: String, origin: Vector2)

const PixelArt = preload("res://scripts/pixel_art.gd")
const GRAVITY := 1600.0

var target: Node2D
var enemy_type := "goblin"
var max_hp := 35
var hp := 35
var damage := 8
var speed := 90.0
var coins := 8
var patrol_min := 0.0
var patrol_max := 0.0
var direction := -1.0
var attack_cooldown := 0.0
var is_boss := false
var sprite: AnimatedSprite2D

func configure(kind: String, min_x: float, max_x: float) -> void:
	enemy_type = kind
	patrol_min = min_x
	patrol_max = max_x
	if kind == "bat":
		max_hp = 24
		damage = 6
		speed = 130.0
		coins = 7
	elif kind == "guard":
		max_hp = 58
		damage = 11
		speed = 78.0
		coins = 13
	elif kind == "boss":
		max_hp = 160
		damage = 15
		speed = 72.0
		coins = 40
		is_boss = true
	hp = max_hp

func _ready() -> void:
	add_to_group("enemies")
	_build_visual()

func _physics_process(delta: float) -> void:
	if attack_cooldown > 0.0:
		attack_cooldown -= delta
	if not is_on_floor():
		velocity.y += GRAVITY * delta

	var desired := direction
	if target and abs(target.global_position.x - global_position.x) < 520.0 and abs(target.global_position.y - global_position.y) < 190.0:
		desired = sign(target.global_position.x - global_position.x)
		if desired == 0.0:
			desired = direction
		if global_position.distance_to(target.global_position) < (72.0 if is_boss else 48.0):
			_try_hit_player()
	else:
		if global_position.x < patrol_min:
			direction = 1.0
		elif global_position.x > patrol_max:
			direction = -1.0
		desired = direction

	velocity.x = desired * speed
	scale.x = abs(scale.x) * (1.0 if desired >= 0.0 else -1.0)
	if sprite and sprite.animation != "fly" and abs(velocity.x) > 1.0:
		sprite.play("walk")
	move_and_slide()

func take_damage(amount: int) -> void:
	hp -= amount
	effect_requested.emit("hit", global_position + Vector2(0, -32))
	modulate = Color("#ffef99")
	scale.y = 0.9
	var tween := create_tween()
	tween.tween_property(self, "modulate", Color.WHITE, 0.14)
	tween.parallel().tween_property(self, "scale:y", abs(scale.y) / max(abs(scale.y), 0.01), 0.16)
	if is_boss:
		GameState.boss_hp = max(0, hp)
	if hp <= 0:
		effect_requested.emit("defeat", global_position + Vector2(0, -28))
		defeated.emit(self)

func _try_hit_player() -> void:
	if attack_cooldown > 0.0:
		return
	attack_cooldown = 0.9 if not is_boss else 1.25
	if sprite:
		sprite.play("attack")
	if target and target.has_method("take_damage"):
		target.take_damage(damage)

func _build_visual() -> void:
	var size := 3.3
	if is_boss:
		size = 5.0
	sprite = AnimatedSprite2D.new()
	sprite.sprite_frames = _build_frames()
	sprite.animation = "fly" if enemy_type == "bat" else "walk"
	sprite.play()
	sprite.scale = Vector2(size, size)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(sprite)

	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(55 if not is_boss else 86, 90 if not is_boss else 128)
	collision.shape = shape
	collision.position = Vector2(0, -12 if not is_boss else -34)
	add_child(collision)

func _build_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	for anim in ["walk", "fly", "attack"]:
		frames.add_animation(anim)
		frames.set_animation_loop(anim, true)
		frames.set_animation_speed(anim, 6.0)
	for i in range(3):
		frames.add_frame("walk", _enemy_frame("walk", i))
		frames.add_frame("fly", _enemy_frame("fly", i))
		frames.add_frame("attack", _enemy_frame("attack", i))
	return frames

func _enemy_frame(pose: String, step: int) -> Texture2D:
	var body_color := Color("#78c85a")
	var shade := Color("#31543a")
	var eye := Color("#fff0a0")
	if enemy_type == "bat":
		body_color = Color("#9162d4")
		shade = Color("#50307d")
	elif enemy_type == "guard":
		body_color = Color("#bd6a47")
		shade = Color("#6a362c")
	elif enemy_type == "boss":
		body_color = Color("#d85a4f")
		shade = Color("#67283b")
	var bob := 0
	if enemy_type == "bat":
		bob = -1 if step == 1 else 1
	var foot: int = [-1, 1, 0][step]
	var weapon_len := 10 if pose != "attack" else 16
	return PixelArt.texture(36, 36, Color.TRANSPARENT, [
		{"x": 8, "y": 15 + bob, "w": 18, "h": 15, "color": body_color},
		{"x": 10, "y": 9 + bob, "w": 14, "h": 9, "color": body_color.lightened(0.12)},
		{"x": 8, "y": 27, "w": 6, "h": 5 + foot, "color": shade},
		{"x": 21, "y": 27, "w": 6, "h": 5 - foot, "color": shade},
		{"x": 12, "y": 13 + bob, "w": 3, "h": 3, "color": eye},
		{"x": 21, "y": 13 + bob, "w": 3, "h": 3, "color": eye},
		{"x": 24, "y": 18, "w": weapon_len, "h": 2, "color": Color("#d8d1bd")},
		{"x": 5, "y": 17 + bob, "w": 5, "h": 6, "color": shade},
		{"x": 25, "y": 17 + bob, "w": 5, "h": 6, "color": shade},
	])
