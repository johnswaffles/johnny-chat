extends RefCounted

const PlanetSimulation = preload("res://scripts/simulation/planet_simulation.gd")


func draw_background(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	canvas.draw_rect(Rect2(Vector2.ZERO, Vector2(1440, 900)), Color("#030916"))
	canvas.draw_circle(Vector2(255, 100), 260, Color(0.14, 0.72, 0.9, 0.08))
	canvas.draw_circle(Vector2(1110, 120), 320, Color(0.52, 0.34, 1.0, 0.08))
	canvas.draw_circle(Vector2(800, 725), 520, Color(0.0, 0.35, 0.55, 0.08))
	for i in range(10):
		var y := 120.0 + i * 72.0 + sin((sim.tick + i * 31) * 0.002) * 10.0
		canvas.draw_line(Vector2(230, y), Vector2(1160, y + 24.0), Color(0.25, 0.84, 0.95, 0.025), 3.0)
	canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET - Vector2(10, 10), PlanetSimulation.WORLD_SIZE + Vector2(20, 20)), Color(0.5, 0.95, 1.0, 0.08), false, 2.0)


func draw_world(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color("#04182b"))
	var busy_world := sim.organisms.size() > 90
	for y in range(PlanetSimulation.GRID_H):
		for x in range(PlanetSimulation.GRID_W):
			var c := sim.cell(x, y)
			var pos := PlanetSimulation.WORLD_OFFSET + Vector2(x, y) * PlanetSimulation.CELL
			var center := pos + Vector2(PlanetSimulation.CELL * 0.5, PlanetSimulation.CELL * 0.5)
			var color := terrain_color(c, sim)
			var sediment := float(c.sediment)
			var terrain_radius := PlanetSimulation.CELL * (0.84 + sediment * 0.38)
			if c.type == "deep_ocean":
				if (x + y) % 3 != 0:
					continue
				color.a = 0.18
				canvas.draw_circle(center + _organic_offset(x, y, sediment, 1.8), terrain_radius * 1.62, color)
			elif c.type == "shelf":
				color.a = 0.34
				canvas.draw_circle(center + _organic_offset(x, y, sediment, 2.3), terrain_radius * 1.48, color)
			else:
				color.a = 0.56
				canvas.draw_circle(center + _organic_offset(x, y, sediment, 2.8), terrain_radius * 1.38, color)
				if c.type == "tidal" or c.type == "shallow":
					canvas.draw_circle(center, terrain_radius * 0.82, Color(0.45, 0.95, 0.82, 0.035 + c.nutrients * 0.018))
				elif c.type == "volcanic":
					canvas.draw_circle(center, terrain_radius * 0.72, Color(1.0, 0.36, 0.2, 0.045))
			if _is_ocean_terrain(c.type):
				var shimmer := 0.018 + sin(float(x) * 0.72 + float(y) * 0.33 + sim.tick * 0.018) * 0.009
				if shimmer > 0.017 and (x * 5 + y * 7 + int(sim.tick / 10)) % 4 == 0:
					canvas.draw_circle(center, 5.2 + sediment * 2.5, Color(0.72, 0.96, 1.0, shimmer))
			if c.microbes > 0.17 and (not busy_world or (x + y + sim.tick) % 2 == 0):
				draw_microbe_mat(canvas, pos, c, sim.tick, busy_world)
			if c.fungus > 0.04 and (not busy_world or (x * 3 + y + sim.tick) % 2 == 0):
				draw_fungal_bloom(canvas, pos, c, busy_world)
			if c.vent:
				draw_vent(canvas, pos, sim.tick)


func draw_microbe_mat(canvas: CanvasItem, pos: Vector2, c: Dictionary, tick: int, simplified := false) -> void:
	var pulse := 0.76 + sin(tick * 0.03 + c.sediment * 6.0) * 0.16
	var alpha: float = 0.08 + c.microbes * 0.36
	var offset := Vector2(3.0 + c.sediment * 6.0, 4.0 + sin(c.sediment * 5.4) * 2.8)
	var center := pos + offset
	var radius: float = 4.0 + c.microbes * 7.5
	canvas.draw_circle(center, radius, Color(0.14, 0.76, 0.54, alpha * 0.38))
	canvas.draw_circle(center + Vector2(3.2, -1.8), radius * 0.42, Color(0.72, 1.0, 0.5, alpha * pulse))
	canvas.draw_circle(center + Vector2(-2.8, 2.2), radius * 0.32, Color(0.16, 0.86, 0.82, alpha * 0.72))
	if simplified:
		return
	for i in range(3):
		var bend := sin(float(i) * 2.3 + c.sediment * 7.0 + tick * 0.014) * 2.2
		var y := -radius * 0.35 + i * radius * 0.33
		canvas.draw_line(center + Vector2(-radius * 0.48, y), center + Vector2(radius * 0.52, y + bend), Color(0.74, 1.0, 0.66, alpha * 0.18), 1.0)


func draw_fungal_bloom(canvas: CanvasItem, pos: Vector2, c: Dictionary, simplified := false) -> void:
	var alpha: float = 0.16 + c.fungus * 0.48
	canvas.draw_circle(pos + Vector2(6.0, 6.0), 2.0 + c.fungus * 5.0, Color(0.76, 0.35, 1.0, alpha))
	if not simplified:
		canvas.draw_circle(pos + Vector2(8.0, 6.5), 0.8 + c.fungus * 1.8, Color(1.0, 0.68, 1.0, alpha * 0.9))


func draw_vent(canvas: CanvasItem, pos: Vector2, tick: int) -> void:
	canvas.draw_circle(pos + Vector2(6, 6), 7.4, Color(1.0, 0.36, 0.18, 0.1))
	canvas.draw_circle(pos + Vector2(6, 6), 2.4, Color(1.0, 0.64, 0.26, 0.52))
	var plume := sin(tick * 0.05 + pos.x * 0.03) * 2.0
	canvas.draw_line(pos + Vector2(6, 6), pos + Vector2(6 + plume, -5), Color(0.9, 0.74, 0.5, 0.18), 2.0)


func draw_organisms(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	var t := sim.render_alpha * sim.render_alpha * (3.0 - 2.0 * sim.render_alpha)
	for organism in sim.organisms:
		var p: Vector2 = PlanetSimulation.WORLD_OFFSET + organism.prev_pos.lerp(organism.pos, t)
		var draw_vel: Vector2 = organism.prev_vel.lerp(organism.vel, t)
		if draw_vel.length_squared() < 0.0001:
			draw_vel = organism.vel
		p += draw_vel * float(organism.get("speed", 1.0)) * 0.16 * (t - 0.5)
		match organism.kind:
			"amoeboid":
				draw_amoeboid(canvas, p, organism, sim.tick, draw_vel)
			"grazer":
				draw_grazer(canvas, p, organism, sim.tick, draw_vel)
			"predator":
				draw_predator(canvas, p, organism, sim.tick, draw_vel)


func draw_amoeboid(canvas: CanvasItem, p: Vector2, organism: Dictionary, tick: int, draw_vel: Vector2) -> void:
	var r: float = 4.2 + organism.size * 2.1
	var wobble := sin(tick * 0.08 + organism.generation) * 0.9
	var pts := PackedVector2Array()
	for i in range(10):
		var a := float(i) / 10.0 * TAU
		var rr := r + sin(a * 3.0 + tick * 0.05 + organism.sensory) * 0.9 + wobble * 0.25
		pts.append(p + Vector2(cos(a), sin(a)) * rr)
	canvas.draw_circle(p, r * 1.75, Color(0.25, 0.95, 1.0, 0.12))
	canvas.draw_colored_polygon(pts, Color(0.38, 0.92, 1.0, 0.72))
	canvas.draw_circle(p + draw_vel * 2.2, 1.1, Color(0.88, 1.0, 1.0, 0.86))


func draw_grazer(canvas: CanvasItem, p: Vector2, organism: Dictionary, tick: int, draw_vel: Vector2) -> void:
	var angle: float = draw_vel.angle()
	var forward := Vector2(cos(angle), sin(angle))
	var side := Vector2(-forward.y, forward.x)
	var length: float = 8.5 + organism.size * 4.0
	var width: float = 4.0 + organism.armor * 2.0
	canvas.draw_circle(p, length * 0.9, Color(0.35, 0.8, 0.78, 0.08))
	var body := PackedVector2Array([
		p + forward * length,
		p + side * width + forward * length * 0.2,
		p + side * width * 0.75 - forward * length * 0.72,
		p - forward * length,
		p - side * width * 0.75 - forward * length * 0.72,
		p - side * width + forward * length * 0.2,
	])
	canvas.draw_colored_polygon(body, Color(0.25, 0.74, 0.68, 0.86))
	for i in range(4):
		var t := -0.5 + i * 0.32
		canvas.draw_line(p + forward * length * t - side * width * 0.8, p + forward * length * t + side * width * 0.8, Color(0.82, 1.0, 0.87, 0.34), 1.2)
	canvas.draw_circle(p + forward * length * 0.76, 1.2, Color(0.98, 1.0, 0.82, 0.9))


func draw_predator(canvas: CanvasItem, p: Vector2, organism: Dictionary, tick: int, draw_vel: Vector2) -> void:
	var angle: float = draw_vel.angle()
	var forward := Vector2(cos(angle), sin(angle))
	var side := Vector2(-forward.y, forward.x)
	var length: float = 10.0 + organism.size * 4.6
	var width: float = 4.2 + organism.aggression * 1.5
	canvas.draw_circle(p, length * 1.2, Color(1.0, 0.28, 0.16, 0.12))
	var body := PackedVector2Array([
		p + forward * length,
		p + side * width,
		p - forward * length * 0.62 + side * width * 0.52,
		p - forward * length * 0.36,
		p - forward * length * 0.62 - side * width * 0.52,
		p - side * width,
	])
	canvas.draw_colored_polygon(body, Color(1.0, 0.35, 0.18, 0.9))
	canvas.draw_line(p - forward * length * 0.45, p - forward * length * 0.9 + side * width * 0.75, Color(1.0, 0.72, 0.3, 0.52), 1.4)
	canvas.draw_line(p - forward * length * 0.45, p - forward * length * 0.9 - side * width * 0.75, Color(1.0, 0.72, 0.3, 0.52), 1.4)
	canvas.draw_circle(p + forward * length * 0.64, 1.2, Color(1.0, 0.95, 0.48, 0.96))


func draw_overlay(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	_draw_plankton_field(canvas, sim)
	if _is_rain_weather(sim.weather):
		var count := 120 if sim.weather == "storm rain" else 74
		for i in range(count):
			var x := fmod(i * 97.0 + sim.tick * 4.0, PlanetSimulation.WORLD_SIZE.x)
			var y := fmod(i * 53.0 + sim.tick * 11.0, PlanetSimulation.WORLD_SIZE.y)
			canvas.draw_line(PlanetSimulation.WORLD_OFFSET + Vector2(x, y), PlanetSimulation.WORLD_OFFSET + Vector2(x - 8, y + 18), Color(0.76, 0.92, 1.0, 0.24), 1.0)
	if sim.weather == "heat pulse":
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(1.0, 0.38, 0.14, 0.11))
	if sim.weather == "ash cloud":
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(0.08, 0.07, 0.1, 0.22))
	var night: float = max(0.0, cos(fmod(sim.tick, 180.0) / 180.0 * TAU)) * 0.22
	if night > 0.02:
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(0.01, 0.02, 0.09, night))
		for organism in sim.organisms:
			if organism.kind != "predator":
				var p: Vector2 = PlanetSimulation.WORLD_OFFSET + organism.pos
				canvas.draw_circle(p, 5.0 + organism.size * 2.0, Color(0.25, 0.92, 1.0, night * 0.3))


func terrain_color(c: Dictionary, sim: PlanetSimulation) -> Color:
	var base := Color("#0a3048")
	match c.type:
		"deep_ocean":
			base = Color("#031f35")
		"shelf":
			base = Color("#0b4056")
		"shallow":
			base = Color("#145b61")
		"tidal":
			base = Color("#355d4c")
		"basalt":
			base = Color("#242d39")
		"volcanic":
			base = Color("#38272f")
	var heat: float = sim.climate_heat * 0.06 + c.temperature * 0.04
	var nutrient: float = c.nutrients * 0.055
	return base.lightened(nutrient).darkened(c.depth * 0.04).lerp(Color("#5b2f2a"), heat)


func _organic_offset(x: int, y: int, sediment: float, amount: float) -> Vector2:
	return Vector2(
		sin(float(x) * 1.73 + sediment * 6.1) * amount,
		cos(float(y) * 1.37 + sediment * 5.4) * amount
	)


func _draw_plankton_field(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	for i in range(110):
		var seed := float(i)
		var x := fmod(seed * 97.37 + sin(sim.tick * 0.012 + seed) * 28.0, PlanetSimulation.WORLD_SIZE.x)
		var y := fmod(seed * 61.91 + sim.tick * (0.12 + fmod(seed, 5.0) * 0.018), PlanetSimulation.WORLD_SIZE.y)
		var glow := 0.08 + sin(sim.tick * 0.04 + seed * 2.1) * 0.045
		canvas.draw_circle(PlanetSimulation.WORLD_OFFSET + Vector2(x, y), 0.9 + fmod(seed, 3.0) * 0.3, Color(0.5, 0.92, 1.0, glow))


func _is_ocean_terrain(terrain: String) -> bool:
	return terrain == "deep_ocean" or terrain == "shallow" or terrain == "tidal" or terrain == "shelf"


func _is_rain_weather(value: String) -> bool:
	return value == "warm rain" or value == "storm rain" or value == "monsoon"
