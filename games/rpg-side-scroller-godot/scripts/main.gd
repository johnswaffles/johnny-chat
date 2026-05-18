extends Node2D

const PlayerScript = preload("res://scripts/player.gd")
const EnemyScript = preload("res://scripts/enemy.gd")
const FollowerScript = preload("res://scripts/follower.gd")

const LEVEL_WIDTH := 5400.0
const GROUND_Y := 660.0

var world: Node2D
var player: CharacterBody2D
var follower: Node2D
var camera: Camera2D
var enemies: Array = []
var coins: Array = []
var chests: Array = []
var traps: Array = []
var projectiles: Array = []
var cage: Node2D
var exit_portal: Node2D
var locked_door: Node2D
var boss: Node
var game_over := false
var message_timer := 0.0

var hp_bar: ProgressBar
var boss_bar: ProgressBar
var stats_label: Label
var hint_label: Label
var message_label: Label
var title_label: Label

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameState.reset_run()
	_build_level()
	_build_ui()
	_show_message("Towerblade RPG: rescue the mage, upgrade your blade, and break the tower gate.")

func _process(delta: float) -> void:
	if get_tree().paused:
		_update_ui()
		return
	if game_over:
		_update_camera(delta)
		return
	_update_camera(delta)
	_update_projectiles(delta)
	_update_pickups()
	_update_chests()
	_update_cage()
	_update_traps(delta)
	_update_exit()
	_update_ui()
	if message_timer > 0.0:
		message_timer -= delta
		if message_timer <= 0.0:
			message_label.text = ""

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE or event.keycode == KEY_P:
			_toggle_pause()
		elif event.keycode == KEY_K and follower:
			follower.try_cast(enemies)
		elif event.keycode == KEY_R and game_over:
			_restart()
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and player:
		player.try_attack()

func _build_level() -> void:
	world = Node2D.new()
	add_child(world)
	_build_background()
	_build_platforms()
	_build_decor()
	_spawn_player()
	_spawn_enemies()
	_spawn_treasures()
	_spawn_goal_objects()

func _build_background() -> void:
	_rect(world, Vector2(LEVEL_WIDTH * 0.5, 250), Vector2(LEVEL_WIDTH + 600, 1100), Color("#141127"), -60)
	_rect(world, Vector2(LEVEL_WIDTH * 0.5, 585), Vector2(LEVEL_WIDTH + 600, 260), Color("#231b2f"), -50)
	for i in range(9):
		var x := float(i) * 680.0 - 80.0
		_rect(world, Vector2(x + 220, 355), Vector2(360, 390), Color("#211b34"), -45)
		_rect(world, Vector2(x + 220, 170), Vector2(420, 42), Color("#30213c"), -44)
		for w in range(3):
			_rect(world, Vector2(x + 95 + float(w) * 118.0, 285), Vector2(38, 86), Color("#f2af59", 0.28), -43)
	for i in range(16):
		var x2 := float(i) * 360.0
		_rect(world, Vector2(x2, 115), Vector2(180, 20), Color("#70445a", 0.26), -42)
		_rect(world, Vector2(x2 + 95, 132), Vector2(18, 120), Color("#70445a", 0.2), -42)

func _build_platforms() -> void:
	_static_rect(Vector2(LEVEL_WIDTH * 0.5, GROUND_Y + 55), Vector2(LEVEL_WIDTH + 600, 120), Color("#4b3f48"))
	_static_rect(Vector2(780, 520), Vector2(420, 34), Color("#63515b"))
	_static_rect(Vector2(1330, 430), Vector2(300, 34), Color("#63515b"))
	_static_rect(Vector2(1980, 535), Vector2(500, 34), Color("#63515b"))
	_static_rect(Vector2(2680, 455), Vector2(430, 34), Color("#63515b"))
	_static_rect(Vector2(3340, 545), Vector2(420, 34), Color("#63515b"))
	_static_rect(Vector2(4240, 505), Vector2(520, 34), Color("#63515b"))

func _build_decor() -> void:
	for x in [340, 920, 1510, 2160, 2810, 3470, 4120, 4840]:
		_torch(Vector2(x, GROUND_Y - 132))
	for x in [540, 1780, 3100, 4580]:
		_banner(Vector2(x, GROUND_Y - 210))

func _spawn_player() -> void:
	player = PlayerScript.new()
	player.global_position = Vector2(145, GROUND_Y - 120)
	player.request_attack.connect(_on_player_attack)
	player.died.connect(_on_player_died)
	world.add_child(player)

	camera = Camera2D.new()
	camera.zoom = Vector2(0.82, 0.82)
	camera.limit_left = -80
	camera.limit_right = int(LEVEL_WIDTH + 180)
	camera.limit_top = -260
	camera.limit_bottom = 900
	camera.position_smoothing_enabled = true
	camera.position_smoothing_speed = 6.0
	add_child(camera)
	camera.make_current()

func _spawn_enemies() -> void:
	_add_enemy("goblin", Vector2(680, GROUND_Y - 95), 500, 910)
	_add_enemy("bat", Vector2(1260, 360), 1110, 1500)
	_add_enemy("guard", Vector2(1780, GROUND_Y - 95), 1600, 2050)
	_add_enemy("goblin", Vector2(2550, GROUND_Y - 95), 2390, 2850)
	_add_enemy("bat", Vector2(3200, 480), 3040, 3500)
	_add_enemy("guard", Vector2(3860, GROUND_Y - 95), 3660, 4080)
	boss = _add_enemy("boss", Vector2(4740, GROUND_Y - 135), 4500, 5040)

func _spawn_treasures() -> void:
	_add_coin(Vector2(520, GROUND_Y - 95))
	_add_coin(Vector2(585, GROUND_Y - 95))
	_add_coin(Vector2(830, 455))
	_add_coin(Vector2(1390, 365))
	_add_chest(Vector2(1040, GROUND_Y - 86), "coins")
	_add_chest(Vector2(2140, 470), "key")
	_add_chest(Vector2(2860, 390), "upgrade")
	_add_chest(Vector2(4050, 440), "coins")

func _spawn_goal_objects() -> void:
	cage = Node2D.new()
	cage.global_position = Vector2(1560, GROUND_Y - 95)
	world.add_child(cage)
	_rect(cage, Vector2.ZERO, Vector2(76, 92), Color("#2a394b", 0.9), 1)
	for x in [-26, -9, 9, 26]:
		_rect(cage, Vector2(x, 0), Vector2(5, 88), Color("#9fbad1"), 2)
	_rect(cage, Vector2(0, -54), Vector2(92, 9), Color("#d6e8f8"), 3)
	_label_world(cage, "MAGE", Vector2(-34, -85), 18, Color("#dff8ff"))

	locked_door = Node2D.new()
	locked_door.global_position = Vector2(3560, GROUND_Y - 105)
	world.add_child(locked_door)
	_static_rect(Vector2(3560, GROUND_Y - 85), Vector2(48, 170), Color("#2b2230"), 4)
	_rect(locked_door, Vector2.ZERO, Vector2(70, 170), Color("#5d3a28"), 6)
	_rect(locked_door, Vector2(0, -58), Vector2(54, 20), Color("#f3c060"), 7)
	_label_world(locked_door, "KEY GATE", Vector2(-51, -118), 18, Color("#fff0bd"))

	exit_portal = Node2D.new()
	exit_portal.global_position = Vector2(5220, GROUND_Y - 130)
	world.add_child(exit_portal)
	for i in range(4):
		var ring := Polygon2D.new()
		var radius := 40.0 + float(i) * 15.0
		var points := PackedVector2Array()
		for a in range(18):
			var angle := TAU * float(a) / 18.0
			points.append(Vector2(cos(angle), sin(angle)) * radius)
		ring.polygon = points
		ring.color = Color(0.28, 0.86, 1.0, 0.08 + float(i) * 0.04)
		exit_portal.add_child(ring)
	_label_world(exit_portal, "EXIT", Vector2(-28, -118), 20, Color("#bdf6ff"))

	traps.append(_spikes(Vector2(1160, GROUND_Y - 48), 150))
	traps.append(_spikes(Vector2(3035, GROUND_Y - 48), 170))

func _add_enemy(kind: String, pos: Vector2, min_x: float, max_x: float) -> Node:
	var enemy = EnemyScript.new()
	enemy.configure(kind, min_x, max_x)
	enemy.global_position = pos
	enemy.target = player
	enemy.defeated.connect(_on_enemy_defeated)
	world.add_child(enemy)
	enemies.append(enemy)
	return enemy

func _add_coin(pos: Vector2) -> void:
	var coin := Node2D.new()
	coin.global_position = pos
	coin.set_meta("value", 5)
	world.add_child(coin)
	_rect(coin, Vector2.ZERO, Vector2(22, 22), Color("#ffd45d"), 4)
	_rect(coin, Vector2.ZERO, Vector2(11, 22), Color("#fff1a6"), 5)
	coins.append(coin)

func _add_chest(pos: Vector2, kind: String) -> void:
	var chest := Node2D.new()
	chest.global_position = pos
	chest.set_meta("kind", kind)
	chest.set_meta("opened", false)
	world.add_child(chest)
	_rect(chest, Vector2.ZERO, Vector2(72, 42), Color("#8b542f"), 3)
	_rect(chest, Vector2(0, -17), Vector2(78, 16), Color("#c4863b"), 4)
	_rect(chest, Vector2.ZERO, Vector2(14, 44), Color("#f2c35d"), 5)
	chests.append(chest)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var panel := ColorRect.new()
	panel.color = Color(0.03, 0.025, 0.045, 0.78)
	panel.position = Vector2(22, 22)
	panel.size = Vector2(430, 148)
	layer.add_child(panel)

	title_label = _ui_label(layer, "TOWERBLADE RPG", Vector2(40, 34), 26, Color("#fff2c8"))
	stats_label = _ui_label(layer, "", Vector2(40, 72), 20, Color("#e8f8ff"))
	hint_label = _ui_label(layer, "Move A/D or arrows  |  Jump Space/W  |  Attack J/click  |  Mage K", Vector2(40, 128), 17, Color("#a9c6dc"))

	hp_bar = ProgressBar.new()
	hp_bar.position = Vector2(40, 101)
	hp_bar.size = Vector2(360, 18)
	hp_bar.max_value = GameState.max_hp
	hp_bar.value = GameState.hp
	layer.add_child(hp_bar)

	boss_bar = ProgressBar.new()
	boss_bar.position = Vector2(520, 32)
	boss_bar.size = Vector2(520, 20)
	boss_bar.max_value = GameState.boss_max_hp
	boss_bar.value = GameState.boss_hp
	boss_bar.visible = false
	layer.add_child(boss_bar)
	_ui_label(layer, "BOSS", Vector2(462, 28), 18, Color("#ffb3a8"))

	message_label = _ui_label(layer, "", Vector2(470, 70), 22, Color("#fff6c8"))

func _update_ui() -> void:
	hp_bar.max_value = GameState.max_hp
	hp_bar.value = GameState.hp
	stats_label.text = "HP %d/%d   ATK %d   Coins %d   Keys %d   Blade T%d" % [GameState.hp, GameState.max_hp, GameState.attack, GameState.coins, GameState.keys, GameState.weapon_tier]
	var follower_text := "Mage ready: K" if GameState.follower_rescued else "Rescue the mage follower"
	hint_label.text = "%s  |  Boss waits near the exit  |  R restarts after defeat/clear" % follower_text
	boss_bar.visible = boss and is_instance_valid(boss) and boss.hp > 0 and player.global_position.x > 4100
	boss_bar.value = GameState.boss_hp
	if get_tree().paused:
		message_label.text = "PAUSED - press P or Esc to continue"

func _update_camera(delta: float) -> void:
	if not player:
		return
	var target := player.global_position + Vector2(390, -140)
	camera.global_position = camera.global_position.lerp(target, min(1.0, delta * 4.0))

func _update_projectiles(delta: float) -> void:
	for projectile in projectiles.duplicate():
		if not is_instance_valid(projectile.node):
			projectiles.erase(projectile)
			continue
		projectile.node.global_position += projectile.velocity * delta
		projectile.life -= delta
		for enemy in enemies.duplicate():
			if is_instance_valid(enemy) and projectile.node.global_position.distance_to(enemy.global_position) < 45.0:
				enemy.take_damage(projectile.damage)
				projectile.node.queue_free()
				projectiles.erase(projectile)
				break
		if projectile.life <= 0.0 and is_instance_valid(projectile.node):
			projectile.node.queue_free()
			projectiles.erase(projectile)

func _update_pickups() -> void:
	for coin in coins.duplicate():
		if is_instance_valid(coin) and player.global_position.distance_to(coin.global_position) < 56.0:
			GameState.add_coins(int(coin.get_meta("value")))
			_show_message("+%d coins" % int(coin.get_meta("value")), 1.2)
			coin.queue_free()
			coins.erase(coin)

func _update_chests() -> void:
	for chest in chests:
		if not is_instance_valid(chest) or bool(chest.get_meta("opened")):
			continue
		if player.global_position.distance_to(chest.global_position) < 92.0:
			chest.set_meta("opened", true)
			var kind := String(chest.get_meta("kind"))
			if kind == "key":
				GameState.add_key()
				_show_message("You found a tower key.")
			elif kind == "upgrade":
				GameState.add_coins(35)
				if GameState.upgrade_weapon():
					_show_message("Blade upgraded! Your strikes hit harder.")
				else:
					_show_message("You found upgrade coins.")
			else:
				GameState.add_coins(20)
				_show_message("Treasure chest: +20 coins.")
			_rect(chest, Vector2(0, -34), Vector2(82, 10), Color("#fff0a6"), 8)
	if locked_door and is_instance_valid(locked_door) and player.global_position.distance_to(locked_door.global_position) < 115.0:
		if GameState.keys > 0:
			GameState.keys -= 1
			_show_message("The key gate opens.")
			locked_door.queue_free()
			locked_door = null
		else:
			_show_message("A key opens this tower gate.", 1.0)

func _update_cage() -> void:
	if not cage or GameState.follower_rescued:
		return
	if player.global_position.distance_to(cage.global_position) < 96.0:
		GameState.follower_rescued = true
		_show_message("Mage rescued! Press K to cast a follower bolt.")
		follower = FollowerScript.new()
		follower.global_position = player.global_position + Vector2(-85, -40)
		follower.target = player
		follower.cast_projectile.connect(_spawn_projectile)
		world.add_child(follower)
		cage.queue_free()
		cage = null

func _update_traps(delta: float) -> void:
	for trap in traps:
		if not is_instance_valid(trap.node):
			continue
		trap.cooldown = max(0.0, trap.cooldown - delta)
		if trap.cooldown <= 0.0 and player.global_position.distance_to(trap.node.global_position) < trap.radius:
			trap.cooldown = 0.7
			player.take_damage(10)
			_show_message("Spikes!", 0.7)

func _update_exit() -> void:
	if GameState.level_complete:
		return
	if boss and is_instance_valid(boss) and boss.hp > 0:
		return
	if exit_portal and player.global_position.distance_to(exit_portal.global_position) < 120.0:
		GameState.level_complete = true
		game_over = true
		_show_message("Level clear! Towerblade RPG prototype complete. Press R to restart.", 999.0)

func _on_player_attack(origin: Vector2, facing: int, damage: int) -> void:
	_attack_flash(origin, facing)
	for enemy in enemies.duplicate():
		if not is_instance_valid(enemy):
			continue
		var within_x: bool = abs(enemy.global_position.x - origin.x) < (92.0 if GameState.weapon_tier == 1 else 118.0)
		var within_y: bool = abs(enemy.global_position.y - origin.y) < 110.0
		var in_front: bool = sign(enemy.global_position.x - player.global_position.x) == facing or abs(enemy.global_position.x - player.global_position.x) < 35.0
		if within_x and within_y and in_front:
			enemy.take_damage(damage)

func _on_enemy_defeated(enemy: Node) -> void:
	GameState.add_coins(enemy.coins)
	if enemy.is_boss:
		_show_message("The tower captain falls. Reach the exit portal.")
	else:
		_show_message("+%d coins" % enemy.coins, 1.1)
	enemies.erase(enemy)
	enemy.queue_free()

func _on_player_died() -> void:
	game_over = true
	_show_message("You fell in the tower. Press R to restart.", 999.0)

func _spawn_projectile(origin: Vector2, velocity: Vector2, damage: int) -> void:
	var bolt := Polygon2D.new()
	bolt.global_position = origin
	bolt.polygon = PackedVector2Array([Vector2(0, -8), Vector2(26, 0), Vector2(0, 8), Vector2(-26, 0)])
	bolt.color = Color("#6df6ff")
	bolt.z_index = 20
	world.add_child(bolt)
	projectiles.append({"node": bolt, "velocity": velocity, "damage": damage, "life": 1.4})

func _toggle_pause() -> void:
	if game_over:
		return
	get_tree().paused = not get_tree().paused
	if not get_tree().paused:
		message_label.text = ""

func _restart() -> void:
	get_tree().paused = false
	get_tree().reload_current_scene()

func _show_message(text: String, seconds: float = 2.5) -> void:
	message_label.text = text
	message_timer = seconds

func _static_rect(center: Vector2, size: Vector2, color: Color, z := 0) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.global_position = center
	body.z_index = z
	world.add_child(body)
	var shape := RectangleShape2D.new()
	shape.size = size
	var collision := CollisionShape2D.new()
	collision.shape = shape
	body.add_child(collision)
	_rect(body, Vector2.ZERO, size, color, z)
	return body

func _rect(parent: Node, center: Vector2, size: Vector2, color: Color, z := 0) -> Polygon2D:
	var rect := Polygon2D.new()
	var half := size * 0.5
	rect.position = center
	rect.polygon = PackedVector2Array([Vector2(-half.x, -half.y), Vector2(half.x, -half.y), Vector2(half.x, half.y), Vector2(-half.x, half.y)])
	rect.color = color
	rect.z_index = z
	parent.add_child(rect)
	return rect

func _torch(pos: Vector2) -> void:
	var torch := Node2D.new()
	torch.global_position = pos
	world.add_child(torch)
	_rect(torch, Vector2(0, 35), Vector2(10, 70), Color("#4e3328"), 5)
	_rect(torch, Vector2(0, -5), Vector2(28, 16), Color("#93623a"), 6)
	var flame := Polygon2D.new()
	flame.polygon = PackedVector2Array([Vector2(0, -46), Vector2(23, -9), Vector2(0, 22), Vector2(-23, -9)])
	flame.color = Color("#ffb347")
	flame.z_index = 7
	torch.add_child(flame)
	var glow := Polygon2D.new()
	glow.polygon = PackedVector2Array([Vector2(0, -78), Vector2(70, -12), Vector2(0, 60), Vector2(-70, -12)])
	glow.color = Color(1.0, 0.62, 0.22, 0.12)
	glow.z_index = 4
	torch.add_child(glow)

func _banner(pos: Vector2) -> void:
	var banner := Node2D.new()
	banner.global_position = pos
	world.add_child(banner)
	_rect(banner, Vector2(0, 0), Vector2(72, 115), Color("#843653"), 2)
	var notch := Polygon2D.new()
	notch.polygon = PackedVector2Array([Vector2(-36, 58), Vector2(0, 34), Vector2(36, 58), Vector2(36, 70), Vector2(-36, 70)])
	notch.color = Color("#141127")
	notch.z_index = 3
	banner.add_child(notch)

func _spikes(pos: Vector2, radius: float) -> Dictionary:
	var node := Node2D.new()
	node.global_position = pos
	world.add_child(node)
	for i in range(6):
		var spike := Polygon2D.new()
		var x := -65.0 + float(i) * 26.0
		spike.polygon = PackedVector2Array([Vector2(x - 12, 22), Vector2(x, -28), Vector2(x + 12, 22)])
		spike.color = Color("#c7d8df")
		spike.z_index = 5
		node.add_child(spike)
	return {"node": node, "radius": radius, "cooldown": 0.0}

func _attack_flash(origin: Vector2, facing: int) -> void:
	var slash := Polygon2D.new()
	slash.global_position = origin
	slash.polygon = PackedVector2Array([Vector2(0, -35), Vector2(88 * facing, -8), Vector2(88 * facing, 24), Vector2(0, 38)])
	slash.color = Color(0.95, 1.0, 0.55, 0.5)
	slash.z_index = 25
	world.add_child(slash)
	var tween := create_tween()
	tween.tween_property(slash, "modulate:a", 0.0, 0.16)
	tween.tween_callback(slash.queue_free)

func _label_world(parent: Node, text: String, pos: Vector2, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.z_index = 30
	parent.add_child(label)
	return label

func _ui_label(parent: Node, text: String, pos: Vector2, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label
