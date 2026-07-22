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
var help_open := false
var coach_tip_key := ""
var coach_seen_key := ""
var coach_action_kind := ""
var coach_action_value := ""

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
var help_button: Button
var help_panel: Panel
var help_title: Label
var help_body: RichTextLabel
var help_action_button: Button


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
				elif help_open:
					_toggle_help()
			KEY_H:
				_toggle_help()
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

	help_button = _button("HELP", Vector2(932, 39), Vector2(102, 46))
	help_button.tooltip_text = "Open the real-time Help Coach (H)"
	help_button.pressed.connect(_toggle_help)
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
	var keys := _label("Space pause  •  [ ] speed\n1–8 tools  •  H live help\nRight-click inspect", Vector2(34, 688), 12, Color("#7897a2"))
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
	_build_help_coach()
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
	var note := _child_label(card, "Open HELP anytime for one exact next step. You can also alternate tools for combos,\nwork inside gold hotspots, and right-click creatures to inspect their traits.", Vector2(50, 506), 13, Color("#8fd8c6"))
	note.size = Vector2(660, 40)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var launch := Button.new()
	launch.text = "AWAKEN THE OCEAN"
	launch.position = Vector2(250, 558)
	launch.size = Vector2(268, 48)
	glass.style_button(launch, Color(0.06, 0.58, 0.44, 0.9))
	launch.pressed.connect(_start_game)
	card.add_child(launch)


func _build_help_coach() -> void:
	help_panel = Panel.new()
	help_panel.position = Vector2(770, 132)
	help_panel.size = Vector2(392, 490)
	help_panel.visible = false
	help_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	glass.style_panel(help_panel, Color(0.012, 0.045, 0.061, 0.98), Color(0.35, 1.0, 0.78, 0.55))
	ui.add_child(help_panel)
	_child_label(help_panel, "LIVE HELP COACH", Vector2(24, 18), 14, Color("#63f7ce"))
	var live := _child_label(help_panel, "LIVE  •  watching your world", Vector2(24, 43), 11, Color("#75d7c1"))
	live.size = Vector2(210, 20)
	var minimize := Button.new()
	minimize.text = "—"
	minimize.position = Vector2(332, 16)
	minimize.size = Vector2(38, 34)
	minimize.focus_mode = Control.FOCUS_NONE
	minimize.tooltip_text = "Minimize Help Coach"
	glass.style_button(minimize, Color(0.06, 0.22, 0.25, 0.9))
	minimize.pressed.connect(_toggle_help)
	help_panel.add_child(minimize)
	help_title = _child_label(help_panel, "Your next move", Vector2(24, 72), 22, Color("#f1fffb"))
	help_title.size = Vector2(342, 58)
	help_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help_body = RichTextLabel.new()
	help_body.position = Vector2(24, 128)
	help_body.size = Vector2(344, 280)
	help_body.bbcode_enabled = true
	help_body.fit_content = false
	help_body.scroll_active = false
	help_body.add_theme_font_size_override("normal_font_size", 13)
	help_body.add_theme_font_size_override("bold_font_size", 14)
	help_panel.add_child(help_body)
	help_action_button = Button.new()
	help_action_button.text = "SHOW ME WHAT TO USE"
	help_action_button.position = Vector2(24, 422)
	help_action_button.size = Vector2(344, 46)
	help_action_button.focus_mode = Control.FOCUS_NONE
	glass.style_button(help_action_button, Color(0.06, 0.58, 0.44, 0.95))
	help_action_button.pressed.connect(_run_coach_action)
	help_panel.add_child(help_action_button)


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
	_update_ui()
	_show_toast("Mission 1: seed the shallows  •  Open HELP for live guidance", Color("#63f7ce"), 3.2)


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
	help_open = false
	coach_tip_key = ""
	coach_seen_key = ""
	coach_action_kind = ""
	coach_action_value = ""
	sim.set_hotspot(Vector2i(-1, -1), false)
	if inspector_overlay:
		inspector_overlay.visible = false
	if help_panel:
		help_panel.visible = false


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
	_update_help_coach(s)
	_update_tool_locks()
	graph.queue_redraw()


func _toggle_help() -> void:
	if not help_panel:
		return
	help_open = not help_open
	help_panel.visible = help_open
	_update_help_coach(sim.stats())
	if help_open:
		coach_seen_key = coach_tip_key
		help_button.text = "HELP • OPEN"


func _update_help_coach(s: Dictionary) -> void:
	if not help_button or not help_panel:
		return
	var tip: Dictionary = _coach_tip(s)
	var next_key := "%d:%s" % [mission_stage, str(tip.get("key", "guide"))]
	coach_tip_key = next_key
	coach_action_kind = str(tip.get("action_kind", ""))
	coach_action_value = str(tip.get("action_value", ""))
	var button_text := str(tip.get("button", ""))

	if coach_action_kind == "tool":
		var tool_index := int(coach_action_value)
		if sim.catalyst < PlanetSimulation.TOOL_COSTS[tool_index]:
			tip.title = "Let Catalyst recharge"
			tip.action = "Keep the ocean running. Catalyst refills automatically; when it reaches %d, use %s." % [PlanetSimulation.TOOL_COSTS[tool_index], TOOL_SHORT_NAMES[tool_index]]
			tip.why = "Every intervention costs Catalyst. Waiting briefly is part of keeping the simulation under control."
			tip.status = "Catalyst %d/%d  •  Need %d" % [int(sim.catalyst), int(sim.catalyst_max), PlanetSimulation.TOOL_COSTS[tool_index]]
			coach_tip_key = "%d:recharge:%d" % [mission_stage, tool_index]
			coach_action_kind = "speed"
			coach_action_value = "2"
			button_text = "RUN AT 2X TO RECHARGE"
		elif not running:
			coach_action_kind = "tool_resume"
			button_text = "SELECT %s + RESUME" % TOOL_SHORT_NAMES[tool_index].to_upper()
	if not running and coach_action_kind == "":
		coach_action_kind = "resume"
		coach_action_value = ""
		button_text = "RESUME SIMULATION"

	help_title.text = str(tip.get("title", "Your next move"))
	help_body.text = "[color=#8defff]DO THIS NOW[/color]\n[b]%s[/b]\n\n[color=#8fafb7]WHY[/color]\n%s\n\n[color=#ffe38a]LIVE READOUT[/color]\n%s\n\n[color=#75d7c1]BONUS[/color]  %s" % [
		str(tip.get("action", "Watch the world and follow the current mission.")),
		str(tip.get("why", "The coach will update when the planet needs a different intervention.")),
		str(tip.get("status", "The planet is being monitored.")),
		_coach_bonus_text(),
	]
	help_action_button.visible = coach_action_kind != ""
	help_action_button.text = button_text if button_text != "" else "TAKE THE NEXT STEP"
	if help_open:
		coach_seen_key = coach_tip_key
		help_button.text = "HELP • OPEN"
	else:
		help_button.text = "HELP" if coach_tip_key == coach_seen_key else "HELP • NEW"


func _coach_tip(s: Dictionary) -> Dictionary:
	if not started:
		return {
			"key": "launch", "title": "Begin the expedition",
			"action": "Read the three mission principles, then choose AWAKEN THE OCEAN.",
			"why": "The Help Coach will start tracking the world as soon as the simulation begins.",
			"status": "The young ocean is waiting.", "action_kind": "", "button": "",
		}
	if current_crisis != "":
		return _crisis_coach_tip(s)
	return _mission_coach_tip(s)


func _mission_coach_tip(s: Dictionary) -> Dictionary:
	match mission_stage:
		0:
			if sim.tool_uses[0] < 3:
				return {
					"key": "m0-seed", "title": "Seed the first living mats",
					"action": "Choose Cyano Mats, then click three separate green shallow-water areas. Aim inside the gold diamond when practical.",
					"why": "Cyanobacteria are the food-web foundation and gradually add oxygen to the atmosphere.",
					"status": "Placements %d/3  •  Living mats %d/260" % [sim.tool_uses[0], int(s.microbes)],
					"action_kind": "tool", "action_value": "0", "button": "SELECT CYANO MATS",
				}
			if int(s.microbes) < 260:
				return {
					"key": "m0-grow", "title": "Help the first colony spread",
					"action": "Add Tidal Nutrients beside existing bright-green mats, then let the ocean run until the mat count reaches 260.",
					"why": "Nutrients make shallow habitat productive without adding consumers that could eat the new colony.",
					"status": "Living mats %d/260  •  Catalyst %d/100" % [int(s.microbes), int(sim.catalyst)],
					"action_kind": "tool", "action_value": "4", "button": "SELECT TIDAL NUTRIENTS",
				}
		1:
			if sim.tool_uses[1] < 3:
				return {
					"key": "m1-drifters", "title": "Introduce the first consumers",
					"action": "Choose Amoeboids and place them near—not directly on top of—large cyanobacteria patches three times.",
					"why": "Drifters turn microbial abundance into a moving population and begin the evolutionary food web.",
					"status": "Drifter uses %d/3  •  Drifters %d/18" % [sim.tool_uses[1], int(s.amoeboids)],
					"action_kind": "tool", "action_value": "1", "button": "SELECT AMOEBOIDS",
				}
			if sim.tool_uses[2] < 2:
				return {
					"key": "m1-grazers", "title": "Add a second consumer layer",
					"action": "Choose Grazers and place two small groups beside well-fed green mats. Spread the groups apart.",
					"why": "A second consumer creates competition and raises biodiversity, but concentrated grazers can strip one area bare.",
					"status": "Grazer uses %d/2  •  Grazers %d/7" % [sim.tool_uses[2], int(s.grazers)],
					"action_kind": "tool", "action_value": "2", "button": "SELECT GRAZERS",
				}
			if int(s.microbes) < 220:
				return {
					"key": "m1-food", "title": "Rebuild the food supply",
					"action": "Paint Cyano Mats into empty shallow zones before adding more consumers.",
					"why": "The mission cannot complete while the food foundation is below 220 living mats.",
					"status": "Living mats %d/220" % int(s.microbes),
					"action_kind": "tool", "action_value": "0", "button": "SELECT CYANO MATS",
				}
			return {
				"key": "m1-wait", "title": "Let the young food web reproduce",
				"action": "Run at 2x and watch the counts. Avoid adding more grazers while the populations grow toward their targets.",
				"why": "You have placed the required organisms; reproduction now needs time and a steady food supply.",
				"status": "Drifters %d/18  •  Grazers %d/7  •  Mats %d/220" % [int(s.amoeboids), int(s.grazers), int(s.microbes)],
				"action_kind": "speed", "action_value": "2", "button": "RUN AT 2X",
			}
		2:
			if sim.tool_uses[3] < 3:
				return {
					"key": "m2-hunters", "title": "Complete the food web",
					"action": "Choose Predators and place three small groups near—but not inside—the densest consumer swarms.",
					"why": "Hunters control overcrowding and create selection pressure without immediately wiping out their prey.",
					"status": "Predator uses %d/3  •  Hunters %d/3" % [sim.tool_uses[3], int(s.predators)],
					"action_kind": "tool", "action_value": "3", "button": "SELECT PREDATORS",
				}
			if int(s.predators) < 3:
				return {
					"key": "m2-breed", "title": "Give the hunters time",
					"action": "Run at 2x and let surviving predators feed and reproduce. Keep an eye on Stability.",
					"why": "Placements are complete, but the mission needs three living hunters at the same time.",
					"status": "Hunters %d/3  •  Stability %d/52" % [int(s.predators), int(s.stability)],
					"action_kind": "speed", "action_value": "2", "button": "RUN AT 2X",
				}
			if float(s.stability) < 52.0:
				return {
					"key": "m2-stability", "title": "Restore ecosystem balance",
					"action": "Add Tidal Nutrients to a depleted shallow zone, then stop placing organisms while Stability recovers.",
					"why": "The complete food web must remain alive and balanced, not merely contain every species.",
					"status": "Stability %d/52  •  Mats %d" % [int(s.stability), int(s.microbes)],
					"action_kind": "tool", "action_value": "4", "button": "SELECT TIDAL NUTRIENTS",
				}
		3:
			if float(s.oxygen) < 0.035:
				return {
					"key": "m3-oxygen", "title": "Turn the ocean into an oxygen engine",
					"action": "Expand Cyano Mats across several empty shallow regions, then let them photosynthesize at 2x speed.",
					"why": "A broad, surviving microbial layer raises oxygen more reliably than one overcrowded patch.",
					"status": "O₂ %.1f/3.5%%  •  Mats %d" % [float(s.oxygen) * 100.0, int(s.microbes)],
					"action_kind": "tool", "action_value": "0", "button": "SELECT CYANO MATS",
				}
			if float(s.biodiversity) < 62.0:
				var diversity_tool := _field_study_tool_or(4)
				return {
					"key": "m3-diversity", "title": "Create more ecological variety",
					"action": "Use %s in a new part of the map, preferably inside the gold field-study hotspot, then alternate with another unlocked tool." % TOOL_SHORT_NAMES[diversity_tool],
					"why": "New habitat patterns and varied interventions raise biodiversity faster than repeating one action.",
					"status": "Biodiversity %d/62  •  O₂ %.1f/3.5%%" % [int(s.biodiversity), float(s.oxygen) * 100.0],
					"action_kind": "tool", "action_value": str(diversity_tool), "button": "SELECT %s" % TOOL_SHORT_NAMES[diversity_tool].to_upper(),
				}
		4:
			if int(s.max_generation) < 4:
				return {
					"key": "m4-generation", "title": "Let evolution do its work",
					"action": "Run at 2x. Avoid large interventions while successful organisms reproduce into Generation 4.",
					"why": "Generations advance through survival and reproduction, so this objective needs time more than new placements.",
					"status": "Highest generation %d/4  •  Stability %d/68" % [int(s.max_generation), int(s.stability)],
					"action_kind": "speed", "action_value": "2", "button": "RUN AT 2X",
				}
			if float(s.stability) < 68.0:
				return {
					"key": "m4-stability", "title": "Make the mature world resilient",
					"action": "Add Tidal Nutrients to a quiet shallow area, then let the world settle without adding more animals.",
					"why": "A mature biosphere earns its final grade by recovering balance, not by maximizing population.",
					"status": "Stability %d/68  •  Biodiversity %d/72" % [int(s.stability), int(s.biodiversity)],
					"action_kind": "tool", "action_value": "4", "button": "SELECT TIDAL NUTRIENTS",
				}
			if float(s.biodiversity) < 72.0:
				var final_tool := _field_study_tool_or(6)
				return {
					"key": "m4-diversity", "title": "Add one last source of variety",
					"action": "Use %s once in an underused region, then wait and watch whether biodiversity rises." % TOOL_SHORT_NAMES[final_tool],
					"why": "Small, varied habitat changes are safer than flooding a mature ecosystem with more organisms.",
					"status": "Biodiversity %d/72  •  Stability %d/68" % [int(s.biodiversity), int(s.stability)],
					"action_kind": "tool", "action_value": str(final_tool), "button": "SELECT %s" % TOOL_SHORT_NAMES[final_tool].to_upper(),
				}
	return {
		"key": "endless", "title": "Explore your living planet",
		"action": "Inspect evolved creatures, complete field studies, or begin a new world and chase a higher grade.",
		"why": "The campaign objectives are complete; the simulation now belongs to you.",
		"status": "Score %06d  •  Discoveries %d/5  •  Badges %d" % [score, discoveries.size(), achievements.size()],
		"action_kind": "", "button": "",
	}


func _crisis_coach_tip(s: Dictionary) -> Dictionary:
	if current_crisis.begins_with("Ocean overheating"):
		return {
			"key": "crisis-heat", "title": "Cool the ocean now",
			"action": "Trigger Monsoon once, then stop adding volcanic rock while the heat falls.",
			"why": "Excess heat lowers survival across the whole food web and can erase mission progress quickly.",
			"status": "Heat %.0f%%  •  Stability %d/100" % [float(s.climate_heat) * 100.0, int(s.stability)],
			"action_kind": "event", "action_value": "Monsoon", "button": "TRIGGER MONSOON",
		}
	if current_crisis.begins_with("Overcrowding"):
		if TOOL_UNLOCK_STAGE[3] <= mission_stage:
			return {
				"key": "crisis-crowding", "title": "Reduce overcrowding safely",
				"action": "Add one small Predator group beside the largest consumer swarm, then wait before adding anything else.",
				"why": "A few hunters can control runaway consumers without the blunt damage of a global event.",
				"status": "Population %d  •  Hunters %d" % [int(s.population), int(s.predators)],
				"action_kind": "tool", "action_value": "3", "button": "SELECT PREDATORS",
			}
		return {
			"key": "crisis-crowding-event", "title": "Thin the overcrowded population",
			"action": "Trigger Viral Bloom once, then let the surviving food web recover before placing more organisms.",
			"why": "Predators are still locked, so a controlled population event is the available emergency brake.",
			"status": "Population %d  •  Stability %d/100" % [int(s.population), int(s.stability)],
			"action_kind": "event", "action_value": "Viral Bloom", "button": "TRIGGER VIRAL BLOOM",
		}
	if current_crisis.begins_with("Food web starving"):
		return {
			"key": "crisis-food", "title": "Feed the food web",
			"action": "Paint Cyano Mats into two empty shallow regions. Do not add more animals until the warning clears.",
			"why": "Consumers are eating microbial food faster than the mats can regrow.",
			"status": "Mats %d  •  Consumers %d" % [int(s.microbes), int(s.amoeboids) + int(s.grazers)],
			"action_kind": "tool", "action_value": "0", "button": "SELECT CYANO MATS",
		}
	return {
		"key": "crisis-consumers", "title": "Restore the missing hunter layer",
		"action": "Place one small Predator group near the densest drifters and grazers, then let it establish.",
		"why": "Unchecked consumers destabilize the food web when no predators are present.",
		"status": "Consumers %d  •  Hunters %d" % [int(s.amoeboids) + int(s.grazers), int(s.predators)],
		"action_kind": "tool", "action_value": "3", "button": "SELECT PREDATORS",
	}


func _coach_bonus_text() -> String:
	if field_study_index < 0:
		return "Gold hotspots give double field-study progress."
	var study: Dictionary = FIELD_STUDIES[field_study_index]
	return "%s: use %s in the gold diamond (%d/%d)." % [
		str(study.title), TOOL_SHORT_NAMES[int(study.tool)], field_study_progress, int(study.goal),
	]


func _field_study_tool_or(fallback: int) -> int:
	if field_study_index >= 0:
		var study: Dictionary = FIELD_STUDIES[field_study_index]
		var tool_index := int(study.tool)
		if TOOL_UNLOCK_STAGE[tool_index] <= mission_stage:
			return tool_index
	return fallback


func _run_coach_action() -> void:
	match coach_action_kind:
		"tool", "tool_resume":
			var tool_index := int(coach_action_value)
			_select_tool(tool_index)
			if coach_action_kind == "tool_resume" and not running:
				running = true
				play_button.text = "Pause"
			_show_toast("Help Coach selected %s — minimize HELP, then follow the highlighted step" % TOOL_SHORT_NAMES[tool_index], Color("#8defff"), 3.0)
		"resume":
			if not running:
				running = true
				play_button.text = "Pause"
			_show_toast("Simulation resumed — the coach is still watching", Color("#8defff"), 2.4)
		"speed":
			speed_index = clampi(int(coach_action_value), 0, SPEEDS.size() - 1)
			running = true
			play_button.text = "Pause"
			speed_button.text = "%gx" % SPEEDS[speed_index]
			_show_toast("Help Coach set the ocean to %gx" % SPEEDS[speed_index], Color("#8defff"), 2.4)
		"event":
			_trigger_event(coach_action_value)
	_update_ui()


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
