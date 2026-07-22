extends RefCounted

const PlanetSimulation = preload("res://scripts/simulation/planet_simulation.gd")


func draw_background(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	canvas.draw_rect(Rect2(Vector2.ZERO, Vector2(1440, 810)), Color("#020812"))
	canvas.draw_circle(Vector2(190, 90), 250, Color(0.08, 0.55, 0.72, 0.08))
	canvas.draw_circle(Vector2(1230, 130), 330, Color(0.38, 0.28, 0.72, 0.07))
	canvas.draw_circle(Vector2(770, 670), 470, Color(0.0, 0.34, 0.42, 0.065))
	if not sim.reduced_motion:
		for i in range(6):
			var y := 108.0 + i * 110.0 + sin((sim.tick + i * 31) * 0.006) * 5.0
			canvas.draw_line(Vector2(230, y), Vector2(1180, y + 18.0), Color(0.25, 0.84, 0.95, 0.025), 2.0)
	canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET - Vector2(4, 4), PlanetSimulation.WORLD_SIZE + Vector2(8, 8)), Color(0.42, 0.92, 0.95, 0.13), false, 2.0)


func draw_world(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color("#061b2b"))
	var busy_world := sim.organisms.size() >= 82
	var saturated_world := sim.organisms.size() >= 118
	for y in range(PlanetSimulation.GRID_H):
		for x in range(PlanetSimulation.GRID_W):
			var c := sim.cell(x, y)
			var pos := PlanetSimulation.WORLD_OFFSET + Vector2(x, y) * PlanetSimulation.CELL
			var tile := Rect2(pos, Vector2(PlanetSimulation.CELL + 0.35, PlanetSimulation.CELL + 0.35))
			var color := terrain_color(c, sim)
			var variation: float = (float(c.sediment) - 0.5) * 0.045
			canvas.draw_rect(tile, color.lightened(max(0.0, variation)).darkened(max(0.0, -variation)))

			# Mature worlds are already visually dense. Drop decorative primitives
			# before they can monopolize the browser's render thread.
			if not saturated_world:
				if c.type == "tidal" or c.type == "shallow":
					canvas.draw_rect(Rect2(pos + Vector2(2, 2), Vector2(PlanetSimulation.CELL - 4, 2)), Color(0.55, 0.94, 0.72, 0.055 + c.nutrients * 0.025))
				elif c.type == "volcanic":
					canvas.draw_line(pos + Vector2(3, 10), pos + Vector2(11, 4), Color(0.96, 0.48, 0.29, 0.18), 1.0)
				elif c.type == "deep_ocean" and (x * 7 + y * 11) % 19 == 0:
					canvas.draw_line(pos + Vector2(3, 6), pos + Vector2(9, 6), Color(0.5, 0.85, 0.96, 0.08), 1.0)

				if x < PlanetSimulation.GRID_W - 1 and sim.cell(x + 1, y).type != c.type:
					canvas.draw_line(pos + Vector2(PlanetSimulation.CELL, 1), pos + Vector2(PlanetSimulation.CELL, PlanetSimulation.CELL - 1), Color(0.54, 0.88, 0.84, 0.065), 1.0)
				if y < PlanetSimulation.GRID_H - 1 and sim.cell(x, y + 1).type != c.type:
					canvas.draw_line(pos + Vector2(1, PlanetSimulation.CELL), pos + Vector2(PlanetSimulation.CELL - 1, PlanetSimulation.CELL), Color(0.54, 0.88, 0.84, 0.055), 1.0)

			var draw_mat: bool = c.microbes > 0.11
			if saturated_world:
				draw_mat = draw_mat and (x * 3 + y * 5) % 4 == 0
			elif busy_world:
				draw_mat = draw_mat and (x + y) % 2 == 0
			if draw_mat:
				draw_microbe_mat(canvas, pos, c, sim.tick, busy_world or sim.reduced_motion)
			if c.fungus > 0.08 and (not busy_world or (x + y) % 3 == 0):
				draw_fungal_bloom(canvas, pos, c)
			if c.vent:
				draw_vent(canvas, pos, sim.tick, sim.reduced_motion)


func draw_microbe_mat(canvas: CanvasItem, pos: Vector2, c: Dictionary, tick: int, simplified := false) -> void:
	var pulse := 0.88 if simplified else 0.82 + sin(tick * 0.025 + c.sediment * 6.0) * 0.12
	var alpha: float = 0.16 + c.microbes * 0.5
	var center := pos + Vector2(7.0, 7.0)
	var radius: float = 2.2 + c.microbes * 3.2
	if simplified:
		canvas.draw_circle(center, radius + 0.8, Color(0.32, 0.9, 0.55, alpha * pulse))
		return
	canvas.draw_circle(center, radius + 2.5, Color(0.08, 0.8, 0.56, alpha * 0.16))
	canvas.draw_circle(center, radius, Color(0.42, 0.94, 0.55, alpha * pulse))
	canvas.draw_circle(center + Vector2(-3.8, 2.3), radius * 0.42, Color(0.1, 0.9, 0.8, alpha * 0.82))
	canvas.draw_circle(center + Vector2(3.4, -2.0), radius * 0.3, Color(0.8, 1.0, 0.58, alpha))


func draw_fungal_bloom(canvas: CanvasItem, pos: Vector2, c: Dictionary) -> void:
	var center := pos + Vector2(7, 7)
	canvas.draw_circle(center, 2.0 + c.fungus * 3.5, Color(0.76, 0.36, 0.96, 0.34 + c.fungus * 0.3))
	canvas.draw_circle(center, 1.2, Color(1.0, 0.72, 0.98, 0.72))


func draw_vent(canvas: CanvasItem, pos: Vector2, tick: int, still := false) -> void:
	var center := pos + Vector2(7, 8)
	canvas.draw_circle(center, 5.5, Color(1.0, 0.35, 0.15, 0.13))
	canvas.draw_circle(center, 2.2, Color(1.0, 0.72, 0.25, 0.78))
	var plume := 0.0 if still else sin(tick * 0.04 + pos.x * 0.03) * 1.4
	canvas.draw_line(center, center + Vector2(plume, -9), Color(0.95, 0.8, 0.56, 0.2), 1.5)


func draw_organisms(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	var t := sim.render_alpha * sim.render_alpha * (3.0 - 2.0 * sim.render_alpha)
	for organism in sim.organisms:
		var p: Vector2 = PlanetSimulation.WORLD_OFFSET + organism.prev_pos.lerp(organism.pos, t)
		var velocity: Vector2 = organism.prev_vel.lerp(organism.vel, t)
		if velocity.length_squared() < 0.0001:
			velocity = Vector2.RIGHT
		match organism.kind:
			"amoeboid":
				draw_amoeboid(canvas, p, organism, sim.tick, sim.reduced_motion)
			"grazer":
				draw_grazer(canvas, p, organism, velocity)
			"predator":
				draw_predator(canvas, p, organism, velocity)


func draw_amoeboid(canvas: CanvasItem, p: Vector2, organism: Dictionary, tick: int, still := false) -> void:
	var r: float = 4.8 + organism.size * 1.7
	var wobble := 0.0 if still else sin(tick * 0.06 + organism.generation) * 0.55
	var points := PackedVector2Array()
	for i in range(8):
		var angle := float(i) / 8.0 * TAU
		var rr := r + sin(angle * 3.0 + wobble) * 0.7
		points.append(p + Vector2(cos(angle), sin(angle)) * rr)
	canvas.draw_circle(p, r * 1.42, Color(0.25, 0.9, 1.0, 0.09))
	canvas.draw_colored_polygon(points, Color(0.28, 0.86, 0.98, 0.92))
	canvas.draw_circle(p + Vector2(1.8, -1.2), 1.35, Color(0.91, 1.0, 1.0, 0.95))


func draw_grazer(canvas: CanvasItem, p: Vector2, organism: Dictionary, velocity: Vector2) -> void:
	var forward := velocity.normalized()
	var side := Vector2(-forward.y, forward.x)
	var length: float = 9.5 + organism.size * 3.2
	var width: float = 4.0 + organism.armor * 1.25
	var body := PackedVector2Array([
		p + forward * length,
		p + side * width + forward * length * 0.15,
		p + side * width * 0.7 - forward * length * 0.72,
		p - forward * length,
		p - side * width * 0.7 - forward * length * 0.72,
		p - side * width + forward * length * 0.15,
	])
	canvas.draw_circle(p, length * 0.8, Color(0.25, 0.88, 0.66, 0.07))
	canvas.draw_colored_polygon(body, Color(0.35, 0.78, 0.52, 0.94))
	canvas.draw_line(p - side * width * 0.72, p + side * width * 0.72, Color(0.84, 1.0, 0.72, 0.45), 1.2)
	canvas.draw_circle(p + forward * length * 0.66, 1.35, Color(1.0, 0.97, 0.62, 0.96))


func draw_predator(canvas: CanvasItem, p: Vector2, organism: Dictionary, velocity: Vector2) -> void:
	var forward := velocity.normalized()
	var side := Vector2(-forward.y, forward.x)
	var length: float = 12.0 + organism.size * 3.8
	var width: float = 4.8 + organism.aggression * 1.2
	var body := PackedVector2Array([
		p + forward * length,
		p + side * width,
		p - forward * length * 0.56 + side * width * 0.58,
		p - forward * length * 0.36,
		p - forward * length * 0.56 - side * width * 0.58,
		p - side * width,
	])
	canvas.draw_circle(p, length, Color(1.0, 0.3, 0.12, 0.11))
	canvas.draw_colored_polygon(body, Color(0.98, 0.32, 0.14, 0.96))
	canvas.draw_line(p - forward * length * 0.35, p - forward * length * 0.82 + side * width, Color(1.0, 0.76, 0.28, 0.7), 1.6)
	canvas.draw_line(p - forward * length * 0.35, p - forward * length * 0.82 - side * width, Color(1.0, 0.76, 0.28, 0.7), 1.6)
	canvas.draw_circle(p + forward * length * 0.64, 1.5, Color(1.0, 0.96, 0.4, 1.0))


func draw_overlay(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	_draw_plankton_field(canvas, sim)
	if _is_rain_weather(sim.weather):
		var count := 22 if sim.reduced_motion else (44 if sim.weather == "storm rain" else 30)
		for i in range(count):
			var x := fmod(i * 97.0 + sim.tick * (0.7 if sim.reduced_motion else 2.2), PlanetSimulation.WORLD_SIZE.x)
			var y := fmod(i * 53.0 + sim.tick * (1.2 if sim.reduced_motion else 5.0), PlanetSimulation.WORLD_SIZE.y)
			canvas.draw_line(PlanetSimulation.WORLD_OFFSET + Vector2(x, y), PlanetSimulation.WORLD_OFFSET + Vector2(x - 5, y + 12), Color(0.76, 0.92, 1.0, 0.18), 1.0)
	if sim.weather == "heat pulse":
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(1.0, 0.38, 0.14, 0.085))
	elif sim.weather == "ash cloud":
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(0.06, 0.055, 0.08, 0.2))
	var night: float = max(0.0, cos(fmod(sim.tick, 240.0) / 240.0 * TAU)) * 0.11
	if night > 0.02:
		canvas.draw_rect(Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE), Color(0.01, 0.02, 0.09, night))
	_draw_hotspot(canvas, sim)
	_draw_action_effects(canvas, sim)
	_draw_brush_cursor(canvas, sim)


func _draw_hotspot(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	if not sim.hotspot_active or sim.hotspot_cell.x < 0:
		return
	var center := PlanetSimulation.WORLD_OFFSET + (Vector2(sim.hotspot_cell) + Vector2(0.5, 0.5)) * PlanetSimulation.CELL
	var pulse := 0.0 if sim.reduced_motion else sin(sim.tick * 0.08) * 5.0
	var radius := 38.0 + pulse
	var color := Color(1.0, 0.82, 0.3, 0.8)
	canvas.draw_circle(center, radius + 10.0, Color(1.0, 0.75, 0.22, 0.045))
	var diamond := PackedVector2Array([
		center + Vector2(0, -radius),
		center + Vector2(radius, 0),
		center + Vector2(0, radius),
		center + Vector2(-radius, 0),
		center + Vector2(0, -radius),
	])
	canvas.draw_polyline(diamond, color, 2.0)
	canvas.draw_line(center - Vector2(9, 0), center + Vector2(9, 0), Color(1.0, 0.93, 0.58, 0.75), 1.0)
	canvas.draw_line(center - Vector2(0, 9), center + Vector2(0, 9), Color(1.0, 0.93, 0.58, 0.75), 1.0)


func _draw_action_effects(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	for effect in sim.action_effects:
		var age: float = effect.age
		var progress: float = clamp(age / 1.25, 0.0, 1.0)
		var center: Vector2 = PlanetSimulation.WORLD_OFFSET + Vector2(effect.pos)
		var color: Color = _tool_effect_color(int(effect.tool))
		color.a = (1.0 - progress) * 0.65
		var radius: float = 10.0 + progress * 42.0
		canvas.draw_rect(Rect2(center - Vector2(radius, radius), Vector2(radius * 2.0, radius * 2.0)), color, false, 2.0)
		if sim.reduced_motion:
			continue
		for i in range(5):
			var angle := float(i) / 5.0 * TAU + float(effect.tool) * 0.47
			var particle_pos: Vector2 = center + Vector2(cos(angle), sin(angle)) * radius * 0.68
			canvas.draw_circle(particle_pos, 2.2 * (1.0 - progress), color)


func _tool_effect_color(tool: int) -> Color:
	match tool:
		0:
			return Color("#69f39a")
		1:
			return Color("#67eaff")
		2:
			return Color("#c5e66f")
		3:
			return Color("#ff7148")
		4:
			return Color("#55dfb2")
		5:
			return Color("#ff9b62")
		6:
			return Color("#ffc85b")
	return Color("#d5f3f7")


func _draw_brush_cursor(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	if sim.hover_cell.x < 0:
		return
	var radius := 2
	var top_left := Vector2(max(0, sim.hover_cell.x - radius), max(0, sim.hover_cell.y - radius))
	var bottom_right := Vector2(min(PlanetSimulation.GRID_W, sim.hover_cell.x + radius + 1), min(PlanetSimulation.GRID_H, sim.hover_cell.y + radius + 1))
	var rect := Rect2(PlanetSimulation.WORLD_OFFSET + top_left * PlanetSimulation.CELL, (bottom_right - top_left) * PlanetSimulation.CELL)
	canvas.draw_rect(rect, Color(0.42, 1.0, 0.78, 0.05))
	canvas.draw_rect(rect, Color(0.55, 1.0, 0.84, 0.7), false, 1.5)


func terrain_color(c: Dictionary, sim: PlanetSimulation) -> Color:
	var base := Color("#09273a")
	match c.type:
		"deep_ocean":
			base = Color("#06243a")
		"shelf":
			base = Color("#0c3d4c")
		"shallow":
			base = Color("#16565a")
		"tidal":
			base = Color("#2e604e")
		"basalt":
			base = Color("#27313a")
		"volcanic":
			base = Color("#432f32")
	var heat: float = sim.climate_heat * 0.045 + c.temperature * 0.025
	var nutrient: float = c.nutrients * 0.035
	return base.lightened(nutrient).lerp(Color("#713b31"), heat)


func _draw_plankton_field(canvas: CanvasItem, sim: PlanetSimulation) -> void:
	var count := 14 if sim.reduced_motion else 34
	var motion := 0.02 if sim.reduced_motion else 0.09
	for i in range(count):
		var seed := float(i)
		var x := fmod(seed * 97.37 + sin(sim.tick * 0.006 + seed) * 12.0, PlanetSimulation.WORLD_SIZE.x)
		var y := fmod(seed * 61.91 + sim.tick * motion, PlanetSimulation.WORLD_SIZE.y)
		canvas.draw_circle(PlanetSimulation.WORLD_OFFSET + Vector2(x, y), 1.0, Color(0.5, 0.92, 1.0, 0.08))


func _is_rain_weather(value: String) -> bool:
	return value == "warm rain" or value == "storm rain" or value == "monsoon"
