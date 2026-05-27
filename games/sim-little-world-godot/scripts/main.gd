extends Node2D

const PlanetSimulation = preload("res://scripts/simulation/planet_simulation.gd")
const PlanetRenderer = preload("res://scripts/rendering/planet_renderer.gd")
const PopulationGraph = preload("res://scripts/graphs/population_graph.gd")
const GlassTheme = preload("res://scripts/ui/glass_theme.gd")
const OceanHazeShader = preload("res://shaders/ocean_haze.gdshader")

var sim := PlanetSimulation.new()
var renderer := PlanetRenderer.new()
var graph_renderer := PopulationGraph.new()
var glass := GlassTheme.new()

var running := true
var sim_accumulator := 0.0
var paint_down := false
const SIM_STEP := 1.0 / 30.0
const SIM_SPEED := 1.0

var ui: CanvasLayer
var stats_label: RichTextLabel
var clock_label: Label
var weather_label: Label
var event_label: RichTextLabel
var seed_edit: LineEdit
var tool_state_label: Label
var graph: Control
var tool_buttons: Array[Button] = []


func _ready() -> void:
	sim.seed_text = "planet-%d" % randi_range(1000, 999999)
	_build_haze_overlay()
	_build_ui()
	sim.new_world(sim.seed_text)
	_update_ui()
	set_process(true)


func _process(delta: float) -> void:
	if running:
		sim_accumulator += delta * SIM_SPEED
		var guard := 0
		while sim_accumulator >= SIM_STEP and guard < 90:
			sim.step(SIM_STEP)
			sim_accumulator -= SIM_STEP
			guard += 1
		sim.render_alpha = clamp(sim_accumulator / SIM_STEP, 0.0, 1.0)
		if sim.tick % 10 == 0:
			_update_ui()
	else:
		sim.render_alpha = 1.0
	queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		paint_down = event.pressed
		if event.pressed:
			sim.tool_at_screen(event.position)
			_update_ui()
	if event is InputEventMouseMotion and paint_down:
		sim.tool_at_screen(event.position)
		_update_ui()


func _draw() -> void:
	renderer.draw_background(self, sim)
	renderer.draw_world(self, sim)
	renderer.draw_organisms(self, sim)
	renderer.draw_overlay(self, sim)


func _build_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	_panel(Vector2(18, 18), Vector2(1404, 104), Color(0.018, 0.032, 0.055, 0.82))

	var title := Label.new()
	title.text = "Sim: Little World Engine"
	title.position = Vector2(42, 32)
	title.add_theme_font_size_override("font_size", 38)
	title.add_theme_color_override("font_color", Color("#eefcff"))
	ui.add_child(title)

	var subtitle := Label.new()
	subtitle.text = "Planetary evolution lab - seed primordial life and watch an alien Earth become alive."
	subtitle.position = Vector2(44, 80)
	subtitle.modulate = Color("#a7c9d2")
	ui.add_child(subtitle)

	var play := _button("Pause", Vector2(1188, 40), Vector2(92, 48))
	play.pressed.connect(func() -> void:
		running = not running
		play.text = "Pause" if running else "Play"
	)

	var fresh := _button("New World", Vector2(1290, 40), Vector2(112, 48))
	fresh.pressed.connect(func() -> void:
		sim.new_world(seed_edit.text.strip_edges())
		_update_ui()
	)

	_panel(Vector2(18, 140), Vector2(220, 724), Color(0.018, 0.038, 0.052, 0.78))
	_header("LIFE TOOLS", Vector2(38, 160))
	for i in range(PlanetSimulation.TOOLS.size()):
		var b := _button(PlanetSimulation.TOOLS[i], Vector2(38, 196 + i * 43), Vector2(176, 36))
		b.tooltip_text = _tool_tip(PlanetSimulation.TOOLS[i])
		b.toggle_mode = true
		b.pressed.connect(_select_tool.bind(i))
		tool_buttons.append(b)
	_select_tool(0)

	tool_state_label = Label.new()
	tool_state_label.position = Vector2(38, 540)
	tool_state_label.size = Vector2(176, 32)
	tool_state_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tool_state_label.add_theme_font_size_override("font_size", 12)
	tool_state_label.add_theme_color_override("font_color", Color("#b5dbe3"))
	ui.add_child(tool_state_label)

	_header("SEED", Vector2(38, 562))
	seed_edit = LineEdit.new()
	seed_edit.text = sim.seed_text
	seed_edit.position = Vector2(38, 590)
	seed_edit.size = Vector2(176, 36)
	ui.add_child(seed_edit)

	_panel(Vector2(1186, 140), Vector2(236, 724), Color(0.018, 0.038, 0.052, 0.78))
	_header("PLANET STATUS", Vector2(1208, 160))
	stats_label = RichTextLabel.new()
	stats_label.position = Vector2(1208, 194)
	stats_label.size = Vector2(194, 386)
	stats_label.bbcode_enabled = true
	stats_label.fit_content = true
	stats_label.add_theme_font_size_override("normal_font_size", 13)
	stats_label.add_theme_font_size_override("bold_font_size", 13)
	ui.add_child(stats_label)

	_header("EVENTS", Vector2(1208, 590))
	event_label = RichTextLabel.new()
	event_label.position = Vector2(1208, 616)
	event_label.size = Vector2(190, 72)
	event_label.bbcode_enabled = true
	event_label.fit_content = true
	event_label.add_theme_font_size_override("normal_font_size", 12)
	ui.add_child(event_label)

	_header("EXTINCTION TOOLS", Vector2(1208, 704))
	for i in range(PlanetSimulation.DISASTERS.size()):
		var disaster_label: String = PlanetSimulation.DISASTERS[i]
		var b := _button(disaster_label, Vector2(1208, 730 + i * 27), Vector2(176, 24))
		b.add_theme_font_size_override("font_size", 12)
		b.pressed.connect(func() -> void:
			sim.disaster(disaster_label)
			_update_ui()
		)

	clock_label = Label.new()
	clock_label.position = Vector2(280, 126)
	clock_label.add_theme_font_size_override("font_size", 18)
	clock_label.add_theme_color_override("font_color", Color("#eafffb"))
	ui.add_child(clock_label)

	weather_label = Label.new()
	weather_label.position = Vector2(735, 126)
	weather_label.modulate = Color("#9de7ff")
	ui.add_child(weather_label)

	graph = Control.new()
	graph.position = Vector2(260, 770)
	graph.size = Vector2(900, 92)
	graph.draw.connect(_draw_graph)
	ui.add_child(graph)


func _build_haze_overlay() -> void:
	var haze := ColorRect.new()
	haze.position = Vector2.ZERO
	haze.size = Vector2(1440, 900)
	haze.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = OceanHazeShader
	haze.material = material
	add_child(haze)


func _button(text: String, pos: Vector2, size: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = pos
	button.size = size
	button.focus_mode = Control.FOCUS_NONE
	glass.style_button(button)
	ui.add_child(button)
	return button


func _header(text: String, pos: Vector2) -> void:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.modulate = Color("#78ffe1")
	label.add_theme_font_size_override("font_size", 14)
	ui.add_child(label)


func _panel(pos: Vector2, size: Vector2, color: Color) -> Panel:
	var panel := Panel.new()
	panel.position = pos
	panel.size = size
	glass.style_panel(panel, color)
	ui.add_child(panel)
	return panel


func _select_tool(index: int) -> void:
	sim.select_tool(index)
	for i in range(tool_buttons.size()):
		tool_buttons[i].button_pressed = i == index
	if tool_state_label:
		var tool_name := PlanetSimulation.TOOLS[index]
		tool_state_label.text = "%s active\nClick or drag on the planet." % tool_name


func _update_ui() -> void:
	if seed_edit:
		seed_edit.text = sim.seed_text
	var stats := sim.stats()
	var era := sim.era_data()
	clock_label.text = "%.2f Billion Years Ago - %s" % [sim.planet_age_mya() / 1000.0, era.era]
	weather_label.text = "Day %d - %s - %s" % [sim.day, sim.season_name(), sim.weather_text()]
	stats_label.text = "[b]Epoch[/b]\n%s\n\n[b]Atmosphere[/b]\nO2 %.1f%%   CO2 %.1f%%\nHeat %.0f%%\n\n[b]Life Web[/b]\nCyano mats %d\nAmoeboids %d\nGrazers %d\nPredators %d\nDecay blooms %d\n\n[b]Evolution[/b]\nSpeed %.2f  Armor %.2f\nO2 tol %.2f  Aggro %.2f\nGeneration %d\n\n[b]Biodiversity[/b]\n%d/100" % [
		era.epoch,
		stats.oxygen * 100.0,
		stats.co2 * 100.0,
		stats.climate_heat * 100.0,
		stats.microbes,
		stats.amoeboids,
		stats.grazers,
		stats.predators,
		stats.fungal,
		stats.avg_speed,
		stats.avg_armor,
		stats.avg_oxygen_tolerance,
		stats.avg_aggression,
		stats.max_generation,
		int(stats.biodiversity),
	]
	event_label.text = _recent_events_text()
	graph.queue_redraw()


func _recent_events_text() -> String:
	if sim.events.is_empty():
		return "[color=#8faab5]No major events yet.[/color]"
	var lines: Array[String] = []
	var start: int = max(0, sim.events.size() - 3)
	for i in range(start, sim.events.size()):
		var event = sim.events[i]
		lines.append("Day %d: %s" % [event.day, event.type])
	return "\n".join(lines)


func _draw_graph() -> void:
	graph_renderer.draw_graph(graph, sim.history)


func _tool_tip(tool: String) -> String:
	match tool:
		"Cyanobacteria":
			return "Seed photosynthetic microbial mats in shallow water."
		"Amoeboids":
			return "Add fast-mutating single-celled consumers."
		"Grazers":
			return "Add primitive multicellular grazers and scavengers."
		"Predatory Swimmers":
			return "Add early predators that pressure prey evolution."
		"Tidal Nutrients":
			return "Paint nutrient-rich shallow tidal zones."
		"Volcanic Rock":
			return "Raise harsh basalt and volcanic terrain."
		"Hydrothermal Vent":
			return "Create nutrient-rich vent ecosystems."
		"Eraser":
			return "Clear terrain and nearby organisms."
	return ""
