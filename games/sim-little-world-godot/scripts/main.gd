extends Node2D

const PlanetSimulation = preload("res://scripts/simulation/planet_simulation.gd")
const SpeciesGuide = preload("res://scripts/ui/species_guide.gd")
const LifeLab = preload("res://scripts/ui/life_lab.gd")
const OceanSettings = preload("res://scripts/ui/ocean_settings.gd")
const OceanJournal = preload("res://scripts/ui/ocean_journal.gd")
const BrowserSaveSync = preload("res://scripts/persistence/browser_save_sync.gd")
const WorldSave = preload("res://scripts/persistence/world_save.gd")
const OceanTouch = preload("res://scripts/rendering/ocean_touch.gd")
const OceanCamera = preload("res://scripts/rendering/ocean_camera.gd")
const PlanetRenderer = preload("res://scripts/rendering/planet_renderer.gd")
const PopulationGraph = preload("res://scripts/graphs/population_graph.gd")
const GlassTheme = preload("res://scripts/ui/glass_theme.gd")
const OceanHazeShader = preload("res://shaders/ocean_haze.gdshader")
const MUSIC_STREAM_PATH := "res://assets/audio/Sunrise Over Tiny Blocks (2).mp3"
const VIEW_SIZE := Vector2(1440, 810)
const SIM_STEP := 1.0 / 20.0
const RENDER_STEP := 1.0 / 30.0
const MAX_SIM_STEPS_PER_FRAME := 5
const MAX_FRAME_DELTA := 0.1
const SPEEDS: Array[float] = [0.5, 1.0, 2.0, 4.0]
const TOOL_UNLOCK_STAGE: Array[int] = [0, 1, 1, 2, 0, 2, 0, 0]
const TOOL_SHORT_NAMES := ["Cyano Mats", "Amoeboids", "Grazers", "Predators", "Tidal Nutrients", "Volcanic Rock", "Thermal Vent", "Eraser"]
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
var pulse_open := false
var pulse_unread := false
var pulse_snapshot: Dictionary = {}
var pulse_trend: Dictionary = {}
var pulse_last_tick := -1
var pointer_position := Vector2.ZERO

const EVENT_BRIEFINGS := {
	"Heat Pulse": ["Raises ocean heat by 18 percentage points. Heat weather lasts 36 simulation seconds.", "Watch heat and food supplies. Monsoon can cool the ocean; avoid adding volcanic rock."],
	"Monsoon": ["Cools the ocean by 8 percentage points and replenishes water and nutrients. Rain lasts 26 simulation seconds.", "Let mats respond before adding consumers. Watch population history for a delayed bloom."],
	"Viral Bloom": ["Each drifter has a 22% chance of dying; each other animal has a 13% chance. Results vary.", "Give survivors time to recover. Rebuild microbial food before replacing animals."],
	"Impact Event": ["A random region becomes volcanic rock and basalt. Microbial cover in that region is erased.", "Inspect the affected terrain. Seed suitable shallows elsewhere and monitor ocean heat."],
	"Predator Surge": ["Attempts to introduce five hunters, subject to population limits. Existing prey may decline.", "Watch drifter and grazer counts. Avoid adding more hunters while the food web settles."],
	"Seed Recovery": ["Replenishes depleted parts of the food web and nutrients. Additions depend on current populations.", "Let the new populations settle. Recovery is an intervention, not a guarantee of lasting balance."],
}
var event_dialog: ConfirmationDialog
var pending_event := ""
var event_was_running := false
var observed_era := ""
var event_glow := 0.0

var journal_seen: Dictionary = {}
var journal: Control
var settings: AcceptDialog
var life_lab: Control

var save_pending := false
var save_wait := 0.0
var pending_save: Dictionary = {}
var pending_announce := false

var save_path := WorldSave.SAVE_PATH
var autosave_elapsed := 0.0
var save_status: Label
var resume_button: Button
var resume_detail: Label
var new_world_dialog: ConfirmationDialog
var saved_checkpoint: Dictionary = {}
var save_recovered := false
var new_world_was_running := false

var camera := OceanCamera.new()
var touch := OceanTouch.new()
var world_view: Control
var world_canvas: Node2D
var camera_bar: HFlowContainer
var zoom_label: Label
var pan_button: Button
var focus_button: Button
var follow_button: Button
var follow_status: Button
var follow_target: Dictionary = {}
var inspect_target: Dictionary = {}
var pan_mode := false
var panning := false
var focus_mode := false

var world_scale := Vector2.ONE
var world_origin := Vector2.ZERO
var layout_controls: Array[Dictionary] = []
var haze: ColorRect
var inspect_mode := false
var inspect_button: Button
var guide_label: Label

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
var specimen: Control
var inspected_organism: Dictionary = {}
var help_button: Button
var help_panel: Panel
var help_title: Label
var help_body: RichTextLabel
var help_action_button: Button
var placement_panel: Panel
var placement_title: Label
var placement_body: Label
var pulse_button: Button
var pulse_panel: Panel
var pulse_title: Label
var pulse_body: RichTextLabel
var pulse_action_button: Button


func _ready() -> void:
	sim.seed_text = "genesis-%d" % randi_range(1000, 999999)
	_build_world_view()
	_build_haze_overlay()
	_create_music_player()
	_build_ui()
	_reset_world(false)
	_update_ui()
	for child in ui.get_children():
		if child is Control:
			layout_controls.append({"node": child, "position": child.position, "size": child.size})
	get_viewport().size_changed.connect(_layout_view)
	_layout_view()
	_check_saved_world()
	set_process(true)


func _process(delta: float) -> void:
	_poll_browser_save(delta)
	if haze:
		haze.material.set_shader_parameter("ocean_time", float(sim.tick) * SIM_STEP)
		haze.material.set_shader_parameter("motion_amount", 0.0 if reduced_motion else 1.0)
		event_glow = maxf(0.0, event_glow - delta * 0.16)
		haze.material.set_shader_parameter("event_strength", 0.35 if not pending_event.is_empty() else event_glow)
		haze.material.set_shader_parameter("climate_warmth", clampf((sim.climate_heat - 0.35) * 2.0, 0.0, 1.0))
	_update_camera(delta)
	if started and running:
		autosave_elapsed += delta
		if autosave_elapsed >= 30.0:
			autosave_elapsed = 0.0
			_save_world(false)
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
		# Never preserve an unbounded backlog. On a slow frame it is better for
		# simulated time to soften briefly than for catch-up work to starve input.
		var scaled_delta: float = min(delta, MAX_FRAME_DELTA) * SPEEDS[speed_index]
		sim_accumulator = min(sim_accumulator + scaled_delta, SIM_STEP * MAX_SIM_STEPS_PER_FRAME)
		var guard := 0
		while sim_accumulator >= SIM_STEP and guard < MAX_SIM_STEPS_PER_FRAME:
			sim.step(SIM_STEP)
			sim_accumulator -= SIM_STEP
			guard += 1
			sim.render_alpha = clamp(sim_accumulator / SIM_STEP, 0.0, 1.0)
			if sim.tick % 10 == 0:
				_check_era_milestone()
				_check_mission()
				_update_fun_systems()
				_update_ui()
	else:
		sim.render_alpha = 1.0

	render_accumulator += min(delta, MAX_FRAME_DELTA)
	var render_interval := RENDER_STEP
	if sim.organisms.size() >= 118:
		render_interval *= 2.0
	elif sim.organisms.size() >= 82:
		render_interval *= 1.5
	if reduced_motion:
		render_interval *= 1.5
	if render_accumulator >= render_interval:
		render_accumulator = fmod(render_accumulator, render_interval)
		queue_redraw()
		world_canvas.queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and not event.pressed:
		# GUI may consume a release; deferred cleanup runs after world handling.
		touch.call_deferred("release", event.index)
	if event is InputEventMouseMotion:
		pointer_position = event.position
		if placement_panel:
			placement_panel.visible = false
		sim.hover_cell = Vector2i(-1, -1)
	# Releases must be seen even when a UI panel consumes the event.
	if event is InputEventMouseButton and not event.pressed:
		paint_down = false
		panning = false


func _unhandled_input(event: InputEvent) -> void:
	_maybe_start_music_from_user_gesture(event)
	if (event is InputEventMouseButton or event is InputEventMouseMotion) and event.device == InputEvent.DEVICE_ID_EMULATION:
		return
	if not started:
		return
	if life_lab and life_lab.visible:
		if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE and started:
			life_lab.close()
		return
	if journal and journal.visible:
		if event is InputEventKey and event.pressed and event.keycode in [KEY_ESCAPE, KEY_J]:
			journal.close()
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_ESCAPE:
				if inspector_overlay and inspector_overlay.visible:
					_close_inspector()
				elif help_open:
					_toggle_help()
				elif pulse_open:
					_toggle_pulse()
			KEY_EQUAL, KEY_PLUS, KEY_KP_ADD:
				_zoom_camera(1.25)
			KEY_MINUS, KEY_KP_SUBTRACT:
				_zoom_camera(0.8)
			KEY_HOME:
				_fit_camera()
			KEY_J:
				journal.open()
			KEY_H:
				_toggle_help()
			KEY_SPACE:
				_toggle_running()
			KEY_N:
				_request_new_world()
			KEY_M:
				_toggle_motion()
			KEY_BRACKETLEFT:
				_change_speed(-1)
			KEY_BRACKETRIGHT:
				_change_speed(1)
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8:
				_select_tool(event.keycode - KEY_1)
	if event is InputEventMouseButton and event.button_index in [MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
		if camera.frame.has_point(event.position):
			_zoom_camera(1.25 if event.button_index == MOUSE_BUTTON_WHEEL_UP else 0.8, event.position)
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_MIDDLE:
		panning = event.pressed and camera.frame.has_point(event.position)
		paint_down = false
		return
	if event is InputEventMouseMotion:
		if panning:
			_pan_camera(event.relative)
			return
		pointer_position = event.position
		sim.set_hover_screen(_world_pointer(event.position))
		_update_placement_preview(event.position)
		if paint_down and paint_cooldown <= 0.0:
			_use_selected_tool(event.position)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if pan_mode:
			panning = event.pressed and camera.frame.has_point(event.position)
			paint_down = false
			return
		paint_down = event.pressed
		if event.pressed:
			pointer_position = event.position
			sim.set_hover_screen(_world_pointer(event.position))
			_update_placement_preview(event.position)
			_use_selected_tool(event.position)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
		_open_inspector(event.position)
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		touch.handle(self, event)


func _world_pointer(position: Vector2) -> Vector2:
	return camera.to_world(position)


func _world_bottom() -> float:
	return camera.frame.end.y


func _layout_view() -> void:
	var extent := get_viewport_rect().size
	var extra := maxf(0.0, extent.y - VIEW_SIZE.y)
	world_scale = Vector2(maxf(1.0, (extent.x - 516.0) / 924.0), (560.0 + extra) / 560.0)
	world_origin = PlanetSimulation.WORLD_OFFSET * (Vector2.ONE - world_scale)
	camera.frame = Rect2(PlanetSimulation.WORLD_OFFSET, PlanetSimulation.WORLD_SIZE * world_scale)
	if focus_mode:
		camera.frame.position.x = 16
		camera.frame.size.x = extent.x - 32
	camera.constrain()
	world_view.position = camera.frame.position
	world_view.size = camera.frame.size
	for item in layout_controls:
		var control: Control = item.node
		var base: Vector2 = item.position
		control.position = base
		if base.y >= 126 and (base.x < 230 or base.x >= 1186):
			control.visible = not focus_mode
		if base.x >= 1186:
			control.position.x += extent.x - VIEW_SIZE.x
		if base.y >= 710:
			control.position.y += extra
		if control is Panel and item.size.y == 668:
			control.size.y = 668 + extra
		if control == intro_overlay or control == inspector_overlay:
			control.position = (extent - VIEW_SIZE) * 0.5
			var shade := control.get_child(0) as ColorRect
			shade.position = -control.position
			shade.size = extent
	if graph:
		graph.position.x = camera.frame.position.x
		graph.size.x = camera.frame.size.x
	if guide_label:
		guide_label.position = Vector2(camera.frame.position.x + 20, _world_bottom() - 40)
	if toast_label:
		toast_label.position.y = _world_bottom() - 76
	if haze:
		haze.position = camera.frame.position
		haze.size = camera.frame.size
	if camera_bar:
		camera_bar.position = camera.frame.position + Vector2(12, 10)
		camera_bar.size.x = camera.frame.size.x - 24
		var screen_scale := maxf(0.25, get_viewport().get_screen_transform().get_scale().x)
		var compact := screen_scale < 0.65
		for control in camera_bar.get_children():
			if control is Button:
				control.custom_minimum_size = Vector2(42, 36) if not compact else Vector2(42, 42) / screen_scale
				control.add_theme_font_size_override("font_size", 15 if not compact else roundi(13.0 / screen_scale))
		camera_bar.queue_sort()
		follow_status.position = camera.frame.position + Vector2(12, 56)
	if journal:
		journal.layout(extent)
	if life_lab:
		life_lab.layout()
		var physical_width: float = extent.x * get_viewport().get_screen_transform().get_scale().x
		if physical_width < 600 and not started:
			life_lab.call_deferred("open")
	world_canvas.queue_redraw()
	queue_redraw()


func _build_world_view() -> void:
	world_view = Control.new()
	world_view.clip_contents = true
	world_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(world_view)
	world_canvas = Node2D.new()
	world_canvas.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	world_canvas.draw.connect(_draw_world_canvas)
	world_view.add_child(world_canvas)


func _draw() -> void:
	renderer.draw_background(self, sim)
	draw_rect(camera.frame.grow(3), Color(0.42, 0.92, 0.95, 0.18), false, 2.0)


func _draw_world_canvas() -> void:
	var view_scale := camera.scale()
	var view_origin := camera.origin() - camera.frame.position
	world_canvas.draw_set_transform(view_origin, 0, view_scale)
	renderer.draw_world(world_canvas, sim, view_scale, view_origin, camera.zoom)
	world_canvas.draw_set_transform(Vector2.ZERO)
	renderer.draw_organisms(world_canvas, sim, view_scale, view_origin, camera.zoom)
	world_canvas.draw_set_transform(view_origin, 0, view_scale)
	renderer.draw_overlay(world_canvas, sim)
	world_canvas.draw_set_transform(Vector2.ZERO)
	if not follow_target.is_empty():
		var point := camera.to_screen(PlanetSimulation.WORLD_OFFSET + Vector2(follow_target.pos)) - camera.frame.position
		world_canvas.draw_arc(point, 23.0 * camera.zoom, 0, TAU, 48, Color(0.8, 1, 0.65, 0.65), 1.5, true)


func _zoom_camera(factor: float, anchor := Vector2.INF) -> void:
	if anchor == Vector2.INF:
		anchor = camera.frame.get_center()
	paint_down = false
	camera.set_zoom(camera.zoom * factor, anchor)
	_refresh_camera()


func _pan_camera(delta: Vector2) -> void:
	follow_target = {}
	camera.pan(delta)
	_refresh_camera()


func _fit_camera() -> void:
	follow_target = {}
	camera.fit()
	_refresh_camera()


func _refresh_camera() -> void:
	if zoom_label:
		zoom_label.text = "%d%%" % roundi(camera.zoom * 100)
	if placement_panel:
		placement_panel.visible = false
	sim.hover_cell = Vector2i(-1, -1)
	world_canvas.queue_redraw()


func _update_camera(delta: float) -> void:
	if not follow_target.is_empty():
		if bool(follow_target.get("dead", true)) or not sim.organisms.has(follow_target):
			follow_target = {}
			_show_toast("This creature's life has ended. Inspect another to follow it.", Color("#b2d3d9"), 4.0)
		else:
			var target := PlanetSimulation.WORLD_OFFSET + Vector2(follow_target.pos)
			camera.center = target if reduced_motion else camera.center.lerp(target, 1.0 - exp(-delta * 7.0))
			camera.constrain()
	if follow_status:
		follow_status.visible = not follow_target.is_empty()
		if follow_status.visible:
			follow_status.text = "Following %s · Stop following" % _organism_common_name(str(follow_target.kind))


func _follow_inspected() -> void:
	if inspect_target.is_empty() or bool(inspect_target.get("dead", true)):
		return
	follow_target = inspect_target
	_close_inspector()
	camera.zoom = maxf(camera.zoom, 2.0)
	camera.center = PlanetSimulation.WORLD_OFFSET + Vector2(follow_target.pos)
	camera.constrain()
	pan_mode = false
	pan_button.button_pressed = false
	_refresh_camera()


func _toggle_focus() -> void:
	focus_mode = focus_button.button_pressed
	focus_button.text = "Show panels" if focus_mode else "Focus ocean"
	_layout_view()


func _build_camera_bar() -> void:
	camera_bar = HFlowContainer.new()
	camera_bar.mouse_filter = Control.MOUSE_FILTER_STOP
	camera_bar.add_theme_constant_override("separation", 6)
	ui.add_child(camera_bar)
	var minus := _camera_button("−", func(): _zoom_camera(0.8))
	minus.tooltip_text = "Zoom out (−)"
	zoom_label = Label.new()
	zoom_label.custom_minimum_size = Vector2(58, 36)
	zoom_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	camera_bar.add_child(zoom_label)
	_camera_button("+", func(): _zoom_camera(1.25)).tooltip_text = "Zoom in (+ or mouse wheel)"
	_camera_button("Journal", func(): journal.open()).tooltip_text = "Species guide and world history (J)"
	_camera_button("Save", func(): _save_world(true)).tooltip_text = "Save this world in this browser"
	_camera_button("Fit", _fit_camera).tooltip_text = "Show the whole ocean (Home)"
	pan_button = _camera_button("Pan", func():
		pan_mode = pan_button.button_pressed
		if pan_mode:
			inspect_mode = false
			inspect_button.button_pressed = false
		paint_down = false
	)
	pan_button.toggle_mode = true
	pan_button.tooltip_text = "Touch: drag to pan, pinch to zoom, tap to place. Mouse: enable Pan or middle-drag."
	focus_button = _camera_button("Focus ocean", _toggle_focus)
	focus_button.toggle_mode = true
	_camera_button("Settings", func(): settings.open())
	_camera_button("Life lab", func(): life_lab.open())
	follow_status = _button("", Vector2.ZERO, Vector2(300, 32))
	follow_status.add_theme_font_size_override("font_size", 13)
	follow_status.pressed.connect(func(): follow_target = {})
	follow_status.visible = false
	_refresh_camera()


func _camera_button(text: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(42, 36)
	button.focus_mode = Control.FOCUS_NONE
	glass.style_button(button)
	button.pressed.connect(action)
	camera_bar.add_child(button)
	return button


func _toggle_inspect_mode() -> void:
	inspect_mode = inspect_button.button_pressed
	pan_mode = false
	panning = false
	pan_button.button_pressed = false
	paint_down = false
	placement_panel.visible = false
	_show_toast("Click a creature or habitat to inspect it" if inspect_mode else "Painting resumed", Color("#aef8e3"))


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
	fresh.pressed.connect(_request_new_world)

	_panel(Vector2(16, 126), Vector2(214, 668), Color(0.012, 0.03, 0.042, 0.9))
	_header("LIFE LAB", Vector2(34, 146))
	for i in range(PlanetSimulation.TOOLS.size()):
		var cost: int = PlanetSimulation.TOOL_COSTS[i]
		var b := _button("[%d] %s   %dC" % [i + 1, TOOL_SHORT_NAMES[i], cost], Vector2(32, 177 + i * 40), Vector2(182, 34))
		b.add_theme_font_size_override("font_size", 13)
		b.clip_text = true
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
	inspect_button = _button("Inspect life", Vector2(32, 680), Vector2(182, 34))
	inspect_button.toggle_mode = true
	inspect_button.pressed.connect(_toggle_inspect_mode)
	var keys := _label("Space pause • [ ] speed\n1–8 tools  •  H live help", Vector2(34, 726), 12, Color("#7897a2"))
	keys.size = Vector2(176, 38)

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
	pulse_button = _button("PULSE", Vector2(1324, 326), Vector2(80, 30))
	pulse_button.add_theme_font_size_override("font_size", 11)
	pulse_button.tooltip_text = "Open Planet Pulse: see what changed and why"
	pulse_button.pressed.connect(_toggle_pulse)
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
		event_button.clip_text = true
		event_button.tooltip_text = "%d Catalyst" % PlanetSimulation.DISASTER_COSTS[i]
		event_button.pressed.connect(_trigger_event.bind(event_name))

	graph = Control.new()
	graph.position = Vector2(246, 710)
	graph.size = Vector2(924, 84)
	graph.mouse_filter = Control.MOUSE_FILTER_STOP
	graph.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	graph.tooltip_text = "Open population history"
	graph.gui_input.connect(func(event: InputEvent):
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
			journal.open(true)
	)
	graph.draw.connect(_draw_graph)
	ui.add_child(graph)
	var legend := _label("RELATIVE TRENDS · Click to explore history", Vector2(262, 714), 11, Color("#9dbac1"))
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

	guide_label = _label("", Vector2(266, 660), 17, Color("#e2fff2"))
	guide_label.add_theme_color_override("font_shadow_color", Color("#031c29"))
	guide_label.add_theme_constant_override("shadow_outline_size", 6)
	_select_tool(0)
	_build_placement_preview()
	_build_help_coach()
	_build_planet_pulse()
	_build_camera_bar()
	_build_intro()
	_build_inspector()
	_build_save_ui()
	_build_event_ui()
	journal = OceanJournal.new()
	ui.add_child(journal)
	journal.setup(self)
	settings = OceanSettings.new()
	ui.add_child(settings)
	settings.setup(self)
	life_lab = LifeLab.new()
	ui.add_child(life_lab)
	life_lab.setup(self)


func _build_intro() -> void:
	intro_overlay = Control.new()
	intro_overlay.position = Vector2.ZERO
	intro_overlay.size = VIEW_SIZE
	intro_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	ui.add_child(intro_overlay)
	var shade := ColorRect.new()
	shade.size = VIEW_SIZE
	shade.color = Color(0.005, 0.012, 0.025, 0.64)
	intro_overlay.add_child(shade)
	var card := Panel.new()
	card.position = Vector2(336, 92)
	card.size = Vector2(768, 626)
	glass.style_panel(card, Color(0.018, 0.052, 0.069, 0.98), Color(0.35, 1.0, 0.78, 0.38))
	intro_overlay.add_child(card)
	var eyebrow := _child_label(card, "A LIVING OCEAN • YOUR FIRST EXPEDITION", Vector2(48, 42), 14, Color("#63f7ce"))
	var title := _child_label(card, "Bring a little world to life.", Vector2(48, 78), 38, Color("#f3fffa"))
	var body := _child_label(card, "Every living world begins with something small.\nPlant your first colony in the turquoise shallows, then watch life take hold.", Vector2(50, 140), 17, Color("#b2d3d9"))
	body.size = Vector2(660, 76)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_intro_step(card, "01", "Seed the shallows", "Choose Cyano Mats, then click three places in the turquoise water.", 232)
	_intro_step(card, "02", "Build a balanced web", "Add drifters, grazers, then predators as missions unlock.", 326)
	_intro_step(card, "03", "Protect the planet", "Watch Stability, oxygen, and population history—not just raw growth.", 420)
	var note := _child_label(card, "Your next step stays visible along the ocean floor. Open HELP when you want more\ndetail, or choose Inspect life to meet the creatures in your world.", Vector2(50, 506), 13, Color("#8fd8c6"))
	note.size = Vector2(660, 40)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var launch := Button.new()
	launch.text = "AWAKEN THE OCEAN"
	launch.position = Vector2(250, 558)
	launch.size = Vector2(268, 48)
	glass.style_button(launch, Color(0.06, 0.58, 0.44, 0.9))
	launch.pressed.connect(_start_new_from_intro)
	card.add_child(launch)
	resume_button = Button.new()
	resume_button.text = "RESUME SAVED WORLD"
	resume_button.position = Vector2(50, 558)
	resume_button.size = Vector2(290, 48)
	glass.style_button(resume_button, Color(0.05, 0.42, 0.38, 0.95))
	resume_button.pressed.connect(_resume_saved_world)
	resume_button.visible = false
	card.add_child(resume_button)
	launch.set_meta("new_world_launch", true)
	resume_detail = _child_label(card, "", Vector2(50, 518), 13, Color("#b3efd5"))
	resume_detail.size = Vector2(668, 35)
	resume_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	resume_detail.visible = false
	card.set_meta("intro_note", note)


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
	help_body.position = Vector2(24, 140)
	help_body.size = Vector2(344, 268)
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


func _build_placement_preview() -> void:
	placement_panel = Panel.new()
	placement_panel.size = Vector2(342, 104)
	placement_panel.visible = false
	placement_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	glass.style_panel(placement_panel, Color(0.008, 0.033, 0.045, 0.96), Color(0.35, 1.0, 0.78, 0.48))
	ui.add_child(placement_panel)
	placement_title = _child_label(placement_panel, "", Vector2(16, 10), 13, Color("#66ffc7"))
	placement_title.size = Vector2(310, 22)
	placement_title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	placement_body = _child_label(placement_panel, "", Vector2(16, 35), 12, Color("#c0d9dd"))
	placement_body.size = Vector2(310, 62)
	placement_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	placement_body.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _build_planet_pulse() -> void:
	pulse_panel = Panel.new()
	pulse_panel.position = Vector2(770, 132)
	pulse_panel.size = Vector2(392, 490)
	pulse_panel.visible = false
	pulse_panel.mouse_filter = Control.MOUSE_FILTER_STOP
	glass.style_panel(pulse_panel, Color(0.012, 0.045, 0.061, 0.98), Color(0.42, 0.88, 1.0, 0.58))
	ui.add_child(pulse_panel)
	_child_label(pulse_panel, "PLANET PULSE", Vector2(24, 18), 14, Color("#8defff"))
	var live := _child_label(pulse_panel, "LIVE  •  cause-and-effect report", Vector2(24, 43), 11, Color("#75d7c1"))
	live.size = Vector2(250, 20)
	var minimize := Button.new()
	minimize.text = "—"
	minimize.position = Vector2(332, 16)
	minimize.size = Vector2(38, 34)
	minimize.focus_mode = Control.FOCUS_NONE
	minimize.tooltip_text = "Minimize Planet Pulse"
	glass.style_button(minimize, Color(0.06, 0.22, 0.25, 0.9))
	minimize.pressed.connect(_toggle_pulse)
	pulse_panel.add_child(minimize)
	pulse_title = _child_label(pulse_panel, "Your world is waking up", Vector2(24, 72), 22, Color("#f1fffb"))
	pulse_title.size = Vector2(342, 54)
	pulse_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pulse_body = RichTextLabel.new()
	pulse_body.position = Vector2(24, 132)
	pulse_body.size = Vector2(344, 276)
	pulse_body.bbcode_enabled = true
	pulse_body.fit_content = false
	pulse_body.scroll_active = false
	pulse_body.add_theme_font_size_override("normal_font_size", 13)
	pulse_body.add_theme_font_size_override("bold_font_size", 14)
	pulse_panel.add_child(pulse_body)
	pulse_action_button = Button.new()
	pulse_action_button.text = "OPEN COACH FOR THE NEXT MOVE"
	pulse_action_button.position = Vector2(24, 422)
	pulse_action_button.size = Vector2(344, 46)
	pulse_action_button.focus_mode = Control.FOCUS_NONE
	glass.style_button(pulse_action_button, Color(0.05, 0.42, 0.56, 0.95))
	pulse_action_button.pressed.connect(_open_coach_from_pulse)
	pulse_panel.add_child(pulse_action_button)


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
	specimen = Control.new()
	specimen.position = Vector2(430, 208)
	specimen.mouse_filter = Control.MOUSE_FILTER_IGNORE
	specimen.draw.connect(_draw_specimen)
	card.add_child(specimen)
	inspector_button = Button.new()
	inspector_button.text = "RETURN TO THE OCEAN"
	inspector_button.position = Vector2(164, 430)
	inspector_button.size = Vector2(252, 46)
	glass.style_button(inspector_button, Color(0.06, 0.58, 0.44, 0.9))
	inspector_button.pressed.connect(_close_inspector)
	card.add_child(inspector_button)
	follow_button = Button.new()
	follow_button.text = "FOLLOW CREATURE"
	follow_button.position = Vector2(322, 300)
	follow_button.size = Vector2(216, 36)
	follow_button.focus_mode = Control.FOCUS_NONE
	glass.style_button(follow_button)
	follow_button.add_theme_font_size_override("font_size", 13)
	follow_button.pressed.connect(_follow_inspected)
	card.add_child(follow_button)


func _intro_step(parent: Control, number: String, heading: String, copy: String, y: float) -> void:
	var badge := _child_label(parent, number, Vector2(52, y), 24, Color("#55f0c2"))
	badge.size = Vector2(48, 40)
	_child_label(parent, heading, Vector2(116, y), 18, Color("#f1fffb"))
	_child_label(parent, copy, Vector2(116, y + 34), 14, Color("#8fafb7"))


func _start_game() -> void:
	if life_lab:
		life_lab.hide()
	started = true
	running = true
	intro_overlay.visible = false
	play_button.text = "Pause"
	if field_study_index < 0:
		_start_field_study()
	_update_ui()
	_show_toast("Mission 1: seed the shallows  •  Open HELP for live guidance", Color("#63f7ce"), 3.2)


func _reset_world(announce := true) -> void:
	if life_lab:
		life_lab.hide()
	sim.seed_text = "genesis-%d" % randi_range(1000, 999999)
	sim.new_world(sim.seed_text)
	observed_era = str(sim.era_data().era)
	event_glow = 0.0
	autosave_elapsed = 0.0
	_fit_camera()
	sim.reduced_motion = reduced_motion
	mission_stage = 0
	_reset_fun_systems()
	sim_accumulator = 0.0
	paint_down = false
	touch.reset()
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
	journal_seen.clear()
	achievements.clear()
	current_crisis = ""
	last_crisis_notice_tick = -1000
	help_open = false
	coach_tip_key = ""
	coach_seen_key = ""
	coach_action_kind = ""
	coach_action_value = ""
	pulse_open = false
	pulse_unread = false
	pulse_snapshot = sim.stats().duplicate()
	pulse_trend = {"stability": 0.0, "oxygen": 0.0, "population": 0, "biodiversity": 0.0, "microbes": 0}
	pulse_last_tick = sim.tick
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Expedition began"})
	sim.set_hotspot(Vector2i(-1, -1), false)
	if inspector_overlay:
		inspector_overlay.visible = false
	if help_panel:
		help_panel.visible = false
	if pulse_panel:
		pulse_panel.visible = false
	if placement_panel:
		placement_panel.visible = false


func _toggle_running() -> void:
	if not started:
		return
	running = not running
	play_button.text = "Pause" if running else "Play"
	_show_toast("Simulation resumed" if running else "Simulation paused", Color("#d9f7ef"))
	_update_placement_preview(pointer_position)


func _change_speed(direction := 1) -> void:
	speed_index = posmod(speed_index + direction, SPEEDS.size())
	speed_button.text = _speed_text()
	_show_toast("Simulation speed: %s" % _speed_text(), Color("#8cdef2"))


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
	inspect_mode = false
	pan_mode = false
	panning = false
	if pan_button:
		pan_button.button_pressed = false
	if inspect_button:
		inspect_button.button_pressed = false
	sim.select_tool(index)
	for i in range(tool_buttons.size()):
		tool_buttons[i].button_pressed = i == index
	_show_toast("%s selected — %d Catalyst per use" % [TOOL_SHORT_NAMES[index], PlanetSimulation.TOOL_COSTS[index]], Color("#aef8e3"))
	_update_placement_preview(pointer_position)


func _use_selected_tool(position: Vector2) -> void:
	if not camera.frame.has_point(position):
		return
	if inspect_mode:
		_open_inspector(position)
		paint_down = false
		return
	var world_position := _world_pointer(position)
	if not running or not sim.is_screen_in_world(world_position):
		return
	var result: Dictionary = sim.tool_at_screen(world_position)
	paint_cooldown = 0.085 if not reduced_motion else 0.14
	if result.ok:
		var fun_message := _handle_fun_action(result)
		_show_toast("%s%s" % [result.message, fun_message], Color("#aef8e3"), 1.15)
	else:
		_show_toast(result.message, Color("#ffbd91"), 1.4)
	_update_placement_preview(position)
	_update_ui()


func _update_placement_preview(position: Vector2) -> void:
	if not placement_panel:
		return
	var blocked_by_overlay := help_open or pulse_open or not follow_target.is_empty() or (journal and journal.visible) or (inspector_overlay and inspector_overlay.visible)
	var preview: Dictionary = sim.preview_at_screen(_world_pointer(position))
	if not started or pan_mode or inspect_mode or not camera.frame.has_point(position) or blocked_by_overlay or preview.is_empty():
		placement_panel.visible = false
		return
	var quality := str(preview.get("quality", "USEFUL"))
	var title_color := Color("#66ffc7")
	if not bool(preview.get("valid", true)):
		title_color = Color("#ff7770")
	elif quality == "RISKY" or quality == "LOW IMPACT":
		title_color = Color("#ffd36f")
	placement_title.add_theme_color_override("font_color", title_color)
	placement_title.text = "%s  •  %s  •  %d CATALYST" % [quality, TOOL_SHORT_NAMES[int(preview.tool)].to_upper(), int(preview.cost)]
	var relevance := _placement_relevance(Vector2i(preview.cell))
	if not running:
		relevance = "PAUSED  •  Resume the ocean before placing this intervention."
	placement_body.text = "%s\n%s" % [str(preview.effect), relevance]
	var card_position := position + Vector2(18, 18)
	if card_position.x + placement_panel.size.x > camera.frame.end.x:
		card_position.x = position.x - placement_panel.size.x - 18.0
	if card_position.y + placement_panel.size.y > _world_bottom():
		card_position.y = position.y - placement_panel.size.y - 18.0
	card_position.x = clamp(card_position.x, camera.frame.position.x + 8.0, camera.frame.end.x - placement_panel.size.x - 8.0)
	card_position.y = clamp(card_position.y, PlanetSimulation.WORLD_OFFSET.y + 8.0, _world_bottom() - placement_panel.size.y - 8.0)
	placement_panel.position = card_position
	placement_panel.visible = true


func _placement_relevance(cell_pos: Vector2i) -> String:
	if field_study_index >= 0:
		var study: Dictionary = FIELD_STUDIES[field_study_index]
		if sim.selected_tool == int(study.tool):
			if sim.hotspot_active and Vector2(cell_pos).distance_to(Vector2(sim.hotspot_cell)) <= 4.2:
				return "GOLD HOTSPOT  •  Double field-study progress here."
			return "FIELD STUDY  •  Counts once; the gold diamond counts twice."
	var mission_move := false
	match mission_stage:
		0:
			mission_move = sim.selected_tool == 0
		1:
			mission_move = sim.selected_tool == 0 or sim.selected_tool == 1 or sim.selected_tool == 2
		2:
			mission_move = sim.selected_tool == 3 or sim.selected_tool == 4
		3:
			mission_move = sim.selected_tool == 0
		4:
			mission_move = sim.selected_tool == 4
	if mission_move:
		return "MISSION MOVE  •  Directly supports the current objective."
	return "ECOSYSTEM MOVE  •  Open Planet Pulse afterward to see the result."


func _build_event_ui() -> void:
	event_dialog = ConfirmationDialog.new()
	event_dialog.title = "Prepare a world event"
	var event_theme := Theme.new()
	var surface := StyleBoxFlat.new()
	surface.bg_color = Color("#0c2029")
	surface.border_color = Color("#529b9d")
	surface.set_border_width_all(1)
	surface.set_content_margin_all(16)
	event_theme.set_stylebox("panel", "AcceptDialog", surface)
	var border: StyleBoxFlat = surface.duplicate()
	border.expand_margin_top = 32
	event_theme.set_stylebox("embedded_border", "Window", border)
	event_dialog.theme = event_theme
	glass.style_button(event_dialog.get_ok_button())
	glass.style_button(event_dialog.get_cancel_button())
	event_dialog.ok_button_text = "Apply event"
	event_dialog.cancel_button_text = "Keep observing"
	event_dialog.get_label().autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	event_dialog.get_label().custom_minimum_size = Vector2(500, 230)
	event_dialog.get_label().add_theme_font_size_override("font_size", 20)
	event_dialog.get_ok_button().custom_minimum_size.y = 44
	event_dialog.get_cancel_button().custom_minimum_size.y = 44
	event_dialog.confirmed.connect(_confirm_event)
	event_dialog.canceled.connect(_cancel_event)
	ui.add_child(event_dialog)


func _trigger_event(event_name: String) -> void:
	if not started or not EVENT_BRIEFINGS.has(event_name) or not pending_event.is_empty():
		return
	var index: int = PlanetSimulation.DISASTERS.find(event_name)
	var cost: int = PlanetSimulation.DISASTER_COSTS[index]
	if sim.catalyst < cost:
		_show_toast("Need %d Catalyst for %s" % [cost, event_name], Color("#ff9f91"), 2.0)
		return
	pending_event = event_name
	var tint := Color("#83d3ed") if event_name in ["Monsoon", "Seed Recovery"] else Color("#efb671")
	haze.material.set_shader_parameter("event_tint", tint)
	event_was_running = running
	running = false
	paint_down = false
	panning = false
	play_button.text = "Play"
	event_dialog.title = "%s · %d Catalyst" % [event_name, cost]
	event_dialog.dialog_text = "%s\n\nRECOVERY PLAN\n%s\n\nThe ocean is paused while you decide." % EVENT_BRIEFINGS[event_name]
	if life_lab.compact():
		life_lab.open_event()
	else:
		event_dialog.popup_centered(Vector2i(560, 350))


func _cancel_event() -> void:
	if pending_event.is_empty():
		return
	pending_event = ""
	running = event_was_running
	play_button.text = "Pause" if running else "Play"


func _confirm_event() -> void:
	if pending_event.is_empty():
		return
	var event_name := pending_event
	_cancel_event()
	var result: Dictionary = sim.disaster(event_name)
	if result.ok:
		pulse_unread = true
		settings.cue()
		event_glow = 0.6
		# Keep aftercare in the saved chronicle, not just a disappearing toast.
		sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Recovery: " + str(EVENT_BRIEFINGS[event_name][1])})
		_show_toast(event_name + " · " + str(EVENT_BRIEFINGS[event_name][1]), Color("#ffca8c"), 7.0)
	else:
		_show_toast(result.message, Color("#ff9f91"), 2.0)
	_update_ui()


func _check_era_milestone() -> void:
	var era: Dictionary = sim.era_data()
	if observed_era == str(era.era):
		return
	observed_era = str(era.era)
	settings.cue()
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Era reached: %s — %s" % [era.era, era.epoch]})
	_show_toast("NEW ERA · %s · %s" % [era.era, era.epoch], Color("#ffe7a3"), 8.0)
	pulse_unread = true


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
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Field study complete: " + title})
	if field_studies_completed >= 3:
		_unlock_badge("Field Researcher")
	_start_field_study()


func _update_fun_systems() -> void:
	if not started:
		return
	var s := sim.stats()
	_update_pulse_trend(s)
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
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Discovered " + discovery})
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
		sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Crisis: " + current_crisis})
		_show_toast("ECOSYSTEM ALERT — %s" % current_crisis, Color("#ffad7a"), 3.0)


func _detect_crisis(s: Dictionary) -> String:
	if float(s.climate_heat) >= 0.72:
		return "Ocean overheating — use Monsoon or expand tidal water"
	if int(s.population) >= 112:
		return "Overcrowding — add hunters sparingly or use Viral Bloom" if mission_stage >= TOOL_UNLOCK_STAGE[3] else "Overcrowding — hunters unlock after mission 2; preserve the food supply"
	var food_demand: float = float(s.amoeboids) + float(s.grazers) * 2.2
	if int(s.population) > 30 and float(s.microbes) < food_demand * 1.8:
		return "Food web starving — seed cyano mats and nutrients"
	if mission_stage >= 2 and int(s.amoeboids) + int(s.grazers) > 90 and int(s.predators) < 2:
		return "Consumers unchecked — introduce predatory swimmers"
	return ""


func _update_pulse_trend(s: Dictionary) -> void:
	if pulse_snapshot.is_empty():
		pulse_snapshot = s.duplicate()
		pulse_last_tick = sim.tick
		return
	if sim.tick - pulse_last_tick < 40:
		return
	pulse_trend = {
		"stability": float(s.stability) - float(pulse_snapshot.stability),
		"oxygen": float(s.oxygen) - float(pulse_snapshot.oxygen),
		"population": int(s.population) - int(pulse_snapshot.population),
		"biodiversity": float(s.biodiversity) - float(pulse_snapshot.biodiversity),
		"microbes": int(s.microbes) - int(pulse_snapshot.microbes),
	}
	var meaningful: bool = abs(float(pulse_trend.stability)) >= 1.0 \
		or abs(int(pulse_trend.population)) >= 3 \
		or abs(float(pulse_trend.biodiversity)) >= 1.5 \
		or abs(int(pulse_trend.microbes)) >= 18
	if meaningful and not pulse_open:
		pulse_unread = true
	pulse_snapshot = s.duplicate()
	pulse_last_tick = sim.tick


func _update_planet_pulse(s: Dictionary) -> void:
	if not pulse_button or not pulse_panel:
		return
	pulse_button.text = "PULSE • OPEN" if pulse_open else ("PULSE • NEW" if pulse_unread else "PULSE")
	pulse_title.text = _pulse_headline(s)
	var stability_delta := float(pulse_trend.get("stability", 0.0))
	var population_delta := int(pulse_trend.get("population", 0))
	var oxygen_delta := float(pulse_trend.get("oxygen", 0.0)) * 100.0
	var diversity_delta := float(pulse_trend.get("biodiversity", 0.0))
	var recent := ""
	var event_count := 0
	for i in range(sim.events.size() - 1, -1, -1):
		var entry: Dictionary = sim.events[i]
		var event_text := str(entry.get("type", "World changed"))
		if event_text.begins_with("Tool: "):
			event_text = "Placed " + event_text.trim_prefix("Tool: ")
		recent += "Day %d  •  %s\n" % [int(entry.get("day", sim.day)), event_text]
		event_count += 1
		if event_count >= 3:
			break
	if recent == "":
		recent = "Day %d  •  The expedition is beginning.\n" % sim.day
	pulse_body.text = "[color=#8defff]SINCE THE LAST PULSE[/color]\n%s   %s\n%s   %s\n\n[color=#75d7c1]WHY[/color]\n[b]Strongest support[/b]  %s\n[b]Main pressure[/b]  %s\n\n[color=#ffe38a]WORLD CHRONICLE[/color]\n%s" % [
		_pulse_delta("Stability", stability_delta, "", 1),
		_pulse_delta("Population", float(population_delta), "", 0),
		_pulse_delta("O₂", oxygen_delta, "%", 2),
		_pulse_delta("Diversity", diversity_delta, "", 1),
		_pulse_support(s),
		_pulse_pressure(s),
		recent,
	]


func _pulse_headline(s: Dictionary) -> String:
	if current_crisis != "":
		return "The world needs intervention"
	var stability_delta := float(pulse_trend.get("stability", 0.0))
	if stability_delta <= -2.0:
		return "Stability is slipping"
	if float(s.stability) >= 68.0 and stability_delta >= 0.0:
		return "The food web is finding balance"
	if int(s.microbes) < 180:
		return "Life needs a stronger foundation"
	if mission_stage >= TOOL_UNLOCK_STAGE[3] and int(s.predators) == 0 and int(s.amoeboids) + int(s.grazers) >= 30:
		return "The food web is missing hunters"
	return "The young biosphere is taking shape"


func _pulse_support(s: Dictionary) -> String:
	var name := "microbial foundation"
	var value := float(s.foundation_score)
	if float(s.consumer_score) > value:
		name = "drifter population"
		value = float(s.consumer_score)
	if float(s.grazer_score) > value:
		name = "grazer layer"
		value = float(s.grazer_score)
	if float(s.predator_score) > value:
		name = "predator balance"
		value = float(s.predator_score)
	if float(s.diversity_score) > value:
		name = "biodiversity"
		value = float(s.diversity_score)
	return "%s (+%.1f stability)" % [name.capitalize(), value]


func _pulse_pressure(s: Dictionary) -> String:
	if float(s.climate_heat) >= 0.68:
		return "Heat is stressing every layer"
	if float(s.crowding_penalty) >= 1.0 and float(s.crowding_penalty) >= float(s.starvation_penalty):
		return "Crowding costs −%.1f stability" % float(s.crowding_penalty)
	if float(s.starvation_penalty) >= 1.0:
		return "Food shortage costs −%.1f stability" % float(s.starvation_penalty)
	if float(s.foundation_score) < 12.0:
		return "Too little microbial habitat"
	if mission_stage >= TOOL_UNLOCK_STAGE[3] and int(s.predators) == 0 and int(s.amoeboids) + int(s.grazers) >= 30:
		return "Consumers lack a hunter layer"
	return "No major pressure detected"


func _pulse_delta(label: String, value: float, suffix: String, digits: int) -> String:
	var threshold := 0.005 if suffix == "%" else 0.05
	if abs(value) < threshold:
		return "[color=#8fafb7]%s steady[/color]" % label
	var direction := "rising" if value > 0.0 else "falling"
	var color := "#66ffc7" if value > 0.0 else "#ff9a83"
	var formatted := (("%+.0f" % value) if digits == 0 else (("%+.2f" % value) if digits == 2 else ("%+.1f" % value))) + suffix
	return "[color=%s]%s %s %s[/color]" % [color, label, direction, formatted]


func _unlock_badge(badge: String) -> void:
	if achievements.has(badge):
		return
	achievements[badge] = true
	score += 150
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Badge unlocked: " + badge})
	_show_toast("BADGE UNLOCKED — %s" % badge, Color("#ffe38a"), 2.8)


func _open_inspector(position: Vector2) -> void:
	if not started or not camera.frame.has_point(position) or not sim.is_screen_in_world(_world_pointer(position)):
		return
	var info: Dictionary = sim.inspect_at_screen(_world_pointer(position))
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
	inspect_target = organism
	follow_button.visible = not organism.is_empty()
	inspected_organism = organism.duplicate()
	specimen.queue_redraw()
	if organism.is_empty():
		inspector_label.text = "[b][color=#63f7ce]%s biome[/color][/b]\nCell %d, %d\n\n[b]Microbial cover[/b]  %.0f%%\n[b]Nutrients[/b]  %.0f%%\n[b]Temperature[/b]  %.0f%%\n[b]Water[/b]  %.0f%%\n\n[color=#8fafb7]No large organism is close enough to inspect. Right-click directly beside a moving creature.[/color]" % [
			str(inspected_cell.type).capitalize(), int(info.cell_pos.x), int(info.cell_pos.y),
			float(inspected_cell.microbes) * 100.0, float(inspected_cell.nutrients) / 1.45 * 100.0,
			float(inspected_cell.temperature) * 100.0, float(inspected_cell.water) * 100.0,
		]
	else:
		var common_name := _organism_common_name(str(organism.kind))
		inspector_label.text = "[b][color=#63f7ce]%s[/color][/b]\n[color=#9de7ff]%s[/color]  •  Generation %d\n[color=#ffe7a3]%s[/color]\n[b]Energy[/b]  %.0f\n[b]Age[/b]  %.1f days\n[b]Speed[/b]  %.2f\n[b]Armor[/b]  %.2f\n[b]Awareness[/b]  %.2f\n[b]Fertility[/b]  %.2f\n[b]Camouflage[/b]  %.2f\n\n[color=#8fafb7]Open the Ocean Journal (J) for its diet, predators and care notes. Traits pass to descendants with small mutations.[/color]" % [
			common_name, str(organism.lineage), int(organism.generation), SpeciesGuide.behavior(organism), float(organism.energy),
			float(organism.age), float(organism.speed), float(organism.armor), float(organism.sensory),
			float(organism.fertility), float(organism.camouflage),
		]
	if placement_panel:
		placement_panel.visible = false
	inspector_overlay.visible = true


func _draw_specimen() -> void:
	if inspected_organism.is_empty():
		return
	specimen.draw_circle(Vector2.ZERO, 70, Color(0.07, 0.22, 0.28, 0.8))
	specimen.draw_arc(Vector2.ZERO, 70, 0, TAU, 64, Color(0.3, 0.8, 0.76, 0.35), 1.0, true)
	specimen.draw_set_transform(Vector2.ZERO, 0, Vector2(3.0, 3.0))
	match str(inspected_organism.kind):
		"amoeboid":
			renderer.draw_amoeboid(specimen, Vector2.ZERO, inspected_organism, 0, true)
		"grazer":
			renderer.draw_grazer(specimen, Vector2.ZERO, inspected_organism, Vector2(1, -0.25))
		"predator":
			renderer.draw_predator(specimen, Vector2.ZERO, inspected_organism, Vector2(1, -0.25))
	specimen.draw_set_transform(Vector2.ZERO)


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
	_update_placement_preview(pointer_position)


func _finish_world(s: Dictionary) -> void:
	_unlock_badge("Planet Maker")
	var final_score := score + int(float(s.stability) * 25.0) + discoveries.size() * 250 + achievements.size() * 200
	var grade := _world_grade(final_score)
	inspected_organism = {}
	specimen.queue_redraw()
	follow_button.visible = false
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
	sim.events.append({"day": sim.day, "tick": sim.tick, "type": "Mission complete: " + finished_title})
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
	if started:
		SpeciesGuide.observe(sim, journal_seen, s)
	if guide_label and started:
		var tip := _coach_tip(s)
		guide_label.text = "NEXT  •  " + str(tip.get("title", "Watch your ocean thrive")) + "   ·   H for guidance"
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
	crisis_label.text = "ALERT · %s" % current_crisis if current_crisis != "" else ""
	if field_study_index >= 0:
		var study: Dictionary = FIELD_STUDIES[field_study_index]
		field_label.text = "FIELD STUDY: %s  •  %s %d/%d  •  gold hotspot = double" % [
			str(study.title), TOOL_SHORT_NAMES[int(study.tool)], field_study_progress, int(study.goal),
		]
	else:
		field_label.text = "FIELD STUDY  •  launches with the expedition"
	_update_planet_pulse(s)
	_update_help_coach(s)
	_update_tool_locks()
	_update_placement_preview(pointer_position)
	graph.queue_redraw()


func _toggle_help() -> void:
	if not help_panel:
		return
	help_open = not help_open
	if help_open and pulse_open:
		pulse_open = false
		pulse_panel.visible = false
	help_panel.visible = help_open
	_update_help_coach(sim.stats())
	if help_open:
		coach_seen_key = coach_tip_key
		help_button.text = "HELP • OPEN"
	_update_planet_pulse(sim.stats())
	_update_placement_preview(pointer_position)


func _toggle_pulse() -> void:
	if not pulse_panel:
		return
	pulse_open = not pulse_open
	if pulse_open and help_open:
		help_open = false
		help_panel.visible = false
		_update_help_coach(sim.stats())
	pulse_panel.visible = pulse_open
	if pulse_open:
		pulse_unread = false
	_update_planet_pulse(sim.stats())
	_update_placement_preview(pointer_position)


func _open_coach_from_pulse() -> void:
	if pulse_open:
		_toggle_pulse()
	if not help_open:
		_toggle_help()


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
	if mission_stage == 3 and float(s.oxygen) < 0.035 and float(s.get("oxygen_balance", 0.0)) < 0.0 and int(s.microbes) >= 260:
		return {
			"key": "m3-oxygen-demand", "title": "Give oxygen room to recover",
			"action": "Stop adding animals. Review Viral Bloom to reduce oxygen demand, then protect and expand the surviving microbial layer.",
			"why": "Animal oxygen use currently exceeds microbial production. Faster simulation alone cannot reverse that deficit.",
			"status": "O₂ %.1f/3.5%% · Animals %d · Oxygen balance falling" % [float(s.oxygen) * 100.0, int(s.population)],
			"action_kind": "event", "action_value": "Viral Bloom", "button": "REVIEW VIRAL BLOOM",
		}
	if current_crisis.begins_with("Overcrowding") and mission_stage < TOOL_UNLOCK_STAGE[3] and int(s.microbes) >= 220:
		var tip := _mission_coach_tip(s)
		tip.why += " Hunters unlock after mission 2. Complete these early steps while keeping the food supply healthy."
		return tip
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
			"key": "crisis-crowding-event", "title": "Thin the population",
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
	if mission_stage < TOOL_UNLOCK_STAGE[3]:
		return _mission_coach_tip(s)
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
			speed_button.text = _speed_text()
			_show_toast("Help Coach set the ocean to %s" % _speed_text(), Color("#8defff"), 2.4)
		"event":
			_trigger_event(coach_action_value)
	_update_ui()


func _speed_text() -> String:
	var value := SPEEDS[speed_index]
	if is_equal_approx(value, floor(value)):
		return "%dx" % int(value)
	return "%.1fx" % value


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
	haze = ColorRect.new()
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
	graph_renderer.draw_graph(graph, sim.history, [], sim.tick)


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


func _build_save_ui() -> void:
	save_status = _label("Autosaves every 30s · this browser", Vector2(34, 766), 11, Color("#88b8b6"))
	save_status.size = Vector2(180, 25)
	save_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	new_world_dialog = ConfirmationDialog.new()
	new_world_dialog.title = "Begin a new ocean?"
	new_world_dialog.dialog_text = "Your saved world will be replaced by this new expedition.\nChoose Cancel to keep exploring your current world."
	new_world_dialog.ok_button_text = "Start new world"
	new_world_dialog.confirmed.connect(func():
		_reset_world(true)
		_start_game()
		_save_world(false)
	)
	new_world_dialog.canceled.connect(func(): running = new_world_was_running)
	add_child(new_world_dialog)


func _check_saved_world() -> void:
	var found := WorldSave.read(save_path)
	if found.is_empty():
		if FileAccess.file_exists(save_path):
			save_status.text = "Saved world could not be read"
		return
	saved_checkpoint = found.data
	save_recovered = found.recovered
	resume_button.visible = true
	resume_detail.visible = true
	var state: Dictionary = saved_checkpoint.simulation
	resume_detail.text = "%sDay %d · %s · saved %s" % ["Recovered checkpoint · " if save_recovered else "", state.day, state.seed_text, saved_checkpoint.saved_at.replace("T", " ")]
	var card := resume_button.get_parent()
	card.get_meta("intro_note").visible = false
	for child in card.get_children():
		if child.has_meta("new_world_launch"):
			child.position.x = 362
			child.text = "START NEW WORLD"


func _start_new_from_intro() -> void:
	if saved_checkpoint.is_empty():
		_start_game()
	else:
		_request_new_world()


func _request_new_world() -> void:
	if save_pending:
		_show_toast("Wait for the current save to finish before starting a new world.", Color("#ffe7a3"), 4.0)
		return
	if not started and saved_checkpoint.is_empty():
		_start_game()
		return
	new_world_was_running = running
	running = false
	paint_down = false
	panning = false
	new_world_dialog.popup_centered(Vector2i(520, 170))


func _save_world(announce := true) -> bool:
	if save_pending:
		if announce:
			_show_toast("Saving… keep this tab open until confirmation.", Color("#ffe7a3"), 4.0)
		return false
	if not started:
		return false
	if OS.has_feature("web") and not OS.is_userfs_persistent():
		save_status.text = "Saving unavailable in this browser"
		if announce:
			_show_toast("Browser storage is unavailable. This world cannot be saved here.", Color("#ffbd91"), 5.0)
		return false
	var snapshot := WorldSave.capture(self)
	if not WorldSave.write(snapshot, save_path):
		save_status.text = "Save failed · retry Save"
		if announce:
			_show_toast("World could not be saved. Your previous checkpoint is preserved.", Color("#ffbd91"), 5.0)
		return false
	if OS.has_feature("web"):
		pending_save = snapshot
		pending_announce = announce
		save_pending = true
		save_wait = 0.0
		save_status.text = "Saving… keep this tab open"
		if announce:
			_show_toast("Saving… waiting for browser storage", Color("#ffe7a3"), 4.0)
		BrowserSaveSync.begin()
	else:
		_finish_save(snapshot, announce)
	return true


func _finish_save(snapshot: Dictionary, announce: bool) -> void:
	saved_checkpoint = snapshot
	save_status.text = "Saved · " + str(snapshot.saved_at).split("T")[-1]
	if announce:
		_show_toast("World saved in this browser. Resume it when you return.", Color("#aef8e3"), 4.0)


func _poll_browser_save(delta: float) -> void:
	if not save_pending:
		return
	save_wait += delta
	var status := BrowserSaveSync.status()
	if status == 0 and save_wait < 20.0:
		return
	save_pending = false
	if status == 1:
		_finish_save(pending_save, pending_announce)
	else:
		save_status.text = "Save unconfirmed · retry"
		_show_toast("Browser save could not be confirmed. Keep this tab open and retry Save.", Color("#ffbd91"), 6.0)
	pending_save = {}


func _resume_saved_world() -> void:
	if not WorldSave.restore(self, saved_checkpoint):
		resume_detail.text = "This save could not be restored. Your current world has not changed."
		return
	observed_era = str(sim.era_data().era)
	started = true
	running = false
	intro_overlay.visible = false
	paint_down = false
	panning = false
	follow_target = {}
	sim_accumulator = 0.0
	autosave_elapsed = 0.0
	renderer.terrain_texture = null
	play_button.text = "Play"
	speed_button.text = _speed_text()
	motion_button.text = "Reduced Motion: On" if reduced_motion else "Reduced Motion: Off"
	_select_tool(sim.selected_tool)
	_refresh_camera()
	current_crisis = _detect_crisis(sim.stats())
	_update_ui()
	save_status.text = "Checkpoint recovered" if save_recovered else "Saved world restored"
	_show_toast("World restored and paused · press Play when you are ready", Color("#aef8e3"), 5.0)
