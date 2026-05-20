extends Node2D

const GRID_W := 92
const GRID_H := 58
const CELL := 12.0
const WORLD_OFFSET := Vector2(260, 148)
const WORLD_SIZE := Vector2(GRID_W * CELL, GRID_H * CELL)
const HISTORY_MAX := 300
const SPEEDS: Array[float] = [0.0, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 25.0, 50.0, 100.0]
const TOOLS := ["Sunmoss", "Glowmites", "Thornbacks", "Water", "Fertile Soil", "Rock", "Eraser"]
const SEASONS := ["Spring", "Summer", "Autumn", "Winter"]

var cells: Array[Dictionary] = []
var creatures: Array[Dictionary] = []
var history: Array[Dictionary] = []
var events: Array[Dictionary] = []
var rng := RandomNumberGenerator.new()
var seed_text := "little-world"
var tick := 0
var day := 1
var year := 1
var season := 0
var weather := "sunny"
var weather_timer := 400
var drought := 0.0
var running := true
var speed_index := 3
var sim_accumulator := 0.0
var selected_tool := 0
var ui: CanvasLayer
var stats_label: RichTextLabel
var clock_label: Label
var weather_label: Label
var seed_edit: LineEdit
var speed_label: Label
var graph: Control
var tool_buttons: Array[Button] = []
var paint_down := false


func _ready() -> void:
	seed_text = "world-%d" % randi_range(1000, 999999)
	rng.seed = hash(seed_text)
	_build_ui()
	_new_world(seed_text)
	set_process(true)


func _process(delta: float) -> void:
	if running:
		sim_accumulator += delta * SPEEDS[speed_index]
		var guard := 0
		while sim_accumulator >= 1.0 / 30.0 and guard < 90:
			_step(1.0 / 30.0)
			sim_accumulator -= 1.0 / 30.0
			guard += 1
	queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		paint_down = event.pressed
		if event.pressed:
			_apply_tool_at(event.position)
	if event is InputEventMouseMotion and paint_down:
		_apply_tool_at(event.position)


func _draw() -> void:
	_draw_background()
	_draw_world()
	_draw_creatures()
	_draw_overlay()


func _build_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	_panel(Vector2(18, 18), Vector2(1404, 104), Color(0.04, 0.07, 0.1, 0.86))

	var title := Label.new()
	title.text = "Sim: Little World Engine"
	title.position = Vector2(42, 34)
	title.add_theme_font_size_override("font_size", 38)
	ui.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Godot ecosystem simulation - paint life, change time, trigger disasters, watch generations adapt."
	subtitle.position = Vector2(44, 80)
	subtitle.modulate = Color("#a8c0ca")
	ui.add_child(subtitle)

	var play := _button("Pause", Vector2(1188, 40), Vector2(92, 48))
	play.pressed.connect(func() -> void:
		running = not running
		play.text = "Pause" if running else "Play"
	)

	var fresh := _button("New World", Vector2(1290, 40), Vector2(112, 48))
	fresh.pressed.connect(func() -> void: _new_world(seed_edit.text.strip_edges()))

	_panel(Vector2(18, 140), Vector2(220, 690), Color(0.04, 0.07, 0.1, 0.78))
	_header("TOOLS", Vector2(38, 160))
	for i in range(TOOLS.size()):
		var b := _button(TOOLS[i], Vector2(38, 196 + i * 48), Vector2(176, 40))
		b.tooltip_text = _tool_tip(TOOLS[i])
		b.pressed.connect(_select_tool.bind(i))
		tool_buttons.append(b)
	_select_tool(0)

	_header("SEED", Vector2(38, 552))
	seed_edit = LineEdit.new()
	seed_edit.text = seed_text
	seed_edit.position = Vector2(38, 580)
	seed_edit.size = Vector2(176, 36)
	ui.add_child(seed_edit)

	_header("TIME", Vector2(38, 632))
	speed_label = Label.new()
	speed_label.position = Vector2(38, 658)
	ui.add_child(speed_label)
	var speed := HSlider.new()
	speed.position = Vector2(38, 684)
	speed.size = Vector2(176, 32)
	speed.min_value = 0
	speed.max_value = SPEEDS.size() - 1
	speed.step = 1
	speed.value = speed_index
	speed.value_changed.connect(func(value: float) -> void:
		speed_index = int(value)
		_update_speed_label()
	)
	ui.add_child(speed)
	_update_speed_label()

	_panel(Vector2(1186, 140), Vector2(236, 690), Color(0.04, 0.07, 0.1, 0.78))
	_header("LIVE WORLD", Vector2(1208, 160))
	stats_label = RichTextLabel.new()
	stats_label.position = Vector2(1208, 196)
	stats_label.size = Vector2(190, 470)
	stats_label.bbcode_enabled = true
	stats_label.fit_content = true
	ui.add_child(stats_label)

	_header("DISASTERS", Vector2(1208, 650))
	var disasters := ["Drought", "Heavy Rain", "Plague", "Meteor", "Predator Bloom", "Rebalance"]
	for i in range(disasters.size()):
		var b := _button(disasters[i], Vector2(1208, 680 + i * 38), Vector2(176, 32))
		b.pressed.connect(_disaster.bind(disasters[i]))

	clock_label = Label.new()
	clock_label.position = Vector2(280, 128)
	clock_label.add_theme_font_size_override("font_size", 19)
	ui.add_child(clock_label)

	weather_label = Label.new()
	weather_label.position = Vector2(725, 128)
	weather_label.modulate = Color("#9de7ff")
	ui.add_child(weather_label)

	graph = Control.new()
	graph.position = Vector2(260, 770)
	graph.size = Vector2(900, 92)
	graph.draw.connect(_draw_graph)
	ui.add_child(graph)


func _button(text: String, pos: Vector2, size: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = pos
	button.size = size
	button.focus_mode = Control.FOCUS_NONE
	ui.add_child(button)
	return button


func _header(text: String, pos: Vector2) -> void:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.modulate = Color("#75ffd6")
	label.add_theme_font_size_override("font_size", 15)
	ui.add_child(label)


func _panel(pos: Vector2, size: Vector2, color: Color) -> void:
	var panel := Panel.new()
	panel.position = pos
	panel.size = size
	panel.modulate = color
	ui.add_child(panel)


func _select_tool(index: int) -> void:
	selected_tool = index
	for i in range(tool_buttons.size()):
		tool_buttons[i].button_pressed = i == index


func _update_speed_label() -> void:
	var rate := SPEEDS[speed_index]
	speed_label.text = "paused" if rate == 0.0 else "%.2fx" % rate


func _new_world(new_seed: String) -> void:
	seed_text = new_seed if new_seed != "" else "world-%d" % randi_range(1000, 999999)
	rng.seed = hash(seed_text)
	if seed_edit:
		seed_edit.text = seed_text
	tick = 0
	day = 1
	year = 1
	season = 0
	weather = "sunny"
	weather_timer = 300
	drought = 0.0
	creatures.clear()
	history.clear()
	events.clear()
	cells.clear()

	for y in range(GRID_H):
		for x in range(GRID_W):
			var n := _noise(x, y)
			var terrain := "grass"
			if n > 0.82:
				terrain = "rock"
			elif n < 0.17:
				terrain = "dry"
			elif abs(x - 64 - sin(y * 0.23) * 8.0) < 3.0:
				terrain = "water"
			elif n > 0.5 and n < 0.72:
				terrain = "fertile"
			cells.append({
				"type": terrain,
				"moss": rng.randf_range(0.25, 0.8) if terrain == "fertile" and rng.randf() < 0.34 else 0.0,
				"nutrients": 0.95 if terrain == "fertile" else (0.18 if terrain == "dry" else rng.randf_range(0.4, 0.76)),
				"water": 1.0 if terrain == "water" else (0.1 if terrain == "dry" else rng.randf_range(0.34, 0.72)),
				"rot": 0.0,
				"biomass": 0.0,
			})

	for i in range(360):
		_paint_cell(rng.randi_range(3, GRID_W - 4), rng.randi_range(3, GRID_H - 4), "Sunmoss", 3)
	for i in range(62):
		_spawn("glowmite", Vector2(rng.randf_range(80, WORLD_SIZE.x - 80), rng.randf_range(80, WORLD_SIZE.y - 80)))
	for i in range(5):
		_spawn("thornback", Vector2(rng.randf_range(80, WORLD_SIZE.x - 80), rng.randf_range(80, WORLD_SIZE.y - 80)))
	_update_ui()


func _step(delta: float) -> void:
	tick += 1
	day = int(tick / 180) + 1
	year = int((day - 1) / 48) + 1
	season = int(((day - 1) % 48) / 12)
	weather_timer -= 1
	if weather_timer <= 0:
		_roll_weather()

	_update_cells(delta)
	for creature in creatures:
		if creature.dead:
			continue
		if creature.kind == "glowmite":
			_update_glowmite(creature, delta)
		else:
			_update_thornback(creature, delta)

	for creature in creatures:
		if creature.dead:
			var cell := _cell_at_world(creature.pos)
			cell.biomass = clamp(cell.biomass + (0.35 if creature.kind == "glowmite" else 0.9), 0.0, 4.0)
	creatures = creatures.filter(func(creature: Dictionary) -> bool: return not creature.dead)

	if tick % 30 == 0:
		_sample_history()
	if tick % 10 == 0:
		_update_ui()


func _roll_weather() -> void:
	var choices: Array[String] = ["sunny", "rain", "cloudy", "sunny"]
	if season == 1:
		choices = ["sunny", "rain", "cloudy", "drought"]
	elif season == 3:
		choices = ["cloudy", "sunny", "rain"]
	weather = choices[rng.randi_range(0, choices.size() - 1)]
	weather_timer = rng.randi_range(220, 620)
	if weather == "drought":
		drought = clamp(drought + 0.16, 0.0, 0.7)
	elif weather == "rain":
		drought = clamp(drought - 0.28, 0.0, 1.0)


func _update_cells(_delta: float) -> void:
	var growth_mult: float = [1.35, 0.85, 1.1, 0.38][season]
	var light: float = (sin(tick * 0.006) + 1.0) * 0.5
	var rain: float = 0.014 if weather == "rain" else (-0.001 - drought * 0.003)
	for y in range(GRID_H):
		for x in range(GRID_W):
			var cell := _cell(x, y)
			if cell.type == "water":
				cell.water = 1.0
				continue
			if cell.type != "rock":
				cell.water = clamp(cell.water + rain, 0.0, 1.0)
			if cell.biomass > 0.0:
				cell.rot = clamp(cell.rot + cell.biomass * 0.01, 0.0, 1.0)
				cell.nutrients = clamp(cell.nutrients + cell.biomass * 0.007, 0.0, 1.2)
				cell.biomass = max(0.0, cell.biomass - 0.004)
			else:
				cell.rot = max(0.0, cell.rot - 0.001)
			if cell.moss > 0.0:
				var growth: float = (light * 0.72 + cell.water * 0.84 + cell.nutrients * 0.5 - drought * 0.42) * 0.0035 * growth_mult
				cell.moss = clamp(cell.moss + growth - (0.004 if cell.water < 0.055 else 0.0), 0.0, 1.0)
				cell.nutrients = clamp(cell.nutrients - cell.moss * 0.00055, 0.0, 1.2)
				if cell.moss > 0.42 and rng.randf() < 0.02 * growth_mult:
					var nx := clampi(x + rng.randi_range(-1, 1), 0, GRID_W - 1)
					var ny := clampi(y + rng.randi_range(-1, 1), 0, GRID_H - 1)
					var neighbor := _cell(nx, ny)
					if neighbor.type != "water" and neighbor.type != "rock" and neighbor.water > 0.16 and neighbor.nutrients > 0.12:
						neighbor.moss = clamp(neighbor.moss + 0.075, 0.0, 1.0)
			elif cell.type != "rock" and cell.type != "water" and cell.water > 0.24 and cell.nutrients > 0.38 and rng.randf() < 0.0022 * growth_mult:
				cell.moss = 0.06


func _update_glowmite(glowmite: Dictionary, delta: float) -> void:
	glowmite.age += delta
	glowmite.cooldown -= delta
	glowmite.thirst += delta * 0.012
	glowmite.energy -= delta * (0.48 * glowmite.hunger + 0.12 * glowmite.speed)
	var predator = _nearest(glowmite, "thornback", 118.0 * glowmite.vision)
	var target: Vector2 = glowmite.pos + glowmite.vel * 30.0
	if predator:
		target = glowmite.pos - (predator.pos - glowmite.pos) * 2.0
	else:
		var moss := _best_moss(glowmite.pos, 96.0 * glowmite.vision)
		if moss != Vector2.INF:
			target = moss
	_move_creature(glowmite, target, 48.0 * glowmite.speed, delta)

	var cell := _cell_at_world(glowmite.pos)
	if cell.moss > 0.03:
		var bite: float = min(cell.moss, 0.018)
		cell.moss -= bite
		glowmite.energy = clamp(glowmite.energy + bite * 220.0, 0.0, 145.0)
	if cell.water > 0.28 or cell.type == "water":
		glowmite.thirst = max(0.0, glowmite.thirst - delta * 0.28)
	if glowmite.energy > 102.0 and glowmite.cooldown <= 0.0 and _local_count(glowmite.pos, "glowmite", 60.0) < 6:
		var child = _spawn("glowmite", glowmite.pos + Vector2(rng.randf_range(-20, 20), rng.randf_range(-20, 20)), glowmite)
		if child:
			child.energy = 58.0
			glowmite.energy -= 38.0
			glowmite.cooldown = 8.5 / glowmite.fertility
	if glowmite.energy <= 0.0 or glowmite.thirst > 2.25 or glowmite.age > 250.0 + rng.randf_range(0, 100):
		glowmite.dead = true


func _update_thornback(thornback: Dictionary, delta: float) -> void:
	thornback.age += delta
	thornback.cooldown -= delta
	thornback.thirst += delta * 0.014
	thornback.energy -= delta * (1.18 * thornback.metabolism + 0.24 * thornback.speed)
	var prey = _nearest(thornback, "glowmite", 112.0 * thornback.sight)
	var target: Vector2 = prey.pos if prey else thornback.pos + thornback.vel * 50.0
	_move_creature(thornback, target, 50.0 * thornback.speed, delta)
	if prey and thornback.pos.distance_squared_to(prey.pos) < 14.0 * 14.0:
		prey.dead = true
		thornback.energy = clamp(thornback.energy + 44.0, 0.0, 145.0)

	var cell := _cell_at_world(thornback.pos)
	if cell.water > 0.28 or cell.type == "water":
		thornback.thirst = max(0.0, thornback.thirst - delta * 0.2)
	if thornback.energy > 130.0 and thornback.cooldown <= 0.0 and _local_count(thornback.pos, "thornback", 80.0) < 3:
		var child = _spawn("thornback", thornback.pos + Vector2(rng.randf_range(-24, 24), rng.randf_range(-24, 24)), thornback)
		if child:
			child.energy = 62.0
			thornback.energy -= 66.0
			thornback.cooldown = 18.0
	if thornback.energy <= 0.0 or thornback.thirst > 2.15 or thornback.age > 230.0 + rng.randf_range(0, 90):
		thornback.dead = true


func _move_creature(creature: Dictionary, target: Vector2, speed: float, delta: float) -> void:
	var dir: Vector2 = (target - creature.pos).normalized()
	if dir.length() == 0:
		dir = Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized()
	creature.vel = creature.vel.lerp(dir, 0.08).normalized()
	var next: Vector2 = creature.pos + creature.vel * speed * delta
	var cell := _cell_at_world(next)
	if cell.type == "rock" or cell.type == "water":
		creature.vel = -creature.vel.rotated(rng.randf_range(-0.8, 0.8))
	else:
		creature.pos = Vector2(clamp(next.x, 5.0, WORLD_SIZE.x - 5.0), clamp(next.y, 5.0, WORLD_SIZE.y - 5.0))


func _spawn(kind: String, pos: Vector2, parent = null):
	var cell := _cell_at_world(pos)
	if cell.type == "water" or cell.type == "rock":
		return null
	var creature := {
		"kind": kind,
		"pos": pos,
		"vel": Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized(),
		"energy": 92.0 if kind == "glowmite" else 82.0,
		"thirst": 0.0,
		"age": 0.0,
		"cooldown": rng.randf_range(1.0, 8.0),
		"dead": false,
	}
	if kind == "glowmite":
		creature.speed = _mut(parent.speed if parent else 0.86)
		creature.vision = _mut(parent.vision if parent else 1.12)
		creature.fertility = _mut(parent.fertility if parent else 1.18)
		creature.hunger = _mut(parent.hunger if parent else 0.78)
		creature.tint = rng.randf_range(-0.7, 0.7)
	else:
		creature.speed = _mut(parent.speed if parent else 0.66)
		creature.stamina = _mut(parent.stamina if parent else 1.0)
		creature.aggression = _mut(parent.aggression if parent else 0.76)
		creature.sight = _mut(parent.sight if parent else 0.86)
		creature.metabolism = _mut(parent.metabolism if parent else 1.16)
	creatures.append(creature)
	return creature


func _mut(value: float) -> float:
	return clamp(value + rng.randf_range(-0.07, 0.07), 0.15, 2.2)


func _nearest(me: Dictionary, kind: String, radius: float):
	var best = null
	var best_d := radius * radius
	for other in creatures:
		if other == me or other.kind != kind or other.dead:
			continue
		var distance: float = me.pos.distance_squared_to(other.pos)
		if distance < best_d:
			best = other
			best_d = distance
	return best


func _local_count(pos: Vector2, kind: String, radius: float) -> int:
	var count := 0
	var rr := radius * radius
	for creature in creatures:
		if creature.kind == kind and not creature.dead and pos.distance_squared_to(creature.pos) < rr:
			count += 1
	return count


func _best_moss(pos: Vector2, radius: float) -> Vector2:
	var cx := int(pos.x / CELL)
	var cy := int(pos.y / CELL)
	var cr := int(ceil(radius / CELL))
	var best := Vector2.INF
	var best_score := -999.0
	for y in range(cy - cr, cy + cr + 1):
		for x in range(cx - cr, cx + cr + 1):
			if x < 0 or y < 0 or x >= GRID_W or y >= GRID_H:
				continue
			var cell := _cell(x, y)
			if cell.moss < 0.08:
				continue
			var point := Vector2(x * CELL + CELL * 0.5, y * CELL + CELL * 0.5)
			var score: float = cell.moss * 2.0 - point.distance_to(pos) / radius
			if score > best_score:
				best = point
				best_score = score
	return best


func _apply_tool_at(screen_pos: Vector2) -> void:
	var local := screen_pos - WORLD_OFFSET
	if local.x < 0 or local.y < 0 or local.x >= WORLD_SIZE.x or local.y >= WORLD_SIZE.y:
		return
	var x := int(local.x / CELL)
	var y := int(local.y / CELL)
	_paint_cell(x, y, TOOLS[selected_tool], 3)


func _paint_cell(cx: int, cy: int, tool: String, radius: int) -> void:
	for y in range(cy - radius, cy + radius + 1):
		for x in range(cx - radius, cx + radius + 1):
			if x < 0 or y < 0 or x >= GRID_W or y >= GRID_H or Vector2(x - cx, y - cy).length() > radius + rng.randf():
				continue
			var cell := _cell(x, y)
			match tool:
				"Sunmoss":
					if cell.type != "water" and cell.type != "rock":
						cell.moss = clamp(cell.moss + 0.55, 0.0, 1.0)
				"Water":
					cell.type = "water"
					cell.water = 1.0
					cell.moss = 0.0
				"Fertile Soil":
					cell.type = "fertile"
					cell.nutrients = 1.1
					cell.water = clamp(cell.water + 0.25, 0.0, 1.0)
				"Rock":
					cell.type = "rock"
					cell.moss = 0.0
				"Eraser":
					cell.type = "grass"
					cell.moss = 0.0
					cell.rot = 0.0
					cell.biomass = 0.0
	if tool == "Glowmites":
		for i in range(8):
			_spawn("glowmite", Vector2(cx * CELL, cy * CELL) + Vector2(rng.randf_range(-24, 24), rng.randf_range(-24, 24)))
	elif tool == "Thornbacks":
		for i in range(3):
			_spawn("thornback", Vector2(cx * CELL, cy * CELL) + Vector2(rng.randf_range(-24, 24), rng.randf_range(-24, 24)))
	elif tool == "Eraser":
		creatures = creatures.filter(func(creature: Dictionary) -> bool: return (creature.pos / CELL).distance_to(Vector2(cx, cy)) > radius + 2)
	_update_ui()


func _disaster(label: String) -> void:
	events.append({"tick": tick, "type": label})
	match label:
		"Drought":
			weather = "drought"
			weather_timer = 700
			drought = 0.7
		"Heavy Rain":
			weather = "rain"
			weather_timer = 500
			drought = 0.0
			for cell in cells:
				if cell.type != "rock":
					cell.water = clamp(cell.water + 0.36, 0.0, 1.0)
		"Plague":
			for creature in creatures:
				if rng.randf() < (0.18 if creature.kind == "glowmite" else 0.12):
					creature.dead = true
		"Meteor":
			var meteor := Vector2(rng.randi_range(10, GRID_W - 10), rng.randi_range(8, GRID_H - 8))
			for y in range(int(meteor.y) - 5, int(meteor.y) + 6):
				for x in range(int(meteor.x) - 5, int(meteor.x) + 6):
					if x >= 0 and y >= 0 and x < GRID_W and y < GRID_H and Vector2(x, y).distance_to(meteor) < 5.5:
						var cell := _cell(x, y)
						cell.type = "rock" if rng.randf() < 0.7 else "dry"
						cell.moss = 0.0
						cell.biomass += 0.3
		"Predator Bloom":
			for i in range(5):
				_spawn("thornback", Vector2(rng.randf_range(80, WORLD_SIZE.x - 80), rng.randf_range(80, WORLD_SIZE.y - 80)))
		"Rebalance":
			_rebalance()
	_update_ui()


func _rebalance() -> void:
	var stats := _stats()
	if stats.moss < 170:
		for i in range(140):
			_paint_cell(rng.randi_range(3, GRID_W - 4), rng.randi_range(3, GRID_H - 4), "Sunmoss", 2)
	if stats.glow < 20:
		for i in range(24):
			_spawn("glowmite", Vector2(rng.randf_range(80, WORLD_SIZE.x - 80), rng.randf_range(80, WORLD_SIZE.y - 80)))
	if stats.thorn < 2 and stats.glow > 28:
		for i in range(3):
			_spawn("thornback", Vector2(rng.randf_range(80, WORLD_SIZE.x - 80), rng.randf_range(80, WORLD_SIZE.y - 80)))
	for cell in cells:
		if cell.type != "rock":
			cell.water = clamp(cell.water + 0.2, 0.0, 1.0)
			cell.nutrients = clamp(cell.nutrients + 0.18, 0.0, 1.2)


func _stats() -> Dictionary:
	var moss := 0
	var rot := 0
	var nutrients := 0.0
	var water := 0.0
	var glow := 0
	var thorn := 0
	var glow_speed := 0.0
	var glow_vision := 0.0
	var glow_fertility := 0.0
	var thorn_speed := 0.0
	var thorn_aggression := 0.0
	var thorn_metabolism := 0.0
	for cell in cells:
		if cell.moss > 0.05:
			moss += 1
		if cell.rot > 0.06:
			rot += 1
		nutrients += cell.nutrients
		water += cell.water
	for creature in creatures:
		if creature.kind == "glowmite":
			glow += 1
			glow_speed += creature.speed
			glow_vision += creature.vision
			glow_fertility += creature.fertility
		else:
			thorn += 1
			thorn_speed += creature.speed
			thorn_aggression += creature.aggression
			thorn_metabolism += creature.metabolism
	var stability: float = clamp(100.0 - abs(130 - glow) * 0.28 - abs(7 - thorn) * 2.2 + moss * 0.045 - max(0, glow - moss * 0.16) * 0.18 - drought * 12.0, 0.0, 100.0)
	return {
		"moss": moss,
		"rot": rot,
		"glow": glow,
		"thorn": thorn,
		"glow_speed": glow_speed / max(1, glow),
		"glow_vision": glow_vision / max(1, glow),
		"glow_fertility": glow_fertility / max(1, glow),
		"thorn_speed": thorn_speed / max(1, thorn),
		"thorn_aggression": thorn_aggression / max(1, thorn),
		"thorn_metabolism": thorn_metabolism / max(1, thorn),
		"nutrients": nutrients / cells.size(),
		"water": water / cells.size(),
		"stability": stability,
	}


func _sample_history() -> void:
	var stats := _stats()
	history.append({"moss": stats.moss, "glow": stats.glow, "thorn": stats.thorn, "rot": stats.rot, "tick": tick})
	if history.size() > HISTORY_MAX:
		history.pop_front()
	graph.queue_redraw()


func _update_ui() -> void:
	var stats := _stats()
	clock_label.text = "Day %d - %s - Year %d" % [day, SEASONS[season], year]
	weather_label.text = "%s - drought %d%%" % [weather, int(drought * 100.0)]
	stats_label.text = "[b]Sunmoss[/b] %d cells\n[b]Glowmites[/b] %d\n[b]Thornbacks[/b] %d\n[b]Rotshrooms[/b] %d\n\n[b]Glowmite traits[/b]\nspeed %.2f\nvision %.2f\nfertility %.2f\n\n[b]Thornback traits[/b]\nspeed %.2f\naggression %.2f\nmetabolism %.2f\n\n[b]Soil[/b] %d%%\n[b]Water[/b] %d%%\n[b]Stability[/b] %d/100" % [stats.moss, stats.glow, stats.thorn, stats.rot, stats.glow_speed, stats.glow_vision, stats.glow_fertility, stats.thorn_speed, stats.thorn_aggression, stats.thorn_metabolism, int(stats.nutrients * 100.0), int(stats.water * 100.0), int(stats.stability)]


func _draw_background() -> void:
	draw_rect(Rect2(Vector2.ZERO, Vector2(1440, 900)), Color("#061018"))
	draw_circle(Vector2(250, 110), 220, Color(0.22, 1.0, 0.73, 0.08))
	draw_circle(Vector2(1160, 90), 260, Color(0.37, 0.55, 1.0, 0.1))
	draw_rect(Rect2(WORLD_OFFSET - Vector2(8, 8), WORLD_SIZE + Vector2(16, 16)), Color(1, 1, 1, 0.08), false, 2.0)


func _draw_world() -> void:
	for y in range(GRID_H):
		for x in range(GRID_W):
			var cell := _cell(x, y)
			var pos := WORLD_OFFSET + Vector2(x, y) * CELL
			draw_rect(Rect2(pos, Vector2(CELL + 0.5, CELL + 0.5)), _terrain_color(cell))
			if cell.moss > 0.03:
				draw_circle(pos + Vector2(6, 6), 2.5 + cell.moss * 4.2, Color(0.45, 1.0, 0.42, 0.18 + cell.moss * 0.52))
				draw_rect(Rect2(pos + Vector2(4, 4), Vector2(3, 3)), Color(0.85, 1.0, 0.5, 0.58))
			if cell.rot > 0.04:
				draw_circle(pos + Vector2(6, 6), 2.0 + cell.rot * 4.0, Color(0.78, 0.42, 1.0, 0.16 + cell.rot * 0.45))


func _draw_creatures() -> void:
	for creature in creatures:
		var point: Vector2 = WORLD_OFFSET + creature.pos
		if creature.kind == "glowmite":
			draw_circle(point, 6.0, Color(0.35, 0.92, 1.0, 0.25))
			draw_circle(point, 3.2, Color(0.45 + creature.tint * 0.1, 0.95, 1.0, 0.95))
			draw_circle(point + creature.vel * 3.0, 1.0, Color.WHITE)
		else:
			var angle: float = creature.vel.angle()
			var points := PackedVector2Array([
				point + Vector2(cos(angle), sin(angle)) * 8.0,
				point + Vector2(cos(angle + 2.45), sin(angle + 2.45)) * 7.0,
				point + Vector2(cos(angle - 2.45), sin(angle - 2.45)) * 7.0,
			])
			draw_colored_polygon(points, Color(1.0, 0.34, 0.18, 0.94))
			draw_circle(point, 2.0, Color(1.0, 0.86, 0.35))


func _draw_overlay() -> void:
	if weather == "rain":
		for i in range(90):
			var x := fmod(i * 97.0 + tick * 4.0, WORLD_SIZE.x)
			var y := fmod(i * 53.0 + tick * 11.0, WORLD_SIZE.y)
			draw_line(WORLD_OFFSET + Vector2(x, y), WORLD_OFFSET + Vector2(x - 8, y + 18), Color(0.75, 0.9, 1.0, 0.25), 1.0)
	if weather == "drought":
		draw_rect(Rect2(WORLD_OFFSET, WORLD_SIZE), Color(1.0, 0.48, 0.16, 0.12))
	var night: float = max(0.0, cos(fmod(tick, 180.0) / 180.0 * TAU)) * 0.3
	if night > 0.02:
		draw_rect(Rect2(WORLD_OFFSET, WORLD_SIZE), Color(0.02, 0.03, 0.12, night))


func _draw_graph() -> void:
	graph.draw_rect(Rect2(Vector2.ZERO, graph.size), Color(0, 0, 0, 0.25))
	if history.size() < 2:
		return
	var max_value := 50.0
	for item in history:
		max_value = max(max_value, float(item.moss), float(item.glow), float(item.thorn) * 10.0, float(item.rot))
	_graph_line("moss", Color("#77ff7d"), max_value, 1.0)
	_graph_line("glow", Color("#69eeff"), max_value, 1.0)
	_graph_line("thorn", Color("#ff7045"), max_value, 10.0)
	_graph_line("rot", Color("#c06cff"), max_value, 1.0)


func _graph_line(key: String, color: Color, max_value: float, multiplier: float) -> void:
	var points := PackedVector2Array()
	for i in range(history.size()):
		var item := history[i]
		var x := float(i) / float(HISTORY_MAX - 1) * graph.size.x
		var y := graph.size.y - (float(item[key]) * multiplier / max_value) * (graph.size.y - 10.0) - 5.0
		points.append(Vector2(x, y))
	if points.size() > 1:
		graph.draw_polyline(points, color, 2.5)


func _terrain_color(cell: Dictionary) -> Color:
	var base := Color("#254d32")
	match cell.type:
		"dirt":
			base = Color("#6b5138")
		"water":
			base = Color("#1f6d85")
		"rock":
			base = Color("#4b5563")
		"fertile":
			base = Color("#356b3c")
		"dry":
			base = Color("#8a6b3c")
	return base.lightened(cell.nutrients * 0.08).darkened((1.0 - cell.water) * 0.12)


func _cell(x: int, y: int) -> Dictionary:
	return cells[clampi(y, 0, GRID_H - 1) * GRID_W + clampi(x, 0, GRID_W - 1)]


func _cell_at_world(pos: Vector2) -> Dictionary:
	return _cell(int(pos.x / CELL), int(pos.y / CELL))


func _noise(x: int, y: int) -> float:
	var noise := sin(float(x) * 12.9898 + float(y) * 78.233 + float(abs(hash(seed_text)) % 9999)) * 43758.5453
	return noise - floor(noise)


func _tool_tip(tool: String) -> String:
	match tool:
		"Sunmoss":
			return "Paints food for Glowmites."
		"Glowmites":
			return "Adds herbivores with evolving traits."
		"Thornbacks":
			return "Adds predators that hunt Glowmites."
		"Water":
			return "Paints water that supports life but blocks movement."
		"Fertile Soil":
			return "Raises nutrients and helps Sunmoss."
		"Rock":
			return "Creates barriers."
		"Eraser":
			return "Clears terrain and nearby organisms."
	return ""
