extends Node2D

const PlanetSimulation = preload("res://scripts/simulation/planet_simulation.gd")
const PlanetRenderer = preload("res://scripts/rendering/planet_renderer.gd")
const PopulationGraph = preload("res://scripts/graphs/population_graph.gd")
const GlassTheme = preload("res://scripts/ui/glass_theme.gd")
const OceanHazeShader = preload("res://shaders/ocean_haze.gdshader")
const MUSIC_STREAM_PATH := "res://assets/audio/Sunrise Over Tiny Blocks (2).mp3"
const VIEW_SIZE := Vector2(1440, 810)
const SIM_STEP := 1.0 / 20.0
const RENDER_STEP := 1.0 / 30.0
const SPEEDS: Array[float] = [0.5, 1.0, 2.0, 4.0]
const TOOL_UNLOCK_STAGE: Array[int] = [0, 1, 1, 2, 0, 2, 0, 0]
const TOOL_SHORT_NAMES := ["Cyano Mats", "Amoeboids", "Grazers", "Predators", "Tidal Nutrients", "Volcanic Rock", "Hydrothermal Vent", "Eraser"]
const MISSION_TITLES := ["Awaken the Shallows", "Feed the Drifters", "Complete the Web", "Change the Sky", "Living Planet"]
const FIELD_STUDIES := [
	{"title": "Bloom Survey", "tool": 0, "goal": 4},
	{"title": "Tidepool Nursery", "tool": 4, "goal": 3},
	{"title": "Vent Watch", "tool": 6, "goal": 2},
	{"title": "Drifter Census", "tool": 1, "goal": 3},
	{"title": "Grazer Trail", "tool": 2, "goal": 3},
	{"title": "Hunter Watch", "tool": 3, "goal": 2},
]

var sim := PlanetSimulation.new()
var renderer := PlanetRenderer.new()
var graph_renderer := PopulationGraph.new()
var glass := GlassTheme.new()

var running := false
var started := false
var reduced_motion := false
var sim_accumulator := 0.0
var render_accumulator := 0.0
var paint_down := false
var paint_cooldown := 0.0
var speed_index := 1
var mission_stage := 0
var toast_time := 0.0
var score := 0
var combo := 0
var combo_timer := 0.0
var last_combo_tool := -1
var field_study_index := -1
var field_study_progress := 0
var field_studies_completed := 0
var discoveries: Array[String] = []
var achievements: Dictionary = {}
var current_crisis := ""
var last_crisis_notice_tick := -1000
var inspector_resume_running := false
var inspector_victory := false

var ui: CanvasLayer
var intro_overlay: Control
var stats_label: RichTextLabel
var mission_label: RichTextLabel
var clock_label: Label
var weather_label: Label
var toast_label: Label
var catalyst_label: Label
var catalyst_bar: ProgressBar
var seed_label: Label
var score_label: Label
var combo_label: Label
var field_label: Label
var crisis_label: Label
var graph: Control
var play_button: Button
var speed_button: Button
var motion_button: Button
var music_player: AudioStreamPlayer
var music_button: Button
var music_start_pending := false
var music_enabled := false
var tool_buttons: Array[Button] = []
var inspector_overlay: Control
var inspector_title: Label
var inspector_label: RichTextLabel
var inspector_button: Button


func _ready() -> void:
	sim.seed_text = "genesis-%d" % randi_range(1000, 999999)
	_build_haze_overlay()
	_create_music_player()
	_build_ui()
	_reset_world(false)
	_update_ui()
	set_process(true)


func _process(delta: float) -> void:
	paint_cooldown = max(0.0, paint_cooldown - delta)
	combo_timer = max(0.0, combo_timer - delta)
	if combo_timer <= 0.0 and combo > 0:
		combo = 0
		last_combo_tool = -1
	if toast_time > 0.0:
		toast_time -= delta
		if toast_time <= 0.0 and toast_label:
			toast_label.modulate.a = 0.0

	if running and started:
		sim_accumulator += delta * SPEEDS[speed_index]
		var guard := 0
		while sim_accumulator >= SIM_STEP and guard < 10:
			sim.step(SIM_STEP)
			sim_accumulator -= SIM_STEP
			guard += 1
			sim.render_alpha = clamp(sim_accumulator / SIM_STEP, 0.0, 1.0)
			if sim.tick % 10 == 0:
				_check_mission()
				_update_fun_systems()
				_update_ui()
	else:
		sim.render_alpha = 1.0

	render_accumulator += delta
	if render_accumulator >= (RENDER_STEP * (1.5 if reduced_motion else 1.0)):
		render_accumulator = fmod(render_accumulator, RENDER_STEP)
		queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	_maybe_start_music_from_user_gesture(event)
	if not started:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_ESCAPE:
				if inspector_overlay and inspector_overlay.visible:
					_close_inspector()
			KEY_SPACE:
				_toggle_running()
			KEY_N:
				_reset_world(true)
			KEY_M:
				_toggle_motion()
			KEY_BRACKETLEFT:
				_change_speed(-1)
			KEY_BRACKETRIGHT:
				_change_speed(1)
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8:
				_select_tool(event.keycode - KEY_1)
	if event is InputEventMouseMotion:
		sim.set_hover_screen(event.position)
		if paint_down and paint_cooldown <= 0.0:
			_use_selected_tool(event.position)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		paint_down = event.pressed
		if event.pressed:
			sim.set_hover_screen(event.position)
			_use_selected_tool(event.position)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
		_open_inspector(event.position)
	if event is InputEventScreenTouch:
		sim.set_hover_screen(event.position)
		if event.pressed:
			_use_selected_tool(event.position)


func _draw() -> void:
	renderer.draw_background(self, sim)
	renderer.draw_world(self, sim)
	renderer.draw_organisms(self, sim)
	renderer.draw_overlay(self, sim)


func _build_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	_panel(Vector2(16, 16), Vector2(1408, 96), Color(0.014, 0.028, 0.045, 0.92))
	_label("LITTLE WORLD: GENESIS", Vector2(38, 31), 30, Color("#f1fffb"))
	_label("Steward a young ocean into a stable living planet.", Vector2(40, 72), 15, Color("#8eb8c3"))

	clock_label = _label("", Vector2(405, 31), 18, Color("#e7fff7"))
	weather_label = _label("", Vector2(405, 64), 14, Color("#8cdef2"))
	score_label = _label("SCORE 000000", Vector2(820, 31), 16, Color("#ffe38a"))
	combo_label = _label("", Vector2(820, 64), 13, Color("#88f5d2"))

	play_button = _button("Play", Vector2(1042, 39), Vector2(82, 46))
	play_button.pressed.connect(_toggle_running)
	speed_button = _button("1x", Vector2(1132, 39), Vector2(66, 46))
	speed_button.pressed.connect(_change_speed.bind(1))
	music_button = _button("Music", Vector2(1206, 39), Vector2(88, 46))
	music_button.pressed.connect(_toggle_music)
	var fresh := _button("New", Vector2(1302, 39), Vector2(96, 46))
	fresh.pressed.connect(_reset_world.bind(true))

	_panel(Vector2(16, 126), Vector2(214, 668), Color(0.012, 0.03, 0.042, 0.9))
	_header("LIFE LAB", Vector2(34, 146))
	for i in range(PlanetSimulation.TOOLS.size()):
		var cost: int = PlanetSimulation.TOOL_COSTS[i]
		var b := _button("[%d] %s   %dC" % [i + 1, TOOL_SHORT_NAMES[i], cost], Vector2(32, 177 + i * 40), Vector2(182, 34))
		b.add_theme_font_size_override("font_size", 13)
		b.tooltip_text = _tool_tip(PlanetSimulation.TOOLS[i])
		b.toggle_mode = true
		b.pressed.connect(_select_tool.bind(i))
		tool_buttons.append(b)

	_header("CATALYST", Vector2(34, 506))
	catalyst_label = _label("", Vector2(126, 505), 13, Color("#ffe7a3"))
	catalyst_bar = ProgressBar.new()
	catalyst_bar.position = Vector2(34, 531)
	catalyst_bar.size = Vector2(178, 16)
	catalyst_bar.show_percentage = false
	catalyst_bar.max_value = sim.catalyst_max
	_style_progress(catalyst_bar)
	ui.add_child(catalyst_bar)
	seed_label = _label("", Vector2(34, 557), 12, Color("#7897a2"))
	seed_label.size = Vector2(178, 40)
	seed_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	_header("ACCESSIBILITY", Vector2(34, 608))
	motion_button = _button("Reduced Motion: Off", Vector2(32, 636), Vector2(182, 34))
	motion_button.add_theme_font_size_override("font_size", 12)
	motion_button.pressed.connect(_toggle_motion)
	var keys := _label("Space pause  •  [ ] speed\n1–8 tools  •  M motion\nRight-click inspect", Vector2(34, 688), 12, Color("#7897a2"))
	keys.size = Vector2(176, 60)

	_panel(Vector2(1186, 126), Vector2(238, 668), Color(0.012, 0.03, 0.042, 0.9))
	_header("CURRENT MISSION", Vector2(1206, 146))
	mission_label = RichTextLabel.new()
	mission_label.position = Vector2(1206, 176)
	mission_label.size = Vector2(198, 142)
	mission_label.bbcode_enabled = true
	mission_label.fit_content = false
	mission_label.scroll_active = false
	mission_label.add_theme_font_size_override("normal_font_size", 12)
	mission_label.add_theme_font_size_override("bold_font_size", 15)
	ui.add_child(mission_label)

	_header("PLANET HEALTH", Vector2(1206, 332))
	stats_label = RichTextLabel.new()
	stats_label.position = Vector2(1206, 362)
	stats_label.size = Vector2(198, 208)
	stats_label.bbcode_enabled = true
	stats_label.fit_content = false
	stats_label.scroll_active = false
	stats_label.add_theme_font_size_override("normal_font_size", 12)
	stats_label.add_theme_font_size_override("bold_font_size", 12)
	ui.add_child(stats_label)

	_header("WORLD EVENTS", Vector2(1206, 584))
	for i in range(PlanetSimulation.DISASTERS.size()):
		var event_name: String = PlanetSimulation.DISASTERS[i]
		var event_button := _button(event_name, Vector2(1204 + (i % 2) * 102, 614 + int(i / 2) * 39), Vector2(96, 32))
		event_button.add_theme_font_size_override("font_size", 10)
		event_button.tooltip_text = "%d Catalyst" % PlanetSimulation.DISASTER_COSTS[i]
		event_button.pressed.connect(_trigger_event.bind(event_name))

	graph = Control.new()
	graph.position = Vector2(246, 710)
	graph.size = Vector2(924, 84)
	graph.mouse_filter = Control.MOUSE_FILTER_IGNORE
	graph.draw.connect(_draw_graph)
	ui.add_child(graph)
	var legend := _label("POPULATION HISTORY   ■ Mats   ■ Amoeboids   ■ Grazers   ■ Predators", Vector2(262, 714), 11, Color("#9dbac1"))
	legend.add_theme_color_override("font_color", Color("#a9c9cf"))
	field_label = _label("", Vector2(650, 714), 11, Color("#ffe38a"))
	field_label.size = Vector2(506, 22)
	field_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT

	crisis_label = _label("", Vector2(390, 113), 13, Color("#ffbd82"))
	crisis_label.size = Vector2(660, 25)
	crisis_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	toast_label = _label("", Vector2(416, 654), 15, Color("#effff9"))
	toast_label.size = Vector2(580, 38)
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.modulate.a = 0.0

	_select_tool(0)
	_build_intro()
	_build_inspector()


func _build_intro() -> void:
	intro_overlay = Control.new()
	intro_overlay.position = Vector2.ZERO
	intro_overlay.size = VIEW_SIZE
	intro_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	ui.add_child(intro_overlay)
	var shade := ColorRect.new()
	shade.size = VIEW_SIZE
	shade.color = Color(0.005, 0.012, 0.025, 0.91)
	intro_overlay.add_child(shade)
	var card := Panel.new()
	card.position = Vector2(336, 92)
	card.size = Vector2(768, 626)
	glass.style_panel(card, Color(0.018, 0.052, 0.069, 0.98), Color(0.35, 1.0, 0.78, 0.38))
	intro_overlay.add_child(card)
	var eyebrow := _child_label(card, "PLANETARY STEWARDSHIP MISSION", Vector2(48, 42), 14, Color("#63f7ce"))
	var title := _child_label(card, "Bring a little world to life.", Vector2(48, 78), 38, Color("#f3fffa"))
	var body := _child_label(card, "This ocean is young, fragile, and almost empty.\nBuild its food web one layer at a time without letting one species consume the rest.", Vector2(50, 140), 17, Color("#b2d3d9"))
	body.size = Vector2(660, 76)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_intro_step(card, "01", "Seed the shallows", "Paint cyanobacteria and nutrient-rich tidepools.", 232)
	_intro_step(card, "02", "Build a balanced web", "Add drifters, grazers, then predators as missions unlock.", 326)
	_intro_step(card, "03", "Protect the planet", "Watch Stability, oxygen, and population history—not just raw growth.", 420)
	var note := _child_label(card, "Tips: alternate tools quickly for combo bonuses, work inside gold hotspots,\nand right-click a creature to inspect its evolving traits.", Vector2(50, 506), 13, Color("#8fd8c6"))
	note.size = Vector2(660, 40)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var launch := Button.new()
	launch.text = "AWAKEN THE OCEAN"
	launch.position = Vector2(250, 558)
	launch.size = Vector2(268, 48)
	glass.style_button(launch, Color(0.06, 0.58, 0.44, 0.9))
	launch.pressed.connect(_start_game)
	card.add_child(launch)


func _build_inspector() -> void:
	inspector_overlay = Control.new()
	inspector_overlay.position = Vector2.ZERO
	inspector_overlay.size = VIEW_SIZE
	inspector_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	inspector_overlay.visible = false
	ui.add_child(inspector_overlay)
	var shade := ColorRect.new()
	shade.size = VIEW_SIZE
	shade.color = Color(0.003, 0.01, 0.018, 0.76)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	inspector_overlay.add_child(shade)
	var card := Panel.new()
	card.position = Vector2(430, 152)
	card.size = Vector2(580, 500)
	glass.style_panel(card, Color(0.018, 0.052, 0.069, 0.98), Color(0.35, 1.0, 0.78, 0.38))
	inspector_overlay.add_child(card)
	inspector_title = _child_label(card, "FIELD INSPECTOR", Vector2(42, 34), 15, Color("#63f7ce"))
	inspector_label = RichTextLabel.new()
	inspector_label.position = Vector2(42, 78)
	inspector_label.size = Vector2(496, 332)
	inspector_label.bbcode_enabled = true
	inspector_label.scroll_active = false
	inspector_label.add_theme_font_size_override("normal_font_size", 15)
	inspector_label.add_theme_font_size_override("bold_font_size", 18)
	card.add_child(inspector_label)
	inspector_button = Button.new()
	inspector_button.text = "RETURN TO THE OCEAN"
	inspector_button.position = Vector2(164, 430)
	inspector_button.size = Vector2(252, 46)
	glass.style_button(inspector_button, Color(0.06, 0.58, 0.44, 0.9))
	inspector_button.pressed.connect(_close_inspector)
	card.add_child(inspector_button)


func _intro_step(parent: Control, number: String, heading: String, copy: String, y: float) -> void:
	var badge := _child_label(parent, number, Vector2(52, y), 24, Color("#55f0c2"))
	badge.size = Vector2(48, 40)
	_child_label(parent, heading, Vector2(116, y), 18, Color("#f1fffb"))
	_child_label(parent, copy, Vector2(116, y + 34), 14, Color("#8fafb7"))


func _start_game() -> void:
	started = true
	running = true
	intro_overlay.visible = false
	play_button.text = "Pause"
	if field_study_index < 0:
		_start_field_study()
	_show_toast("Mission 1: seed the shallows", Color("#63f7ce"))


func _reset_world(announce := true) -> void:
	sim.seed_text = "genesis-%d" % randi_range(1000, 999999)
	sim.new_world(sim.seed_text)
	sim.reduced_motion = reduced_motion
	mission_stage = 0
	_reset_fun_systems()
	sim_accumulator = 0.0
	paint_down = false
	_select_tool(0)
	if announce:
		started = true
		running = true
		if intro_overlay:
			intro_overlay.visible = false
		_show_toast("New world generated: %s" % sim.seed_text, Color("#8cdef2"))
	_update_ui()


func _reset_fun_systems() -> void:
	score = 0
	combo = 0
	combo_timer = 0.0
	last_combo_tool = -1
	field_study_index = -1
	field_study_progress = 0
	field_studies_completed = 0
	discoveries.clear()
	achievements.clear()
	current_crisis = ""
	last_crisis_notice_tick = -1000
	sim.set_hotspot(Vector2i(-1, -1), false)
	if inspector_overlay:
		inspector_overlay.visible = false


func _toggle_running() -> void:
	if not started:
		return
	running = not running
	play_button.text = "Pause" if running else "Play"
	_show_toast("Simulation resumed" if running else "Simulation paused", Color("#d9f7ef"))


func _change_speed(direction := 1) -> void:
	speed_index = posmod(speed_index + direction, SPEEDS.size())
	speed_button.text = "%gx" % SPEEDS[speed_index]
	_show_toast("Simulation speed: %gx" % SPEEDS[speed_index], Color("#8cdef2"))


func _toggle_motion() -> void:
	reduced_motion = not reduced_motion
	sim.reduced_motion = reduced_motion
	motion_button.text = "Reduced Motion: On" if reduced_motion else "Reduced Motion: Off"
	_show_toast("Reduced motion enabled" if reduced_motion else "Full motion enabled", Color("#a9c9cf"))


func _select_tool(index: int) -> void:
	if index < 0 or index >= tool_buttons.size():
		return
	if TOOL_UNLOCK_STAGE[index] > mission_stage:
		_show_toast("Complete the current mission to unlock %s" % TOOL_SHORT_NAMES[index], Color("#ffca8c"))
		return
	sim.select_tool(index)
	for i in range(tool_buttons.size()):
		tool_buttons[i].button_pressed = i == index
	_show_toast("%s selected — %d Catalyst per use" % [TOOL_SHORT_NAMES[index], PlanetSimulation.TOOL_COSTS[index]], Color("#aef8e3"))


func _use_selected_tool(position: Vector2) -> void:
	if not running or not sim.is_screen_in_world(position):
		return
	var result: Dictionary = sim.tool_at_screen(position)
	paint_cooldown = 0.085 if not reduced_motion else 0.14
	if result.ok:
		var fun_message := _handle_fun_action(result)
		_show_toast("%s%s" % [result.message, fun_message], Color("#aef8e3"), 1.15)
	else:
		_show_toast(result.message, Color("#ffbd91"), 1.4)
	_update_ui()


func _trigger_event(event_name: String) -> void:
	if not started:
		return
	var result: Dictionary = sim.disaster(event_name)
	if result.ok:
		_show_toast(result.message, Color("#ffca8c"), 2.2)
	else:
		_show_toast(result.message, Color("#ff9f91"), 1.6)
	_update_ui()


func _handle_fun_action(result: Dictionary) -> String:
	var tool: int = int(result.tool)
	if combo_timer > 0.0 and last_combo_tool >= 0 and tool != last_combo_tool:
		combo = mini(5, combo + 1)
	elif combo_timer <= 0.0:
		combo = 1
	else:
		combo = maxi(1, combo - 1)
	combo_timer = 6.0
	last_combo_tool = tool
	var refund := maxi(0, combo - 1)
	if refund > 0:
		sim.catalyst = min(sim.catalyst_max, sim.catalyst + refund)
	score += 20 * combo
	if combo >= 5:
		_unlock_badge("Chain Reaction")

	var field_message := ""
	if field_study_index >= 0:
		var study: Dictionary = FIELD_STUDIES[field_study_index]
		if tool == int(study.tool):
			var progress_gain := 1
			var target_cell := Vector2(sim.hotspot_cell)
			if sim.hotspot_active and Vector2(result.cell).distance_to(target_cell) <= 4.2:
				progress_gain = 2
				score += 55
				field_message = "  •  HOTSPOT +2"
			field_study_progress += progress_gain
			if field_study_progress >= int(study.goal):
				_complete_field_study(str(study.title))
				field_message = "  •  FIELD STUDY COMPLETE!"
	return "  •  x%d combo%s" % [combo, field_message]


func _start_field_study() -> void:
	for attempt in range(FIELD_STUDIES.size()):
		field_study_index = posmod(field_study_index + 1, FIELD_STUDIES.size())
		var candidate: Dictionary = FIELD_STUDIES[field_study_index]
		if TOOL_UNLOCK_STAGE[int(candidate.tool)] <= mission_stage:
			break
	field_study_progress = 0
	var hotspot := Vector2i(
		sim.rng.randi_range(7, PlanetSimulation.GRID_W - 8),
		sim.rng.randi_range(6, PlanetSimulation.GRID_H - 7)
	)
	sim.set_hotspot(hotspot, true)


func _complete_field_study(title: String) -> void:
	field_studies_completed += 1
	score += 300 + mission_stage * 60
	sim.catalyst = min(sim.catalyst_max, sim.catalyst + 24.0)
	sim.events.append({"day": sim.day, "type": "Field study complete: " + title})
	if field_studies_completed >= 3:
		_unlock_badge("Field Researcher")
	_start_field_study()


func _update_fun_systems() -> void:
	if not started:
		return
	var s := sim.stats()
	score += int(clamp((float(s.stability) - 30.0) / 22.0, 0.0, 3.0))
	_check_discoveries(s)
	_update_crisis(s)
	if float(s.stability) >= 75.0:
		_unlock_badge("Steady Hands")
	if field_study_index < 0:
		_start_field_study()


func _check_discoveries(s: Dictionary) -> void:
	match discoveries.size():
		0:
			if int(s.max_generation) >= 2:
				_unlock_discovery("descendant")
		1:
			if float(s.biodiversity) >= 45.0:
				_unlock_discovery("symbiont")
		2:
			if int(s.max_generation) >= 5:
				_unlock_discovery("swimmer")
		3:
			if float(s.oxygen) >= 0.03:
				_unlock_discovery("sky-shaper")
		4:
			if float(s.biodiversity) >= 75.0:
				_unlock_discovery("crown-life")


func _unlock_discovery(role: String) -> void:
	var discovery := _discovery_name(role)
	discoveries.append(discovery)
	score += 225
	sim.catalyst = min(sim.catalyst_max, sim.catalyst + 8.0)
	sim.events.append({"day": sim.day, "type": "Discovered " + discovery})
	_show_toast("NEW DISCOVERY — %s" % discovery, Color("#8defff"), 3.0)


func _discovery_name(role: String) -> String:
	var prefixes := ["Aurelia", "Nereid", "Lumen", "Thalassa", "Ember", "Viridian", "Caelum"]
	var suffixes := ["minor", "radiant", "pelagic", "spiralis", "nova", "tideborn", "lucens"]
	var identity: int = abs(hash(sim.seed_text + role))
	return "%s %s" % [prefixes[identity % prefixes.size()], suffixes[int(identity / 7) % suffixes.size()]]


func _update_crisis(s: Dictionary) -> void:
	var next_crisis := _detect_crisis(s)
	if current_crisis != "" and next_crisis == "" and float(s.stability) >= 50.0:
		score += 275
		_unlock_badge("Crisis Manager")
	current_crisis = next_crisis
	if current_crisis != "" and sim.tick - last_crisis_notice_tick >= 300:
		last_crisis_notice_tick = sim.tick
		sim.events.append({"day": sim.day, "type": "Crisis: " + current_crisis})
		_show_toast("ECOSYSTEM ALERT — %s" % current_crisis, Color("#ffad7a"), 3.0)


func _detect_crisis(s: Dictionary) -> String:
	if float(s.climate_heat) >= 0.72:
		return "Ocean overheating — use Monsoon or expand tidal water"
	if int(s.population) >= 150:
		return "Overcrowding — add predators or trigger a Viral Bloom"
	var food_demand: float = float(s.amoeboids) + float(s.grazers) * 2.2
	if int(s.population) > 30 and float(s.microbes) < food_demand * 1.8:
		return "Food web starving — seed cyano mats and nutrients"
	if mission_stage >= 2 and int(s.amoeboids) + int(s.grazers) > 90 and int(s.predators) < 2:
		return "Consumers unchecked — introduce predatory swimmers"
	return ""


func _unlock_badge(badge: String) -> void:
	if achievements.has(badge):
		return
	achievements[badge] = true
	score += 150
	sim.events.append({"day": sim.day, "type": "Badge unlocked: " + badge})
	_show_toast("BADGE UNLOCKED — %s" % badge, Color("#ffe38a"), 2.8)


func _open_inspector(position: Vector2) -> void:
	if not started or not sim.is_screen_in_world(position):
		return
	var info: Dictionary = sim.inspect_at_screen(position)
	if info.is_empty():
		return
	inspector_resume_running = running
	inspector_victory = false
	running = false
	play_button.text = "Play"
	inspector_title.text = "FIELD INSPECTOR"
	inspector_button.text = "RETURN TO THE OCEAN"
	var inspected_cell: Dictionary = info.cell
	var organism: Dictionary = info.organism
	if organism.is_empty():
		inspector_label.text = "[b][color=#63f7ce]%s biome[/color][/b]\nCell %d, %d\n\n[b]Microbial cover[/b]  %.0f%%\n[b]Nutrients[/b]  %.0f%%\n[b]Temperature[/b]  %.0f%%\n[b]Water[/b]  %.0f%%\n\n[color=#8fafb7]No large organism is close enough to inspect. Right-click directly beside a moving creature.[/color]" % [
			str(inspected_cell.type).capitalize(), int(info.cell_pos.x), int(info.cell_pos.y),
			float(inspected_cell.microbes) * 100.0, float(inspected_cell.nutrients) / 1.45 * 100.0,
			float(inspected_cell.temperature) * 100.0, float(inspected_cell.water) * 100.0,
		]
	else:
		var common_name := _organism_common_name(str(organism.kind))
		inspector_label.text = "[b][color=#63f7ce]%s[/color][/b]\n[color=#9de7ff]%s[/color]  •  Generation %d\n\n[b]Energy[/b]  %.0f\n[b]Age[/b]  %.1f days\n[b]Speed[/b]  %.2f\n[b]Armor[/b]  %.2f\n[b]Awareness[/b]  %.2f\n[b]Fertility[/b]  %.2f\n[b]Camouflage[/b]  %.2f\n\n[color=#8fafb7]Its traits are inherited with small mutations, so successful lineages gradually adapt to this world.[/color]" % [
			common_name, str(organism.lineage), int(organism.generation), float(organism.energy),
			float(organism.age), float(organism.speed), float(organism.armor), float(organism.sensory),
			float(organism.fertility), float(organism.camouflage),
		]
	inspector_overlay.visible = true


func _organism_common_name(kind: String) -> String:
	match kind:
		"amoeboid":
			return "Amoeboid Drifter"
		"grazer":
			return "Tidal Grazer"
		"predator":
			return "Predatory Swimmer"
	return kind.capitalize()


func _close_inspector() -> void:
	if not inspector_overlay or not inspector_overlay.visible:
		return
	inspector_overlay.visible = false
	if inspector_victory:
		inspector_victory = false
		running = true
		play_button.text = "Pause"
		_show_toast("Endless Mode — keep evolving this world", Color("#ffe38a"), 3.0)
	else:
		running = inspector_resume_running
		play_button.text = "Pause" if running else "Play"


func _finish_world(s: Dictionary) -> void:
	_unlock_badge("Planet Maker")
	var final_score := score + int(float(s.stability) * 25.0) + discoveries.size() * 250 + achievements.size() * 200
	var grade := _world_grade(final_score)
	inspector_victory = true
	inspector_resume_running = false
	running = false
	play_button.text = "Play"
	inspector_title.text = "PLANETARY EXPEDITION COMPLETE"
	inspector_button.text = "CONTINUE IN ENDLESS MODE"
	inspector_label.text = "[center][font_size=42][color=#ffe38a]GRADE %s[/color][/font_size]\n\n[b]Final Score[/b]  %06d\n[b]Stability[/b]  %d/100\n[b]Biodiversity[/b]  %d/100\n[b]Discoveries[/b]  %d\n[b]Badges[/b]  %d\n[b]Field Studies[/b]  %d\n\n[color=#9de7ff]World seed: %s[/color]\n\n[color=#8fafb7]The campaign is complete, but evolution does not stop. Continue in Endless Mode or generate a new world and chase a higher grade.[/color][/center]" % [
		grade, final_score, int(s.stability), int(s.biodiversity), discoveries.size(), achievements.size(), field_studies_completed, sim.seed_text,
	]
	inspector_overlay.visible = true


func _world_grade(final_score: int) -> String:
	if final_score >= 8000:
		return "S"
	if final_score >= 5500:
		return "A"
	if final_score >= 3200:
		return "B"
	return "C"


func _check_mission() -> void:
	if mission_stage >= MISSION_TITLES.size():
		return
	var s := sim.stats()
	var complete := false
	match mission_stage:
		0:
			complete = sim.tool_uses[0] >= 3 and s.microbes >= 260
		1:
			complete = sim.tool_uses[1] >= 3 and sim.tool_uses[2] >= 2 and s.amoeboids >= 18 and s.grazers >= 7 and s.microbes >= 220
		2:
			complete = sim.tool_uses[3] >= 3 and s.predators >= 3 and s.stability >= 52.0
		3:
			complete = s.oxygen >= 0.035 and s.biodiversity >= 62.0
		4:
			complete = s.max_generation >= 4 and s.stability >= 68.0 and s.biodiversity >= 72.0
	if not complete:
		return
	var finished_title: String = MISSION_TITLES[mission_stage]
	mission_stage += 1
	score += 700 + mission_stage * 150
	sim.catalyst = min(sim.catalyst_max, sim.catalyst + 32.0)
	sim.events.append({"day": sim.day, "type": "Mission complete: " + finished_title})
	if mission_stage == 1:
		_unlock_badge("First Light")
	if mission_stage < MISSION_TITLES.size():
		running = false
		play_button.text = "Play"
		_start_field_study()
		_show_toast("MISSION COMPLETE — paused for your next briefing", Color("#66ffc7"), 4.0)
	else:
		_finish_world(s)
	_update_tool_locks()


func _mission_text(s: Dictionary) -> String:
	if mission_stage >= MISSION_TITLES.size():
		return "[b][color=#ffe78c]Living Planet Achieved[/color][/b]\n\nThe biosphere is mature and resilient. Keep shaping it, or begin a new world."
	var objective := ""
	var progress := ""
	match mission_stage:
		0:
			objective = "Establish cyanobacteria in shallow water."
			progress = "Seed placements %d/3\nLiving mats %d/260" % [sim.tool_uses[0], s.microbes]
		1:
			objective = "Add consumers without exhausting their food."
			progress = "Uses: Drifters %d/3 • Grazers %d/2\nCounts: %d/18 • %d/7 • Mats %d/220" % [sim.tool_uses[1], sim.tool_uses[2], s.amoeboids, s.grazers, s.microbes]
		2:
			objective = "Introduce hunters while preserving balance."
			progress = "Predator uses %d/3\nHunters %d/3  •  Stability %d/52" % [sim.tool_uses[3], s.predators, int(s.stability)]
		3:
			objective = "Sustain life long enough to change the sky."
			progress = "O₂ %.1f/3.5%%  •  Diversity %d/62" % [s.oxygen * 100.0, int(s.biodiversity)]
		4:
			objective = "Prove the biosphere can endure and evolve."
			progress = "Generation %d/4\nStability %d/68  •  Diversity %d/72" % [s.max_generation, int(s.stability), int(s.biodiversity)]
	return "[b][color=#66ffc7]%d/5  %s[/color][/b]\n%s\n\n[color=#d8f4ee]%s[/color]" % [mission_stage + 1, MISSION_TITLES[mission_stage], objective, progress]


func _update_ui() -> void:
	if not stats_label:
		return
	var s := sim.stats()
	var era := sim.era_data()
	clock_label.text = "%.2f BILLION YEARS AGO  •  %s" % [sim.planet_age_mya() / 1000.0, era.era]
	weather_label.text = "Day %d  •  %s  •  %s" % [sim.day, sim.season_name(), sim.weather_text()]
	score_label.text = "SCORE %06d" % score
	combo_label.text = "DIVERSITY COMBO x%d" % combo if combo > 1 else ""
	mission_label.text = _mission_text(s)
	var stability_color := "#6fffc9" if s.stability >= 65.0 else ("#ffd36f" if s.stability >= 40.0 else "#ff8e7d")
	stats_label.text = "[b]Stability[/b]  [color=%s]%d/100[/color]\n[b]O₂[/b] %.1f%%   [b]Heat[/b] %.0f%%\n\n[color=#70e9dd]LIFE WEB[/color]\nMats %d   Drifters %d\nGrazers %d   Predators %d\nGeneration %d\n\n[color=#70e9dd]BIODIVERSITY[/color]  %d/100\n[color=#9de7ff]Discoveries %d/5  •  Badges %d[/color]" % [
		stability_color, int(s.stability), s.oxygen * 100.0, s.climate_heat * 100.0,
		s.microbes, s.amoeboids, s.grazers, s.predators, s.max_generation,
		int(s.biodiversity), discoveries.size(), achievements.size(),
	]
	catalyst_bar.value = sim.catalyst
	catalyst_label.text = "%d / %d" % [int(sim.catalyst), int(sim.catalyst_max)]
	seed_label.text = "WORLD SEED\n%s" % sim.seed_text
	crisis_label.text = "⚠ %s" % current_crisis if current_crisis != "" else ""
	if field_study_index >= 0:
		var study: Dictionary = FIELD_STUDIES[field_study_index]
		field_label.text = "FIELD STUDY: %s  •  %s %d/%d  •  gold hotspot = double" % [
			str(study.title), TOOL_SHORT_NAMES[int(study.tool)], field_study_progress, int(study.goal),
		]
	else:
		field_label.text = "FIELD STUDY  •  launches with the expedition"
	_update_tool_locks()
	graph.queue_redraw()


func _update_tool_locks() -> void:
	for i in range(tool_buttons.size()):
		var unlocked: bool = TOOL_UNLOCK_STAGE[i] <= mission_stage
		tool_buttons[i].disabled = not unlocked
		tool_buttons[i].modulate = Color.WHITE if unlocked else Color(0.46, 0.55, 0.58, 0.58)


func _show_toast(message: String, color := Color.WHITE, duration := 1.8) -> void:
	if not toast_label:
		return
	toast_label.text = message
	toast_label.add_theme_color_override("font_color", color)
	toast_label.modulate.a = 1.0
	toast_time = duration


func _build_haze_overlay() -> void:
	var haze := ColorRect.new()
	haze.position = Vector2.ZERO
	haze.size = VIEW_SIZE
	haze.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = OceanHazeShader
	haze.material = material
	add_child(haze)


func _create_music_player() -> void:
	music_player = AudioStreamPlayer.new()
	music_player.volume_db = -15.0
	add_child(music_player)
	if ResourceLoader.exists(MUSIC_STREAM_PATH):
		var stream := load(MUSIC_STREAM_PATH)
		if stream is AudioStreamMP3:
			stream.loop = true
		music_player.stream = stream
	music_start_pending = false


func _maybe_start_music_from_user_gesture(_event: InputEvent) -> void:
	if music_enabled and music_start_pending and music_player.stream:
		music_player.play()
		music_start_pending = false


func _toggle_music() -> void:
	music_enabled = not music_enabled
	if music_enabled and music_player.stream:
		music_player.play()
	else:
		music_player.stop()
	music_button.text = "Music On" if music_enabled else "Music"


func _draw_graph() -> void:
	graph_renderer.draw_graph(graph, sim.history)


func _button(text: String, pos: Vector2, size: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = pos
	button.size = size
	button.focus_mode = Control.FOCUS_NONE
	glass.style_button(button)
	ui.add_child(button)
	return button


func _label(text: String, pos: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	ui.add_child(label)
	return label


func _child_label(parent: Control, text: String, pos: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label


func _header(text: String, pos: Vector2) -> void:
	var label := _label(text, pos, 13, Color("#63f7ce"))
	label.add_theme_constant_override("outline_size", 2)
	label.add_theme_color_override("font_outline_color", Color(0.02, 0.08, 0.08, 0.8))


func _panel(pos: Vector2, size: Vector2, color: Color) -> Panel:
	var panel := Panel.new()
	panel.position = pos
	panel.size = size
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glass.style_panel(panel, color)
	ui.add_child(panel)
	return panel


func _style_progress(bar: ProgressBar) -> void:
	var background := StyleBoxFlat.new()
	background.bg_color = Color("#07151d")
	background.corner_radius_top_left = 8
	background.corner_radius_top_right = 8
	background.corner_radius_bottom_left = 8
	background.corner_radius_bottom_right = 8
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#e2c35f")
	fill.corner_radius_top_left = 8
	fill.corner_radius_top_right = 8
	fill.corner_radius_bottom_left = 8
	fill.corner_radius_bottom_right = 8
	bar.add_theme_stylebox_override("background", background)
	bar.add_theme_stylebox_override("fill", fill)


func _tool_tip(tool: String) -> String:
	match tool:
		"Cyanobacteria":
			return "Paint photosynthetic mats in shallow water. Foundation of the food web."
		"Amoeboids":
			return "Add fast-mutating drifters that consume microbial mats."
		"Grazers":
			return "Add primitive grazers. Too many can strip the shallows bare."
		"Predatory Swimmers":
			return "Add hunters that control consumers and drive evolution."
		"Tidal Nutrients":
			return "Create productive shallow habitat for microbial growth."
		"Volcanic Rock":
			return "Raise blocking volcanic terrain and reshape currents."
		"Hydrothermal Vent":
			return "Create a concentrated, nutrient-rich refuge."
		"Eraser":
			return "Clear a small area and remove nearby organisms."
	return ""
