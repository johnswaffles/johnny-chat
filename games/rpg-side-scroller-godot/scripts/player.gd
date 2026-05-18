extends CharacterBody2D

signal request_attack(origin: Vector2, facing: int, damage: int)
signal died

const SPEED := 320.0
const JUMP_VELOCITY := -620.0
const GRAVITY := 1800.0

var facing := 1
var attack_timer := 0.0
var invuln_timer := 0.0
var body: Node2D
var sword: Polygon2D

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
	if not is_on_floor():
		velocity.y += GRAVITY * delta
	elif Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		velocity.y = JUMP_VELOCITY

	if Input.is_key_pressed(KEY_J):
		try_attack()

	move_and_slide()

func try_attack() -> void:
	if attack_timer > 0.0:
		return
	attack_timer = 0.34
	request_attack.emit(global_position + Vector2(58.0 * facing, -18.0), facing, GameState.attack)
	_flash_sword()

func take_damage(amount: int) -> void:
	if invuln_timer > 0.0 or GameState.level_complete:
		return
	var final_damage = max(1, amount - GameState.defense)
	GameState.hp = max(0, GameState.hp - final_damage)
	invuln_timer = 0.95
	velocity.x = -220.0 * facing
	velocity.y = -230.0
	if GameState.hp <= 0:
		died.emit()

func _build_visual() -> void:
	body = Node2D.new()
	add_child(body)

	var legs := Polygon2D.new()
	legs.polygon = PackedVector2Array([Vector2(-15, 28), Vector2(15, 28), Vector2(11, 48), Vector2(-11, 48)])
	legs.color = Color("#24365f")
	body.add_child(legs)

	var torso := Polygon2D.new()
	torso.polygon = PackedVector2Array([Vector2(-25, -18), Vector2(25, -18), Vector2(21, 30), Vector2(-21, 30)])
	torso.color = Color("#4b79d8")
	body.add_child(torso)

	var cape := Polygon2D.new()
	cape.polygon = PackedVector2Array([Vector2(-24, -10), Vector2(-50, 42), Vector2(-14, 32)])
	cape.color = Color("#b33a60")
	body.add_child(cape)

	var head := Polygon2D.new()
	head.polygon = PackedVector2Array([Vector2(-15, -44), Vector2(15, -44), Vector2(18, -18), Vector2(-18, -18)])
	head.color = Color("#ffd49a")
	body.add_child(head)

	var helm := Polygon2D.new()
	helm.polygon = PackedVector2Array([Vector2(-18, -51), Vector2(18, -51), Vector2(23, -35), Vector2(-23, -35)])
	helm.color = Color("#dcecff")
	body.add_child(helm)

	sword = Polygon2D.new()
	sword.polygon = PackedVector2Array([Vector2(24, -15), Vector2(79, -21), Vector2(84, -15), Vector2(30, -5)])
	sword.color = Color("#e8f8ff")
	body.add_child(sword)

	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(44, 90)
	collision.shape = shape
	collision.position = Vector2(0, 2)
	add_child(collision)

func _flash_sword() -> void:
	sword.color = Color("#fff2a6") if GameState.weapon_tier == 1 else Color("#72f8ff")
	var tween := create_tween()
	tween.tween_property(sword, "color", Color("#e8f8ff"), 0.18)
