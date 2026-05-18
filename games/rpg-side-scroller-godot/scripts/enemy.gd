extends CharacterBody2D

signal defeated(enemy: Node)

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
	move_and_slide()

func take_damage(amount: int) -> void:
	hp -= amount
	modulate = Color("#ffef99")
	var tween := create_tween()
	tween.tween_property(self, "modulate", Color.WHITE, 0.14)
	if is_boss:
		GameState.boss_hp = max(0, hp)
	if hp <= 0:
		defeated.emit(self)

func _try_hit_player() -> void:
	if attack_cooldown > 0.0:
		return
	attack_cooldown = 0.9 if not is_boss else 1.25
	if target and target.has_method("take_damage"):
		target.take_damage(damage)

func _build_visual() -> void:
	var size := 1.0
	if is_boss:
		size = 1.8
	scale = Vector2(size, size)

	var body_color := Color("#7fc95b")
	if enemy_type == "bat":
		body_color = Color("#9859c8")
	elif enemy_type == "guard":
		body_color = Color("#b45d45")
	elif enemy_type == "boss":
		body_color = Color("#d65a4a")

	var body := Polygon2D.new()
	body.polygon = PackedVector2Array([Vector2(-24, -36), Vector2(24, -36), Vector2(30, 26), Vector2(-30, 26)])
	body.color = body_color
	add_child(body)

	var head := Polygon2D.new()
	head.polygon = PackedVector2Array([Vector2(-17, -64), Vector2(17, -64), Vector2(20, -36), Vector2(-20, -36)])
	head.color = body_color.lightened(0.14)
	add_child(head)

	var eye_l := Polygon2D.new()
	eye_l.polygon = PackedVector2Array([Vector2(-10, -53), Vector2(-4, -53), Vector2(-4, -47), Vector2(-10, -47)])
	eye_l.color = Color("#fff4bd")
	add_child(eye_l)

	var eye_r := Polygon2D.new()
	eye_r.polygon = PackedVector2Array([Vector2(5, -53), Vector2(11, -53), Vector2(11, -47), Vector2(5, -47)])
	eye_r.color = Color("#fff4bd")
	add_child(eye_r)

	if enemy_type == "bat":
		var wing_l := Polygon2D.new()
		wing_l.polygon = PackedVector2Array([Vector2(-24, -28), Vector2(-62, -52), Vector2(-42, -12)])
		wing_l.color = Color("#6c3e98")
		add_child(wing_l)
		var wing_r := Polygon2D.new()
		wing_r.polygon = PackedVector2Array([Vector2(24, -28), Vector2(62, -52), Vector2(42, -12)])
		wing_r.color = Color("#6c3e98")
		add_child(wing_r)
	else:
		var weapon := Polygon2D.new()
		weapon.polygon = PackedVector2Array([Vector2(26, -26), Vector2(66, -31), Vector2(68, -25), Vector2(28, -17)])
		weapon.color = Color("#ded6c0")
		add_child(weapon)

	var collision := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(55, 90)
	collision.shape = shape
	collision.position = Vector2(0, -12)
	add_child(collision)
