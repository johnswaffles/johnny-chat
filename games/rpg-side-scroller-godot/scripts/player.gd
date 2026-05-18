extends CharacterBody2D

signal request_attack(origin: Vector2, facing: int, damage: int)
signal died
signal effect_requested(kind: String, origin: Vector2)

const PixelArt = preload("res://scripts/pixel_art.gd")

const SPEED := 320.0
const JUMP_VELOCITY := -620.0
const GRAVITY := 1800.0

var facing := 1
var attack_timer := 0.0
var invuln_timer := 0.0
var body: Node2D
var sprite: AnimatedSprite2D
var was_on_floor := false

func _ready() -> void:
	add_to_group("player")
	_build_visual()

func _physics_process(delta: float) -> void:
	if attack_timer > 0.0:
		attack_timer -= delta
	if invuln_timer > 0.0:
		invuln_timer -= delta
		modulate = Color(1.0, 0.72, 0.72) if int(invuln_timer * 18.0) % 2 == 0 else Color.WHITE
	else:
		modulate = Color.WHITE

	var direction := 0.0
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		direction -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		direction += 1.0
	if direction != 0.0:
		facing = 1 if direction > 0.0 else -1
		body.scale.x = facing

	velocity.x = direction * SPEED
	var was_grounded := is_on_floor()
	if not is_on_floor():
		velocity.y += GRAVITY * delta
	elif Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		velocity.y = JUMP_VELOCITY
		effect_requested.emit("jump", global_position + Vector2(0, 44))

	if Input.is_key_pressed(KEY_J):
		try_attack()

	move_and_slide()
	if is_on_floor() and not was_grounded and velocity.y >= 0.0:
		effect_requested.emit("land", global_position + Vector2(0, 48))
	_update_animation(direction)

func try_attack() -> void:
	if attack_timer > 0.0:
		return
	attack_timer = 0.34
	request_attack.emit(global_position + Vector2(58.0 * facing, -18.0), facing, GameState.attack)
	_update_animation(0.0)

func take_damage(amount: int) -> void:
	if invuln_timer > 0.0 or GameState.level_complete:
		return
	var final_damage = max(1, amount - GameState.defense)
	GameState.hp = max(0, GameState.hp - final_damage)
	invuln_timer = 0.95
	velocity.x = -220.0 * facing
	velocity.y = -230.0
	effect_requested.emit("hurt", global_position)
	if GameState.hp <= 0:
		died.emit()

func _build_visual() -> void:
	body = Node2D.new()
	add_child(body)

	sprite = AnimatedSprite2D.new()
	sprite.sprite_frames = _build_frames()
	sprite.animation = "idle"
	sprite.play()
	sprite.scale = Vector2(3.6, 3.6)
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.position = Vector2(0, 1)
	body.add_child(sprite)

	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(44, 90)
	collision.shape = shape
	collision.position = Vector2(0, 2)
	add_child(collision)

func _build_frames() -> SpriteFrames:
	var frames := SpriteFrames.new()
	for anim in ["idle", "walk", "jump", "fall", "attack"]:
		frames.add_animation(anim)
		frames.set_animation_loop(anim, anim != "attack")
	frames.set_animation_speed("idle", 3.0)
	frames.set_animation_speed("walk", 8.0)
	frames.set_animation_speed("jump", 1.0)
	frames.set_animation_speed("fall", 1.0)
	frames.set_animation_speed("attack", 10.0)
	for i in range(2):
		frames.add_frame("idle", _hero_frame("idle", i))
	for i in range(4):
		frames.add_frame("walk", _hero_frame("walk", i))
	frames.add_frame("jump", _hero_frame("jump", 0))
	frames.add_frame("fall", _hero_frame("fall", 0))
	for i in range(3):
		frames.add_frame("attack", _hero_frame("attack", i))
	return frames

func _hero_frame(pose: String, step: int) -> Texture2D:
	var bob := 1 if pose == "idle" and step == 1 else 0
	var leg_shift := 0
	if pose == "walk":
		leg_shift = [-2, 0, 2, 0][step]
	var sword_y := 18
	var sword_w := 12
	if pose == "attack":
		sword_y = 12 - step * 2
		sword_w = 19 + step * 3
	var cape_color := Color("#b53b65")
	var blue := Color("#4777d3")
	var dark := Color("#172142")
	return PixelArt.texture(42, 42, Color.TRANSPARENT, [
		{"x": 5, "y": 35, "w": 20, "h": 3, "color": Color("#0d1022", 0.42)},
		{"x": 2, "y": 18 + bob, "w": 10, "h": 19, "color": cape_color},
		{"x": 9, "y": 15 + bob, "w": 16, "h": 16, "color": blue},
		{"x": 11, "y": 13 + bob, "w": 12, "h": 4, "color": Color("#6ca0ff")},
		{"x": 13 + leg_shift, "y": 30, "w": 5, "h": 7, "color": dark},
		{"x": 22 - leg_shift, "y": 30, "w": 5, "h": 7, "color": dark},
		{"x": 12, "y": 5 + bob, "w": 13, "h": 9, "color": Color("#ffd7a3")},
		{"x": 9, "y": 2 + bob, "w": 19, "h": 5, "color": Color("#dff5ff")},
		{"x": 10, "y": 7 + bob, "w": 18, "h": 3, "color": Color("#b7cce0")},
		{"x": 15, "y": 9 + bob, "w": 3, "h": 3, "color": Color("#263146")},
		{"x": 22, "y": 9 + bob, "w": 3, "h": 3, "color": Color("#263146")},
		{"x": 25, "y": sword_y, "w": sword_w, "h": 3, "color": Color("#eefaff")},
		{"x": 26, "y": sword_y - 1, "w": sword_w - 4, "h": 1, "color": Color("#75e8ff") if GameState.weapon_tier > 1 else Color("#fff2a6")},
		{"x": 23, "y": sword_y + 2, "w": 4, "h": 4, "color": Color("#f0c25e")},
	])

func _update_animation(direction: float) -> void:
	var next_anim := "idle"
	if attack_timer > 0.12:
		next_anim = "attack"
	elif not is_on_floor() and velocity.y < 0.0:
		next_anim = "jump"
	elif not is_on_floor():
		next_anim = "fall"
	elif abs(direction) > 0.1:
		next_anim = "walk"
	if sprite.animation != next_anim:
		sprite.play(next_anim)
	if next_anim == "attack":
		sprite.speed_scale = 1.0
	elif next_anim == "walk":
		sprite.speed_scale = 1.0 + min(abs(velocity.x) / SPEED, 1.0) * 0.18
	else:
		sprite.speed_scale = 1.0
