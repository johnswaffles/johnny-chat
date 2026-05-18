extends Node2D

const PlayerScript = preload("res://scripts/player.gd")
const EnemyScript = preload("res://scripts/enemy.gd")
const FollowerScript = preload("res://scripts/follower.gd")
const PixelArt = preload("res://scripts/pixel_art.gd")

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
var parallax_layers: Array = []
var pixel_textures := {}
var shake_timer := 0.0
var shake_strength := 0.0

var hp_fill: ColorRect
var boss_group: Node2D
var boss_fill: ColorRect
var boss_panel: ColorRect
var stats_label: Label
var hint_label: Label
var message_label: Label
var title_label: Label
var pause_panel: ColorRect
var fade_rect: ColorRect

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameState.reset_run()
	_build_pixel_assets()
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

func _build_pixel_assets() -> void:
	pixel_textures.grass_top = PixelArt.texture(16, 16, Color("#6fbf5f"), [
		{"x": 0, "y": 0, "w": 16, "h": 3, "color": Color("#b8ec79")},
		{"x": 1, "y": 3, "w": 3, "h": 2, "color": Color("#e1f69b")},
		{"x": 7, "y": 2, "w": 2, "h": 3, "color": Color("#e1f69b")},
		{"x": 12, "y": 3, "w": 3, "h": 2, "color": Color("#4ea84c")},
		{"x": 0, "y": 8, "w": 16, "h": 8, "color": Color("#7b5a3a")},
		{"x": 2, "y": 10, "w": 3, "h": 2, "color": Color("#9a7045")},
		{"x": 9, "y": 12, "w": 2, "h": 2, "color": Color("#523c30")},
	])
	pixel_textures.stone_top = PixelArt.texture(16, 16, Color("#5c5261"), [
		{"x": 0, "y": 0, "w": 16, "h": 4, "color": Color("#8a7f87")},
		{"x": 0, "y": 4, "w": 16, "h": 12, "color": Color("#4b424d")},
		{"x": 1, "y": 6, "w": 5, "h": 2, "color": Color("#665b65")},
		{"x": 8, "y": 10, "w": 6, "h": 2, "color": Color("#372f39")},
		{"x": 3, "y": 13, "w": 3, "h": 2, "color": Color("#6d626c")},
	])
	pixel_textures.flower = PixelArt.texture(12, 12, Color.TRANSPARENT, [
		{"x": 5, "y": 5, "w": 2, "h": 7, "color": Color("#4ea84c")},
		{"x": 3, "y": 2, "w": 3, "h": 3, "color": Color("#ff84b6")},
		{"x": 6, "y": 1, "w": 3, "h": 3, "color": Color("#ffe174")},
		{"x": 6, "y": 4, "w": 3, "h": 3, "color": Color("#ff84b6")},
	])
	pixel_textures.bush = PixelArt.texture(18, 12, Color.TRANSPARENT, [
		{"x": 1, "y": 6, "w": 16, "h": 5, "color": Color("#316f45")},
		{"x": 3, "y": 3, "w": 6, "h": 5, "color": Color("#4fa85e")},
		{"x": 9, "y": 2, "w": 7, "h": 6, "color": Color("#66bf73")},
		{"x": 12, "y": 7, "w": 2, "h": 2, "color": Color("#dff5a1")},
	])
	pixel_textures.sign = PixelArt.texture(22, 18, Color.TRANSPARENT, [
		{"x": 10, "y": 8, "w": 3, "h": 10, "color": Color("#6b492f")},
		{"x": 2, "y": 1, "w": 18, "h": 9, "color": Color("#b9854b")},
		{"x": 4, "y": 4, "w": 12, "h": 2, "color": Color("#5a3829")},
	])
	pixel_textures.crystal = PixelArt.texture(16, 22, Color.TRANSPARENT, [
		{"x": 7, "y": 0, "w": 3, "h": 3, "color": Color("#d6fbff")},
		{"x": 4, "y": 3, "w": 9, "h": 15, "color": Color("#66e4ff")},
		{"x": 7, "y": 4, "w": 3, "h": 13, "color": Color("#bdf8ff")},
		{"x": 5, "y": 18, "w": 7, "h": 3, "color": Color("#228dc9")},
	])
	pixel_textures.coin = PixelArt.texture(12, 12, Color.TRANSPARENT, [
		{"x": 3, "y": 1, "w": 6, "h": 10, "color": Color("#f5b83f")},
		{"x": 4, "y": 2, "w": 3, "h": 8, "color": Color("#fff0a6")},
		{"x": 7, "y": 3, "w": 2, "h": 6, "color": Color("#d68822")},
	])
	pixel_textures.chest = PixelArt.texture(24, 18, Color.TRANSPARENT, [
		{"x": 1, "y": 7, "w": 22, "h": 10, "color": Color("#7a472b")},
		{"x": 2, "y": 3, "w": 20, "h": 6, "color": Color("#c4863b")},
		{"x": 10, "y": 3, "w": 4, "h": 14, "color": Color("#f2c35d")},
		{"x": 0, "y": 8, "w": 24, "h": 2, "color": Color("#3a2630")},
	])
	pixel_textures.bolt = PixelArt.texture(18, 8, Color.TRANSPARENT, [
		{"x": 0, "y": 3, "w": 18, "h": 2, "color": Color("#6df6ff")},
		{"x": 5, "y": 1, "w": 8, "h": 6, "color": Color("#bdfdff")},
	])

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
	var sky := _parallax_layer(0.15, -90)
	_rect(sky, Vector2(LEVEL_WIDTH * 0.5, 250), Vector2(LEVEL_WIDTH + 1400, 1100), Color("#16142d"), -90)
	_rect(sky, Vector2(LEVEL_WIDTH * 0.5, 625), Vector2(LEVEL_WIDTH + 1400, 210), Color("#2b2334"), -89)
	for i in range(14):
		var x := float(i) * 460.0 - 300.0
		var mountain := Polygon2D.new()
		mountain.polygon = PackedVector2Array([Vector2(x, 520), Vector2(x + 250, 230), Vector2(x + 520, 520)])
		mountain.color = Color("#25334e")
		mountain.z_index = -88
		sky.add_child(mountain)
		var ridge := Polygon2D.new()
		ridge.polygon = PackedVector2Array([Vector2(x + 250, 230), Vector2(x + 330, 520), Vector2(x + 188, 520)])
		ridge.color = Color("#33476b")
		ridge.z_index = -87
		sky.add_child(ridge)

	var trees := _parallax_layer(0.32, -80)
	for i in range(26):
		var tx := float(i) * 235.0 - 220.0
		_tree(trees, Vector2(tx, 560), 0.78 + float(i % 3) * 0.12, -80)

	var ruins := _parallax_layer(0.58, -70)
	for i in range(10):
		var rx := float(i) * 650.0 - 120.0
		_rect(ruins, Vector2(rx + 220, 374), Vector2(345, 320), Color("#211d33"), -70)
		_rect(ruins, Vector2(rx + 220, 202), Vector2(420, 42), Color("#342842"), -69)
		for w in range(3):
			_rect(ruins, Vector2(rx + 94 + float(w) * 112.0, 315), Vector2(34, 72), Color("#f2af59", 0.24), -68)
			_rect(ruins, Vector2(rx + 94 + float(w) * 112.0, 362), Vector2(34, 8), Color("#ffe8a3", 0.18), -67)

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
	for x in [720, 2450, 3710, 4960]:
		var crystal := _pixel_prop(world, "crystal", Vector2(x, GROUND_Y - 76), 9, 3.0)
		_sparkle_loop(crystal)
	for i in range(18):
		_firefly(Vector2(float(i) * 285.0 + 190.0, 310.0 + float((i * 37) % 180)))

func _spawn_player() -> void:
	player = PlayerScript.new()
	player.global_position = Vector2(145, GROUND_Y - 120)
	player.request_attack.connect(_on_player_attack)
	player.died.connect(_on_player_died)
	player.effect_requested.connect(_on_effect_requested)
	world.add_child(player)

	camera = Camera2D.new()
	camera.zoom = Vector2(0.82, 0.82)
	camera.limit_left = -80
	camera.limit_right = int(LEVEL_WIDTH + 180)
	camera.limit_top = -260
	camera.limit_bottom = 900
	camera.position_smoothing_enabled = false
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
	enemy.effect_requested.connect(_on_effect_requested)
	world.add_child(enemy)
	enemies.append(enemy)
	return enemy

func _add_coin(pos: Vector2) -> void:
	var coin := Node2D.new()
	coin.global_position = pos
	coin.set_meta("value", 5)
	world.add_child(coin)
	var sprite := PixelArt.sprite(pixel_textures.coin, 3.0)
	sprite.z_index = 8
	coin.add_child(sprite)
	_sparkle_loop(coin)
	coins.append(coin)

func _add_chest(pos: Vector2, kind: String) -> void:
	var chest := Node2D.new()
	chest.global_position = pos
	chest.set_meta("kind", kind)
	chest.set_meta("opened", false)
	world.add_child(chest)
	var sprite := PixelArt.sprite(pixel_textures.chest, 3.2)
	sprite.z_index = 7
	chest.add_child(sprite)
	chests.append(chest)

func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)

	var panel := ColorRect.new()
	panel.color = Color(0.025, 0.022, 0.04, 0.88)
	panel.position = Vector2(22, 22)
	panel.size = Vector2(430, 148)
	layer.add_child(panel)
	_pixel_border(layer, Rect2(panel.position, panel.size), Color("#f2c35d", 0.85))

	title_label = _ui_label(layer, "TOWERBLADE RPG", Vector2(40, 34), 26, Color("#fff2c8"))
	stats_label = _ui_label(layer, "", Vector2(40, 72), 20, Color("#e8f8ff"))
	hint_label = _ui_label(layer, "Move A/D or arrows  |  Jump Space/W  |  Attack J/click  |  Mage K", Vector2(40, 128), 17, Color("#a9c6dc"))

	_pixel_bar(layer, Vector2(40, 101), Vector2(360, 18), Color("#331928"), Color("#ff5d73"), "hp")

	boss_group = Node2D.new()
	boss_group.position = Vector2(462, 28)
	boss_group.visible = false
	layer.add_child(boss_group)
	_ui_label(boss_group, "BOSS", Vector2(0, 0), 18, Color("#ffb3a8"))
	boss_panel = ColorRect.new()
	boss_panel.position = Vector2(58, 4)
	boss_panel.size = Vector2(520, 20)
	boss_panel.color = Color("#2a1420")
	boss_group.add_child(boss_panel)
	boss_fill = ColorRect.new()
	boss_fill.position = boss_panel.position + Vector2(3, 3)
	boss_fill.size = Vector2(514, 14)
	boss_fill.color = Color("#d85a4f")
	boss_group.add_child(boss_fill)
	_pixel_border(boss_group, Rect2(boss_panel.position, boss_panel.size), Color("#ffb3a8"))

	message_label = _ui_label(layer, "", Vector2(470, 70), 22, Color("#fff6c8"))

	pause_panel = ColorRect.new()
	pause_panel.color = Color(0.02, 0.018, 0.032, 0.92)
	pause_panel.position = Vector2(520, 210)
	pause_panel.size = Vector2(560, 220)
	pause_panel.visible = false
	layer.add_child(pause_panel)
	_pixel_border(pause_panel, Rect2(Vector2.ZERO, pause_panel.size), Color("#72e6ff"))
	_ui_label(pause_panel, "PAUSED", Vector2(210, 42), 38, Color("#fff2c8"))
	_ui_label(pause_panel, "Press P or Esc to continue", Vector2(126, 112), 22, Color("#bdf6ff"))

	fade_rect = ColorRect.new()
	fade_rect.color = Color(0, 0, 0, 1)
	fade_rect.size = Vector2(2400, 1400)
	fade_rect.position = Vector2(-200, -200)
	layer.add_child(fade_rect)
	var fade_tween := create_tween()
	fade_tween.tween_property(fade_rect, "color:a", 0.0, 0.8)

func _update_ui() -> void:
	hp_fill.size.x = 354.0 * clamp(float(GameState.hp) / float(GameState.max_hp), 0.0, 1.0)
	stats_label.text = "HP %d/%d   ATK %d   Coins %d   Keys %d   Blade T%d" % [GameState.hp, GameState.max_hp, GameState.attack, GameState.coins, GameState.keys, GameState.weapon_tier]
	var follower_text := "Mage ready: K" if GameState.follower_rescued else "Rescue the mage follower"
	hint_label.text = "%s  |  Boss waits near the exit  |  R restarts after defeat/clear" % follower_text
	var show_boss: bool = boss != null and is_instance_valid(boss) and boss.hp > 0 and player.global_position.x > 4100
	boss_group.visible = show_boss
	boss_fill.size.x = 514.0 * clamp(float(GameState.boss_hp) / float(GameState.boss_max_hp), 0.0, 1.0)
	pause_panel.visible = get_tree().paused
	if get_tree().paused:
		message_label.text = "PAUSED - press P or Esc to continue"

func _update_camera(delta: float) -> void:
	if not player:
		return
	var target := player.global_position + Vector2(390, -140)
	camera.global_position = camera.global_position.lerp(target, min(1.0, delta * 8.0)).round()
	if shake_timer > 0.0:
		shake_timer -= delta
		camera.offset = Vector2(randf_range(-shake_strength, shake_strength), randf_range(-shake_strength, shake_strength)).round()
		if shake_timer <= 0.0:
			camera.offset = Vector2.ZERO
	for layer in parallax_layers:
		layer.node.global_position.x = round(camera.global_position.x * layer.factor)

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
			_on_effect_requested("sparkle", coin.global_position)
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
		_camera_shake(0.35, 7.0)
	else:
		_show_message("+%d coins" % enemy.coins, 1.1)
	enemies.erase(enemy)
	enemy.queue_free()

func _on_player_died() -> void:
	game_over = true
	_camera_shake(0.45, 8.0)
	_show_message("You fell in the tower. Press R to restart.", 999.0)

func _spawn_projectile(origin: Vector2, velocity: Vector2, damage: int) -> void:
	var bolt := PixelArt.sprite(pixel_textures.bolt, 3.0)
	bolt.global_position = origin
	bolt.rotation = velocity.angle()
	bolt.z_index = 20
	bolt.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
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

func _on_effect_requested(kind: String, origin: Vector2) -> void:
	if kind == "land":
		for i in range(7):
			_pixel_particle(origin + Vector2(randf_range(-22, 22), 0), Color("#d8b783"), Vector2(randf_range(-90, 90), randf_range(-80, -24)), 0.45, 2.5)
	elif kind == "jump":
		for i in range(5):
			_pixel_particle(origin + Vector2(randf_range(-14, 14), 0), Color("#dfc091"), Vector2(randf_range(-55, 55), randf_range(12, 70)), 0.34, 2.0)
	elif kind == "hit":
		for i in range(8):
			_pixel_particle(origin, Color("#fff0a6"), Vector2(randf_range(-150, 150), randf_range(-150, 30)), 0.32, 2.0)
	elif kind == "defeat":
		for i in range(13):
			_pixel_particle(origin, Color("#ff7a73"), Vector2(randf_range(-170, 170), randf_range(-180, 45)), 0.55, 2.5)
	elif kind == "sparkle":
		for i in range(9):
			_pixel_particle(origin, Color("#fff2a6"), Vector2(randf_range(-110, 110), randf_range(-150, -30)), 0.4, 2.0)
	elif kind == "hurt":
		_camera_shake(0.18, 4.0)

func _camera_shake(seconds: float, strength: float) -> void:
	shake_timer = max(shake_timer, seconds)
	shake_strength = max(shake_strength, strength)

func _pixel_particle(origin: Vector2, color: Color, velocity: Vector2, life: float, size: float) -> void:
	var particle := ColorRect.new()
	particle.color = color
	particle.size = Vector2(size, size)
	particle.global_position = origin
	particle.z_index = 40
	world.add_child(particle)
	var tween := create_tween()
	tween.tween_property(particle, "global_position", origin + velocity * life, life)
	tween.parallel().tween_property(particle, "color:a", 0.0, life)
	tween.tween_callback(particle.queue_free)

func _parallax_layer(factor: float, z: int) -> Node2D:
	var layer := Node2D.new()
	layer.z_index = z
	add_child(layer)
	parallax_layers.append({"node": layer, "factor": factor})
	return layer

func _terrain_visual(parent: Node, size: Vector2, z: int) -> void:
	var tile := 64.0
	var cols := int(ceil(size.x / tile))
	var left := -size.x * 0.5
	var top := -size.y * 0.5
	for i in range(cols):
		var x := left + float(i) * tile + tile * 0.5
		var tex: Texture2D = pixel_textures.grass_top if i % 4 != 2 else pixel_textures.stone_top
		var sprite := PixelArt.sprite(tex, 4.0)
		sprite.position = Vector2(x, top + 32)
		sprite.z_index = z
		parent.add_child(sprite)
		if size.y > 70.0:
			var lower := PixelArt.sprite(pixel_textures.stone_top, 4.0)
			lower.position = Vector2(x, top + 96)
			lower.modulate = Color("#b9a5ad")
			lower.z_index = z - 1
			parent.add_child(lower)
		if i % 5 == 1:
			_pixel_prop(parent, "flower", Vector2(x - 18, top - 8), z + 3, 2.4)
		elif i % 7 == 3:
			_pixel_prop(parent, "bush", Vector2(x + 8, top - 10), z + 3, 2.5)
		elif i % 11 == 5:
			_pixel_prop(parent, "sign", Vector2(x, top - 18), z + 3, 2.6)

func _pixel_prop(parent: Node, key: String, pos: Vector2, z: int, scale_value: float) -> Sprite2D:
	var sprite := PixelArt.sprite(pixel_textures[key], scale_value)
	sprite.position = pos
	sprite.z_index = z
	parent.add_child(sprite)
	return sprite

func _tree(parent: Node, pos: Vector2, scale_value: float, z: int) -> void:
	var trunk := ColorRect.new()
	trunk.color = Color("#4b3429")
	trunk.position = pos + Vector2(-8, -92) * scale_value
	trunk.size = Vector2(16, 92) * scale_value
	trunk.z_index = z
	parent.add_child(trunk)
	for offset in [Vector2(-34, -132), Vector2(0, -164), Vector2(34, -128), Vector2(0, -112)]:
		var leaf := Polygon2D.new()
		leaf.position = pos + offset * scale_value
		leaf.scale = Vector2(scale_value, scale_value)
		leaf.polygon = PackedVector2Array([Vector2(0, -44), Vector2(42, 34), Vector2(-42, 34)])
		leaf.color = Color("#263f35")
		leaf.z_index = z
		parent.add_child(leaf)

func _sparkle_loop(node: Node2D) -> void:
	var shine := ColorRect.new()
	shine.color = Color("#fff8b8")
	shine.size = Vector2(5, 5)
	shine.position = Vector2(9, -17)
	shine.z_index = 12
	node.add_child(shine)
	var tween := create_tween().set_loops()
	tween.tween_property(shine, "color:a", 0.18, 0.55)
	tween.tween_property(shine, "color:a", 1.0, 0.55)

func _pixel_bar(parent: Node, pos: Vector2, size: Vector2, back_color: Color, fill_color: Color, id: String) -> void:
	var back := ColorRect.new()
	back.position = pos
	back.size = size
	back.color = back_color
	parent.add_child(back)
	var fill := ColorRect.new()
	fill.position = pos + Vector2(3, 3)
	fill.size = size - Vector2(6, 6)
	fill.color = fill_color
	parent.add_child(fill)
	_pixel_border(parent, Rect2(pos, size), Color("#fff2c8"))
	if id == "hp":
		hp_fill = fill

func _pixel_border(parent: Node, rect: Rect2, color: Color) -> void:
	var top := ColorRect.new()
	top.position = rect.position
	top.size = Vector2(rect.size.x, 3)
	top.color = color
	parent.add_child(top)
	var bottom := ColorRect.new()
	bottom.position = rect.position + Vector2(0, rect.size.y - 3)
	bottom.size = Vector2(rect.size.x, 3)
	bottom.color = color
	parent.add_child(bottom)
	var left := ColorRect.new()
	left.position = rect.position
	left.size = Vector2(3, rect.size.y)
	left.color = color
	parent.add_child(left)
	var right := ColorRect.new()
	right.position = rect.position + Vector2(rect.size.x - 3, 0)
	right.size = Vector2(3, rect.size.y)
	right.color = color
	parent.add_child(right)

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
	if size.x > 120.0:
		_terrain_visual(body, size, z)
	else:
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

func _firefly(pos: Vector2) -> void:
	var fly := ColorRect.new()
	fly.global_position = pos
	fly.size = Vector2(4, 4)
	fly.color = Color("#fff2a6", 0.85)
	fly.z_index = -10
	world.add_child(fly)
	var drift := Vector2(randf_range(-35, 35), randf_range(-18, 18))
	var tween := create_tween().set_loops()
	tween.tween_property(fly, "global_position", pos + drift, 1.5 + randf() * 0.8)
	tween.parallel().tween_property(fly, "color:a", 0.25, 1.5)
	tween.tween_property(fly, "global_position", pos - drift * 0.4, 1.5 + randf() * 0.8)
	tween.parallel().tween_property(fly, "color:a", 0.9, 1.2)

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
