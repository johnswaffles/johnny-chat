extends Control

var game: Node
var shade: ColorRect
var card: PanelContainer
var rows: VBoxContainer
var scroll: ScrollContainer
var was_running := false
var event_preview := false

func setup(owner_game: Node) -> void:
	game = owner_game
	mouse_filter = Control.MOUSE_FILTER_STOP
	shade = ColorRect.new()
	shade.color = Color(0.002, 0.01, 0.02, 0.92)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(shade)
	card = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color("#0c2029")
	style.set_content_margin_all(16)
	style.set_corner_radius_all(16)
	card.add_theme_stylebox_override("panel", style)
	add_child(card)
	scroll = ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	card.add_child(scroll)
	rows = VBoxContainer.new()
	rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rows.add_theme_constant_override("separation", 12)
	scroll.add_child(rows)
	hide()

func layout() -> void:
	var extent: Vector2 = game.get_viewport_rect().size
	var screen_scale: float = maxf(0.2, game.get_viewport().get_screen_transform().get_scale().x)
	size = extent
	shade.size = extent
	card.size = Vector2(minf(560, extent.x * screen_scale - 24), minf(740, extent.y * screen_scale - 24)) / screen_scale
	card.position = (extent - card.size) * 0.5
	var style: StyleBoxFlat = card.get_theme_stylebox("panel")
	style.set_content_margin_all(16.0 / screen_scale)
	style.set_corner_radius_all(roundi(16.0 / screen_scale))
	rows.add_theme_constant_override("separation", roundi(12.0 / screen_scale))
	for child in rows.get_children():
		if child is RichTextLabel:
			child.add_theme_font_size_override("normal_font_size", roundi(16.0 / screen_scale))
			child.add_theme_font_size_override("bold_font_size", roundi(17.0 / screen_scale))
		elif child is Button:
			child.custom_minimum_size.y = 48.0 / screen_scale
			child.add_theme_font_size_override("font_size", roundi(15.0 / screen_scale))

func open() -> void:
	if visible: return
	was_running = game.running
	game.running = false
	game.paint_down = false
	game.touch.reset()
	for child in rows.get_children():
		rows.remove_child(child)
		child.queue_free()
	if not game.started:
		_text("[b]Bring a little world to life.[/b]\n\nSeed three patches of Cyano Mats in the shallows. Add drifters, grazers and hunters as missions unlock.\n\nTap to place or inspect. Drag to pan. Pinch to zoom. Open Life lab for readable tools and mission details.")
		if not game.saved_checkpoint.is_empty():
			_button("Resume saved world", func():
				game._resume_saved_world()
				hide()
			)
		_button("Start new world", func():
			game._start_new_from_intro()
			if game.started: hide()
		)
	else:
		_button("Return to ocean", close)
		_text("[b]CURRENT MISSION[/b]\n" + game.mission_label.text + "\n\n[b]PLANET HEALTH[/b]\n" + game.stats_label.text)
		_button("Pause ocean" if was_running else "Resume ocean", func():
			was_running = not was_running
			close()
		)
		_text("[b]LIFE LAB[/b]\nChoose a tool, then tap the ocean once to apply it.")
		for i in range(game.TOOL_SHORT_NAMES.size()):
			var index: int = i
			var button := _button("%s · %d Catalyst" % [game.TOOL_SHORT_NAMES[i], game.sim.TOOL_COSTS[i]], func():
				game._select_tool(index)
				close()
			)
			button.disabled = game.TOOL_UNLOCK_STAGE[i] > game.mission_stage
		_button("Inspect life", func():
			game.inspect_button.button_pressed = true
			game._toggle_inspect_mode()
			close()
		)
		_text("[b]WORLD EVENTS[/b]\nEach event opens a cost and recovery preview.")
		for label in game.sim.DISASTERS:
			var event_name: String = label
			_button(event_name, func():
				close()
				game._trigger_event(event_name)
			)
		_button("Save world", func(): game._save_world(true))
	layout()
	scroll.scroll_vertical = 0
	show()

func close() -> void:
	if event_preview:
		event_preview = false
		game._cancel_event()
	hide()
	game.running = was_running
	game.play_button.text = "Pause" if game.running else "Play"

func _text(value: String) -> void:
	var label := RichTextLabel.new()
	label.bbcode_enabled = true
	label.fit_content = true
	label.scroll_active = false
	label.add_theme_font_size_override("normal_font_size", 16)
	label.add_theme_font_size_override("bold_font_size", 17)
	label.text = value
	rows.add_child(label)

func _button(caption: String, action: Callable) -> Button:
	var button := Button.new()
	button.text = caption
	button.custom_minimum_size.y = 48
	game.glass.style_button(button)
	button.pressed.connect(action)
	rows.add_child(button)
	return button


func compact() -> bool:
	if DisplayServer.get_name() == "headless": return false
	return game.get_viewport_rect().size.x * game.get_viewport().get_screen_transform().get_scale().x < 600

func _begin_page() -> void:
	if not visible:
		was_running = game.running
	game.running = false
	game.paint_down = false
	game.touch.reset()
	for child in rows.get_children():
		rows.remove_child(child)
		child.queue_free()
	scroll.scroll_vertical = 0
	show()

func open_event() -> void:
	_begin_page()
	was_running = game.event_was_running
	event_preview = true
	var label: String = game.pending_event
	var index: int = game.sim.DISASTERS.find(label)
	_text("[b]%s · %d Catalyst[/b]\n\n%s\n\n[b]RECOVERY PLAN[/b]\n%s" % [label, game.sim.DISASTER_COSTS[index], game.EVENT_BRIEFINGS[label][0], game.EVENT_BRIEFINGS[label][1]])
	_button("Keep observing", close)
	_button("Apply event", func():
		event_preview = false
		hide()
		game._confirm_event()
	)
	layout()

func open_journal(history := false) -> void:
	_begin_page()
	_button("Return to ocean", close)
	_text("[b]OCEAN JOURNAL[/b]\nPaused while you read.")
	if history:
		_text("[b]POPULATION HISTORY[/b]\nMats count occupied cells. Other counts are individual animals.")
		var samples: Array[Dictionary] = game.sim.history
		for i in range(maxi(0, samples.size() - 12), samples.size()):
			var sample: Dictionary = samples[i]
			_text("Day %d · tick %d\nMats %d · Drifters %d\nGrazers %d · Hunters %d" % [sample.day, game.graph_renderer.sample_tick(samples, i, game.sim.tick), sample.microbes, sample.amoeboids, sample.grazers, sample.predators])
		_text("[b]WORLD CHRONICLE[/b]")
		for i in range(game.sim.events.size() - 1, maxi(-1, game.sim.events.size() - 31), -1):
			var entry: Dictionary = game.sim.events[i]
			_text("Day %d · %s" % [entry.day, entry.type])
		_button("Species guide", func(): open_journal(false))
	else:
		var stats: Dictionary = game.sim.stats()
		game.SpeciesGuide.observe(game.sim, game.journal_seen, stats)
		for kind in game.SpeciesGuide.KINDS:
			var profile: Dictionary = game.SpeciesGuide.PROFILES[kind]
			var record := "Not observed in this world"
			if game.journal_seen.has(kind): record = "First recorded on day %d" % game.journal_seen[kind].day
			_text("[b]%s[/b] · %d\n%s\n\n%s\n\n[b]Consumes[/b] %s\n[b]Supports[/b] %s\n\n[b]Care[/b] %s" % [profile.name, stats[profile.stat], record, profile.story, profile.food, profile.feeds, profile.care])
		_button("Population history", func(): open_journal(true))
	_button("Return to ocean", close)
	layout()

func open_settings() -> void:
	_begin_page()
	_button("Return to ocean", close)
	_text("[b]OCEAN SETTINGS[/b]\nPreferences apply to this session.")
	var settings = game.settings
	for entry in [["Music", game.music_enabled, settings.music], ["Ocean ambience", settings.ambience_enabled, settings.ambience_toggle], ["Event sounds", settings.effects_enabled, settings.effects_toggle], ["Reduced motion", game.reduced_motion, settings.motion], ["Clear water", settings.clear_water, settings.clear_toggle]]:
		var toggle: CheckButton = entry[2]
		var enabled: bool = entry[1]
		_button(str(entry[0]) + (" · On" if enabled else " · Off"), func():
			toggle.set_pressed_no_signal(not enabled)
			toggle.toggled.emit(not enabled)
			open_settings()
		)
	for entry in [["Music", game.music_player], ["Ambience", settings.ambience], ["Events", settings.effects]]:
		var player: AudioStreamPlayer = entry[1]
		_button("%s volume · %d%%" % [entry[0], roundi(player.volume_linear * 100)], func():
			player.volume_linear = 0.0 if player.volume_linear >= 0.99 else minf(1.0, (floorf(player.volume_linear * 4) + 1.0) / 4.0)
			open_settings()
		)
	_text("Tap a volume to cycle through 0, 25, 50, 75 and 100%. Zero mutes that channel.")
	_button("Return to ocean", close)
	layout()
