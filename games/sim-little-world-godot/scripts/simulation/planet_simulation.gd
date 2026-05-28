extends RefCounted

const EvolutionModel = preload("res://scripts/evolution/evolution_model.gd")
const WeatherModel = preload("res://scripts/weather/weather_model.gd")

const GRID_W := 92
const GRID_H := 58
const CELL := 12.0
const WORLD_OFFSET := Vector2(260, 148)
const WORLD_SIZE := Vector2(GRID_W * CELL, GRID_H * CELL)
const HISTORY_MAX := 300
const BUCKET_SIZE := 72.0
const SPEEDS: Array[float] = [0.0, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 25.0, 50.0, 100.0]
const TOOLS := ["Cyanobacteria", "Amoeboids", "Grazers", "Predatory Swimmers", "Tidal Nutrients", "Volcanic Rock", "Hydrothermal Vent", "Eraser"]
const DISASTERS := ["Heat Pulse", "Monsoon", "Viral Bloom", "Impact Event", "Predator Surge", "Seed Recovery"]

var cells: Array[Dictionary] = []
var organisms: Array[Dictionary] = []
var history: Array[Dictionary] = []
var events: Array[Dictionary] = []
var spatial: Dictionary = {}
var rng := RandomNumberGenerator.new()
var evolution := EvolutionModel.new()
var weather_model := WeatherModel.new()

var seed_text := "primordial-world"
var tick := 0
var day := 1
var year := 1
var season := 0
var weather := "clear"
var weather_timer := 400
var climate_heat := 0.44
var oxygen := 0.012
var co2 := 0.91
var selected_tool := 0
var render_alpha := 1.0


func new_world(new_seed: String) -> void:
	seed_text = new_seed if new_seed != "" else "planet-%d" % randi_range(1000, 999999)
	rng.seed = hash(seed_text)
	tick = 0
	day = 1
	year = 1
	season = 0
	weather = "marine haze"
	weather_timer = 360
	climate_heat = 0.44
	oxygen = 0.012
	co2 = 0.91
	cells.clear()
	organisms.clear()
	history.clear()
	events.clear()
	spatial.clear()

	for y in range(GRID_H):
		for x in range(GRID_W):
			cells.append(_create_cell(x, y))

	for i in range(240):
		paint_cell(rng.randi_range(4, GRID_W - 5), rng.randi_range(4, GRID_H - 5), "Cyanobacteria", 3, false)
	for i in range(26):
		spawn("amoeboid", _random_open_water_pos())
	for i in range(12):
		spawn("grazer", _random_open_water_pos())
	for i in range(3):
		spawn("predator", _random_open_water_pos())
	_sample_history()


func _create_cell(x: int, y: int) -> Dictionary:
	var n := _noise(x, y)
	var ridge := _noise(x + 91, y - 37)
	var river: float = abs(float(x) - 65.0 - sin(float(y) * 0.21) * 8.0)
	var terrain := "deep_ocean"
	var depth := 0.92
	var shallow := ridge > 0.38 and ridge < 0.72
	if n > 0.84:
		terrain = "volcanic"
		depth = 0.06
	elif n < 0.13:
		terrain = "basalt"
		depth = 0.15
	elif river < 3.4:
		terrain = "shallow"
		depth = 0.34
	elif shallow:
		terrain = "tidal"
		depth = 0.24
	elif n > 0.58:
		terrain = "shelf"
		depth = 0.48
	var vent := terrain == "volcanic" and ridge > 0.86
	return {
		"type": terrain,
		"depth": depth,
		"microbes": rng.randf_range(0.16, 0.48) if _is_life_terrain(terrain) and rng.randf() < 0.36 else 0.0,
		"nutrients": 1.1 if vent else rng.randf_range(0.32, 0.92),
		"water": 1.0 if terrain != "basalt" and terrain != "volcanic" else rng.randf_range(0.18, 0.48),
		"decay": 0.0,
		"fungus": 0.0,
		"vent": vent,
		"sediment": rng.randf_range(0.0, 1.0),
		"temperature": clamp(climate_heat + (0.18 if vent else 0.0) + rng.randf_range(-0.08, 0.08), 0.0, 1.0),
	}


func step(delta: float) -> void:
	tick += 1
	for organism in organisms:
		organism.prev_pos = organism.pos
		organism.prev_vel = organism.vel
	day = int(tick / 180) + 1
	year = int((day - 1) / 48) + 1
	season = int(((day - 1) % 48) / 12)
	weather_timer -= 1
	if weather_timer <= 0:
		roll_weather()

	_update_cells(delta)
	_rebuild_spatial()
	for organism in organisms:
		if organism.dead:
			continue
		match organism.kind:
			"amoeboid":
				_update_amoeboid(organism, delta)
			"grazer":
				_update_grazer(organism, delta)
			"predator":
				_update_predator(organism, delta)

	for organism in organisms:
		if organism.dead:
			var cell := cell_at_world(organism.pos)
			cell.decay = clamp(cell.decay + organism.size * 0.38, 0.0, 5.0)
	organisms = organisms.filter(func(organism: Dictionary) -> bool: return not organism.dead)

	if tick % 30 == 0:
		_sample_history()


func roll_weather() -> void:
	weather = weather_model.roll_weather(season, rng)
	weather_timer = rng.randi_range(260, 650)
	match weather:
		"heat pulse":
			climate_heat = clamp(climate_heat + 0.08, 0.0, 1.0)
		"warm rain", "storm rain", "monsoon":
			climate_heat = clamp(climate_heat - 0.03, 0.0, 1.0)
		"ash cloud":
			climate_heat = clamp(climate_heat - 0.07, 0.0, 1.0)


func _update_cells(_delta: float) -> void:
	var season_growth: float = [1.22, 0.9, 1.05, 0.68][season]
	var day_light: float = (sin(float(tick) * 0.006) + 1.0) * 0.5
	var rain: float = 0.006 if _is_rain_weather(weather) else -0.001
	var heat_stress: float = max(0.0, climate_heat - 0.68) * 0.55
	var microbe_total := 0.0
	var decay_total := 0.0
	for y in range(GRID_H):
		for x in range(GRID_W):
			var cell := cell(x, y)
			if _is_ocean_terrain(cell.type):
				cell.water = 1.0
			else:
				cell.water = clamp(cell.water + rain, 0.0, 1.0)
			cell.temperature = clamp(cell.temperature * 0.994 + (climate_heat + (0.18 if cell.vent else 0.0)) * 0.006, 0.0, 1.0)
			if cell.vent:
				cell.nutrients = clamp(cell.nutrients + 0.006, 0.0, 1.45)
			if cell.decay > 0.0:
				cell.fungus = clamp(cell.fungus + cell.decay * 0.011, 0.0, 1.0)
				cell.nutrients = clamp(cell.nutrients + cell.decay * 0.008, 0.0, 1.45)
				cell.decay = max(0.0, cell.decay - 0.006)
			else:
				cell.fungus = max(0.0, cell.fungus - 0.001)
			if _is_life_terrain(cell.type) and cell.water > 0.4:
				var shallow_bonus: float = 1.22 if _is_shallow_terrain(cell.type) else 0.82
				var photosynthesis: float = (day_light * 0.78 + cell.nutrients * 0.56 - heat_stress) * 0.0038 * season_growth * shallow_bonus
				cell.microbes = clamp(cell.microbes + photosynthesis - max(0.0, cell.microbes - 0.88) * 0.002, 0.0, 1.0)
				cell.nutrients = clamp(cell.nutrients - cell.microbes * 0.00062, 0.0, 1.45)
				if cell.microbes > 0.38 and rng.randf() < 0.014 * season_growth:
					var nx := clampi(x + rng.randi_range(-1, 1), 0, GRID_W - 1)
					var ny := clampi(y + rng.randi_range(-1, 1), 0, GRID_H - 1)
					var neighbor := cell(nx, ny)
					if _is_life_terrain(neighbor.type) and neighbor.water > 0.45:
						neighbor.microbes = clamp(neighbor.microbes + 0.055, 0.0, 1.0)
			elif cell.microbes > 0.0:
				cell.microbes = max(0.0, cell.microbes - 0.002 - heat_stress * 0.002)
			microbe_total += cell.microbes
			decay_total += cell.decay + cell.fungus
	oxygen = clamp(oxygen + microbe_total / float(cells.size()) * 0.00034 - float(organisms.size()) * 0.000003, 0.0, 1.0)
	co2 = clamp(co2 - oxygen * 0.00018 + decay_total / float(cells.size()) * 0.00008, 0.04, 1.0)


func _update_amoeboid(amoeba: Dictionary, delta: float) -> void:
	amoeba.age += delta
	amoeba.cooldown -= delta
	amoeba.energy -= delta * (0.38 * amoeba.metabolism + 0.08 * amoeba.speed)
	var predator = nearest(amoeba, "predator", 86.0 * amoeba.sensory)
	var target: Vector2 = amoeba.pos + amoeba.vel * 34.0
	if predator:
		target = amoeba.pos - (predator.pos - amoeba.pos) * (1.7 + amoeba.speed * 0.25)
	else:
		var food := best_microbe(amoeba.pos, 78.0 * amoeba.sensory)
		if food != Vector2.INF:
			target = food
	move_organism(amoeba, target, 33.0 * amoeba.speed, delta)
	var c := cell_at_world(amoeba.pos)
	if c.microbes > 0.025:
		var bite: float = min(c.microbes, 0.012 + amoeba.size * 0.003)
		c.microbes -= bite
		amoeba.energy = clamp(amoeba.energy + bite * 230.0, 0.0, 140.0)
	if c.fungus > 0.06 and rng.randf() < 0.4:
		var snack: float = min(c.fungus, 0.008)
		c.fungus -= snack
		amoeba.energy = clamp(amoeba.energy + snack * 80.0, 0.0, 140.0)
	if amoeba.energy > 92.0 and amoeba.cooldown <= 0.0 and local_count(amoeba.pos, "amoeboid", 42.0) < 9:
		var child = spawn("amoeboid", amoeba.pos + _random_vec(18.0), amoeba)
		if child:
			child.energy = 45.0
			amoeba.energy -= 28.0
			amoeba.cooldown = 5.5 / amoeba.fertility
	if amoeba.energy <= 0.0 or amoeba.age > 170.0 + rng.randf_range(0.0, 80.0):
		amoeba.dead = true


func _update_grazer(grazer: Dictionary, delta: float) -> void:
	grazer.age += delta
	grazer.cooldown -= delta
	grazer.energy -= delta * (0.72 * grazer.metabolism + 0.11 * grazer.speed + grazer.armor * 0.05)
	var predator = nearest(grazer, "predator", 112.0 * grazer.sensory)
	var target: Vector2 = grazer.pos + grazer.vel * 24.0
	if predator and predator.aggression > grazer.camouflage:
		target = grazer.pos - (predator.pos - grazer.pos) * 1.35
	else:
		var food := best_microbe(grazer.pos, 110.0 * grazer.sensory)
		if food != Vector2.INF:
			target = food
		var neighbor = nearest(grazer, "grazer", 64.0)
		if neighbor and grazer.pos.distance_to(neighbor.pos) > 20.0:
			target = target.lerp(neighbor.pos, 0.18)
	move_organism(grazer, target, 23.0 * grazer.speed, delta)
	var c := cell_at_world(grazer.pos)
	if c.microbes > 0.035:
		var bite: float = min(c.microbes, 0.018 + grazer.size * 0.004)
		c.microbes -= bite
		grazer.energy = clamp(grazer.energy + bite * 170.0, 0.0, 155.0)
	if c.decay > 0.04:
		var scavenge: float = min(c.decay, 0.014)
		c.decay -= scavenge
		grazer.energy = clamp(grazer.energy + scavenge * 85.0, 0.0, 155.0)
	if grazer.energy > 118.0 and grazer.cooldown <= 0.0 and local_count(grazer.pos, "grazer", 70.0) < 7:
		var child = spawn("grazer", grazer.pos + _random_vec(22.0), grazer)
		if child:
			child.energy = 58.0
			grazer.energy -= 52.0
			grazer.cooldown = 12.0 / grazer.fertility
	if grazer.energy <= 0.0 or grazer.age > 250.0 + rng.randf_range(0.0, 120.0):
		grazer.dead = true


func _update_predator(predator: Dictionary, delta: float) -> void:
	predator.age += delta
	predator.cooldown -= delta
	predator.energy -= delta * (0.92 * predator.metabolism + 0.18 * predator.speed + predator.size * 0.05)
	var prey = nearest_prey(predator, 125.0 * predator.sensory)
	var target: Vector2 = prey.pos if prey else predator.pos + predator.vel * 50.0
	move_organism(predator, target, 36.0 * predator.speed, delta)
	if prey and predator.pos.distance_squared_to(prey.pos) < pow(12.0 + predator.size * 2.0, 2.0):
		var defense: float = prey.armor + prey.speed * 0.18 + prey.camouflage * 0.25
		var attack: float = predator.aggression + predator.speed * 0.24 + predator.size * 0.1
		if rng.randf() < clamp(0.72 + attack - defense, 0.14, 0.96):
			prey.dead = true
			predator.energy = clamp(predator.energy + 38.0 + prey.size * 14.0, 0.0, 170.0)
		else:
			predator.energy -= 5.0
	if predator.energy > 138.0 and predator.cooldown <= 0.0 and local_count(predator.pos, "predator", 94.0) < 4:
		var child = spawn("predator", predator.pos + _random_vec(28.0), predator)
		if child:
			child.energy = 68.0
			predator.energy -= 72.0
			predator.cooldown = 22.0
	if predator.energy <= 0.0 or predator.age > 230.0 + rng.randf_range(0.0, 90.0):
		predator.dead = true


func move_organism(organism: Dictionary, target: Vector2, speed: float, delta: float) -> void:
	var dir: Vector2 = (target - organism.pos).normalized()
	if dir.length() == 0.0:
		dir = _random_vec(1.0).normalized()
	var turn_rate := clamp(0.03 + speed * 0.00012, 0.035, 0.055)
	organism.vel = organism.vel.lerp(dir, turn_rate).normalized()
	var next: Vector2 = organism.pos + organism.vel * speed * delta
	var c := cell_at_world(next)
	if _is_blocking_terrain(c.type) and not c.vent:
		organism.vel = -organism.vel.rotated(rng.randf_range(-0.9, 0.9))
	else:
		organism.pos = Vector2(clamp(next.x, 5.0, WORLD_SIZE.x - 5.0), clamp(next.y, 5.0, WORLD_SIZE.y - 5.0))


func spawn(kind: String, pos: Vector2, parent = null):
	var c := cell_at_world(pos)
	if _is_blocking_terrain(c.type) and not c.vent:
		return null
	var organism := {
		"kind": kind,
		"pos": pos,
		"prev_pos": pos,
		"vel": _random_vec(1.0).normalized(),
		"prev_vel": Vector2.ZERO,
		"energy": 84.0,
		"age": 0.0,
		"cooldown": rng.randf_range(1.0, 8.0),
		"dead": false,
		"generation": 1 if parent == null else int(parent.generation) + 1,
		"lineage": "%s-%03d" % [kind, rng.randi_range(1, 999)],
	}
	if kind == "amoeboid":
		organism.speed = evolution.mutate(parent.speed if parent else 0.92, rng, 0.08, 0.2, 2.4)
		organism.sensory = evolution.mutate(parent.sensory if parent else 1.05, rng, 0.08, 0.2, 2.5)
		organism.fertility = evolution.mutate(parent.fertility if parent else 1.34, rng, 0.09, 0.2, 2.7)
		organism.metabolism = evolution.mutate(parent.metabolism if parent else 0.82, rng, 0.07, 0.15, 2.2)
		organism.armor = evolution.mutate(parent.armor if parent else 0.08, rng, 0.03, 0.0, 1.3)
		organism.aggression = evolution.mutate(parent.aggression if parent else 0.16, rng, 0.05, 0.0, 2.0)
		organism.camouflage = evolution.mutate(parent.camouflage if parent else 0.5, rng, 0.06, 0.0, 2.0)
		organism.oxygen_tolerance = evolution.mutate(parent.oxygen_tolerance if parent else 0.22, rng, 0.05, 0.0, 2.0)
		organism.size = evolution.mutate(parent.size if parent else 0.68, rng, 0.04, 0.35, 1.35)
		organism.energy = 72.0
	elif kind == "grazer":
		organism.speed = evolution.mutate(parent.speed if parent else 0.74, rng, 0.05, 0.2, 1.9)
		organism.sensory = evolution.mutate(parent.sensory if parent else 0.9, rng, 0.06, 0.2, 2.2)
		organism.fertility = evolution.mutate(parent.fertility if parent else 0.92, rng, 0.05, 0.2, 1.9)
		organism.metabolism = evolution.mutate(parent.metabolism if parent else 0.95, rng, 0.05, 0.15, 2.2)
		organism.armor = evolution.mutate(parent.armor if parent else 0.55, rng, 0.06, 0.0, 2.2)
		organism.aggression = evolution.mutate(parent.aggression if parent else 0.18, rng, 0.04, 0.0, 1.6)
		organism.camouflage = evolution.mutate(parent.camouflage if parent else 0.68, rng, 0.06, 0.0, 2.2)
		organism.oxygen_tolerance = evolution.mutate(parent.oxygen_tolerance if parent else 0.42, rng, 0.05, 0.0, 2.2)
		organism.size = evolution.mutate(parent.size if parent else 1.08, rng, 0.05, 0.55, 2.2)
		organism.energy = 88.0
	else:
		organism.speed = evolution.mutate(parent.speed if parent else 0.82, rng, 0.06, 0.25, 2.2)
		organism.sensory = evolution.mutate(parent.sensory if parent else 0.98, rng, 0.08, 0.2, 2.6)
		organism.fertility = evolution.mutate(parent.fertility if parent else 0.62, rng, 0.04, 0.12, 1.6)
		organism.metabolism = evolution.mutate(parent.metabolism if parent else 1.16, rng, 0.06, 0.2, 2.6)
		organism.armor = evolution.mutate(parent.armor if parent else 0.28, rng, 0.05, 0.0, 2.2)
		organism.aggression = evolution.mutate(parent.aggression if parent else 0.96, rng, 0.08, 0.1, 2.7)
		organism.camouflage = evolution.mutate(parent.camouflage if parent else 0.38, rng, 0.05, 0.0, 2.0)
		organism.oxygen_tolerance = evolution.mutate(parent.oxygen_tolerance if parent else 0.55, rng, 0.05, 0.0, 2.4)
		organism.size = evolution.mutate(parent.size if parent else 1.18, rng, 0.06, 0.6, 2.7)
		organism.energy = 94.0
	organisms.append(organism)
	return organism


func paint_cell(cx: int, cy: int, tool: String, radius: int, update_events: bool = true) -> void:
	for y in range(cy - radius, cy + radius + 1):
		for x in range(cx - radius, cx + radius + 1):
			if x < 0 or y < 0 or x >= GRID_W or y >= GRID_H or Vector2(x - cx, y - cy).length() > radius + rng.randf():
				continue
			var c := cell(x, y)
			match tool:
				"Cyanobacteria":
					if _is_life_terrain(c.type):
						c.microbes = clamp(c.microbes + 0.52, 0.0, 1.0)
						c.nutrients = clamp(c.nutrients + 0.08, 0.0, 1.45)
				"Tidal Nutrients":
					if not _is_blocking_terrain(c.type):
						c.type = "tidal"
						c.depth = 0.25
						c.water = 1.0
						c.nutrients = 1.25
				"Volcanic Rock":
					c.type = "volcanic"
					c.depth = 0.06
					c.microbes = 0.0
					c.vent = rng.randf() < 0.18
					c.nutrients = clamp(c.nutrients + 0.25, 0.0, 1.45)
				"Hydrothermal Vent":
					c.type = "volcanic"
					c.vent = true
					c.nutrients = 1.45
					c.water = 0.85
				"Eraser":
					c.type = "shelf"
					c.depth = 0.48
					c.microbes = 0.0
					c.decay = 0.0
					c.fungus = 0.0
					c.vent = false
	if tool == "Amoeboids":
		for i in range(10):
			spawn("amoeboid", Vector2(cx * CELL, cy * CELL) + _random_vec(24.0))
	elif tool == "Grazers":
		for i in range(5):
			spawn("grazer", Vector2(cx * CELL, cy * CELL) + _random_vec(26.0))
	elif tool == "Predatory Swimmers":
		for i in range(3):
			spawn("predator", Vector2(cx * CELL, cy * CELL) + _random_vec(28.0))
	elif tool == "Eraser":
		organisms = organisms.filter(func(organism: Dictionary) -> bool: return (organism.pos / CELL).distance_to(Vector2(cx, cy)) > radius + 2)
	if update_events:
		events.append({"day": day, "type": "Tool: " + tool})


func disaster(label: String) -> void:
	events.append({"day": day, "type": label})
	match label:
		"Heat Pulse":
			weather = "heat pulse"
			weather_timer = 720
			climate_heat = clamp(climate_heat + 0.18, 0.0, 1.0)
		"Monsoon":
			weather = "storm rain"
			weather_timer = 520
			climate_heat = clamp(climate_heat - 0.08, 0.0, 1.0)
			for c in cells:
				if not _is_blocking_terrain(c.type):
					c.water = 1.0
					c.nutrients = clamp(c.nutrients + 0.16, 0.0, 1.45)
		"Viral Bloom":
			for organism in organisms:
				if rng.randf() < (0.22 if organism.kind == "amoeboid" else 0.13):
					organism.dead = true
		"Impact Event":
			var impact := Vector2(rng.randi_range(10, GRID_W - 10), rng.randi_range(8, GRID_H - 8))
			for y in range(int(impact.y) - 6, int(impact.y) + 7):
				for x in range(int(impact.x) - 6, int(impact.x) + 7):
					if x >= 0 and y >= 0 and x < GRID_W and y < GRID_H and Vector2(x, y).distance_to(impact) < 6.5:
						var c := cell(x, y)
						c.type = "volcanic" if rng.randf() < 0.76 else "basalt"
						c.microbes = 0.0
						c.decay += 0.4
						c.vent = rng.randf() < 0.09
		"Predator Surge":
			for i in range(5):
				spawn("predator", _random_open_water_pos())
		"Seed Recovery":
			rebalance()


func rebalance() -> void:
	var s := stats()
	if s.microbes < 260:
		for i in range(160):
			paint_cell(rng.randi_range(3, GRID_W - 4), rng.randi_range(3, GRID_H - 4), "Cyanobacteria", 2, false)
	if s.amoeboids < 20:
		for i in range(24):
			spawn("amoeboid", _random_open_water_pos())
	if s.grazers < 8 and s.microbes > 220:
		for i in range(10):
			spawn("grazer", _random_open_water_pos())
	if s.predators < 2 and s.grazers + s.amoeboids > 36:
		for i in range(3):
			spawn("predator", _random_open_water_pos())
	for c in cells:
		if not _is_blocking_terrain(c.type):
			c.nutrients = clamp(c.nutrients + 0.14, 0.0, 1.45)


func stats() -> Dictionary:
	var microbe_cells := 0
	var fungal_cells := 0
	var nutrients := 0.0
	var water := 0.0
	var amoeboids := 0
	var grazers := 0
	var predators := 0
	var speed_total := 0.0
	var armor_total := 0.0
	var oxygen_tol_total := 0.0
	var aggression_total := 0.0
	var max_generation := 1
	for c in cells:
		if c.microbes > 0.05:
			microbe_cells += 1
		if c.fungus > 0.05:
			fungal_cells += 1
		nutrients += c.nutrients
		water += c.water
	for organism in organisms:
		max_generation = max(max_generation, int(organism.generation))
		speed_total += organism.speed
		armor_total += organism.armor
		oxygen_tol_total += organism.oxygen_tolerance
		aggression_total += organism.aggression
		match organism.kind:
			"amoeboid":
				amoeboids += 1
			"grazer":
				grazers += 1
			"predator":
				predators += 1
	var raw := {
		"microbes": microbe_cells,
		"fungal": fungal_cells,
		"amoeboids": amoeboids,
		"grazers": grazers,
		"predators": predators,
	}
	var biodiversity := evolution.biodiversity_score(raw)
	return {
		"microbes": microbe_cells,
		"fungal": fungal_cells,
		"amoeboids": amoeboids,
		"grazers": grazers,
		"predators": predators,
		"avg_speed": speed_total / max(1, organisms.size()),
		"avg_armor": armor_total / max(1, organisms.size()),
		"avg_oxygen_tolerance": oxygen_tol_total / max(1, organisms.size()),
		"avg_aggression": aggression_total / max(1, organisms.size()),
		"nutrients": nutrients / cells.size(),
		"water": water / cells.size(),
		"oxygen": oxygen,
		"co2": co2,
		"climate_heat": climate_heat,
		"biodiversity": biodiversity,
		"max_generation": max_generation,
	}


func _sample_history() -> void:
	var s := stats()
	history.append({
		"microbes": s.microbes,
		"amoeboids": s.amoeboids,
		"grazers": s.grazers,
		"predators": s.predators,
		"fungal": s.fungal,
		"biodiversity": s.biodiversity,
		"day": day,
	})
	if history.size() > HISTORY_MAX:
		history.pop_front()


func planet_age_mya() -> float:
	return max(520.0, 4100.0 - float(tick) * 0.045)


func era_data() -> Dictionary:
	return evolution.era_for_age(planet_age_mya())


func weather_text() -> String:
	return weather_model.weather_description(weather, climate_heat)


func season_name() -> String:
	return weather_model.season_name(season)


func select_tool(index: int) -> void:
	selected_tool = clampi(index, 0, TOOLS.size() - 1)


func tool_at_screen(screen_pos: Vector2) -> void:
	var local := screen_pos - WORLD_OFFSET
	if local.x < 0.0 or local.y < 0.0 or local.x >= WORLD_SIZE.x or local.y >= WORLD_SIZE.y:
		return
	var x := int(local.x / CELL)
	var y := int(local.y / CELL)
	paint_cell(x, y, TOOLS[selected_tool], 3)


func cell(x: int, y: int) -> Dictionary:
	return cells[clampi(y, 0, GRID_H - 1) * GRID_W + clampi(x, 0, GRID_W - 1)]


func cell_at_world(pos: Vector2) -> Dictionary:
	return cell(int(pos.x / CELL), int(pos.y / CELL))


func _rebuild_spatial() -> void:
	spatial.clear()
	for organism in organisms:
		if organism.dead:
			continue
		var key := _bucket_key(organism.pos)
		if not spatial.has(key):
			spatial[key] = []
		spatial[key].append(organism)


func nearest(me: Dictionary, kind: String, radius: float):
	var best = null
	var best_d := radius * radius
	for other in nearby(me.pos, radius):
		if other == me or other.dead or other.kind != kind:
			continue
		var d: float = me.pos.distance_squared_to(other.pos)
		if d < best_d:
			best = other
			best_d = d
	return best


func nearest_prey(predator: Dictionary, radius: float):
	var best = null
	var best_d := radius * radius
	for other in nearby(predator.pos, radius):
		if other == predator or other.dead or other.kind == "predator":
			continue
		var d: float = predator.pos.distance_squared_to(other.pos)
		if d < best_d:
			best = other
			best_d = d
	return best


func nearby(pos: Vector2, radius: float) -> Array:
	var found: Array = []
	var center := _bucket_key(pos)
	var steps := int(ceil(radius / BUCKET_SIZE))
	for by in range(center.y - steps, center.y + steps + 1):
		for bx in range(center.x - steps, center.x + steps + 1):
			var key := Vector2i(bx, by)
			if spatial.has(key):
				found.append_array(spatial[key])
	return found


func local_count(pos: Vector2, kind: String, radius: float) -> int:
	var count := 0
	var rr := radius * radius
	for organism in nearby(pos, radius):
		if organism.kind == kind and not organism.dead and pos.distance_squared_to(organism.pos) < rr:
			count += 1
	return count


func best_microbe(pos: Vector2, radius: float) -> Vector2:
	var cx := int(pos.x / CELL)
	var cy := int(pos.y / CELL)
	var cr := int(ceil(radius / CELL))
	var best := Vector2.INF
	var best_score := -999.0
	for y in range(cy - cr, cy + cr + 1):
		for x in range(cx - cr, cx + cr + 1):
			if x < 0 or y < 0 or x >= GRID_W or y >= GRID_H:
				continue
			var c := cell(x, y)
			if c.microbes < 0.055 and c.fungus < 0.08:
				continue
			var point := Vector2(x * CELL + CELL * 0.5, y * CELL + CELL * 0.5)
			var score: float = c.microbes * 2.0 + c.fungus * 0.5 - point.distance_to(pos) / max(1.0, radius)
			if score > best_score:
				best = point
				best_score = score
	return best


func _bucket_key(pos: Vector2) -> Vector2i:
	return Vector2i(int(pos.x / BUCKET_SIZE), int(pos.y / BUCKET_SIZE))


func _random_open_water_pos() -> Vector2:
	for i in range(80):
		var pos := Vector2(rng.randf_range(80.0, WORLD_SIZE.x - 80.0), rng.randf_range(80.0, WORLD_SIZE.y - 80.0))
		var c := cell_at_world(pos)
		if _is_ocean_terrain(c.type) or c.vent:
			return pos
	return WORLD_SIZE * 0.5


func _random_vec(radius: float) -> Vector2:
	var angle := rng.randf_range(0.0, TAU)
	var dist := rng.randf_range(0.0, radius)
	return Vector2(cos(angle), sin(angle)) * dist


func _noise(x: int, y: int) -> float:
	var noise := sin(float(x) * 12.9898 + float(y) * 78.233 + float(abs(hash(seed_text)) % 9999)) * 43758.5453
	return noise - floor(noise)


func _is_ocean_terrain(terrain: String) -> bool:
	return terrain == "deep_ocean" or terrain == "shallow" or terrain == "tidal" or terrain == "shelf"


func _is_life_terrain(terrain: String) -> bool:
	return terrain == "tidal" or terrain == "shallow" or terrain == "shelf"


func _is_shallow_terrain(terrain: String) -> bool:
	return terrain == "tidal" or terrain == "shallow"


func _is_blocking_terrain(terrain: String) -> bool:
	return terrain == "basalt" or terrain == "volcanic"


func _is_rain_weather(value: String) -> bool:
	return value == "warm rain" or value == "storm rain" or value == "monsoon"
