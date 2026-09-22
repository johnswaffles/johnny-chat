extends Control

const Guide = preload("res://scripts/ui/species_guide.gd")
const Plot = preload("res://scripts/graphs/population_graph.gd")
var game: Node
var shade: ColorRect
var card: Panel
var life_page: Control
var history_page: Control
var details: RichTextLabel
var observations: RichTextLabel
var chart: Control
var readout: RichTextLabel
var event_list: RichTextLabel
var scale_caption: Label
var species_labels: Dictionary = {}
var species_buttons: Dictionary = {}
var selected_kind := "microbes"
var relative := false
var enabled: Array = Plot.KEYS.duplicate()
var hover_index := -1
var was_running := false
var plot := Plot.new()

func setup(owner_game: Node) -> void:
	game = owner_game
	mouse_filter = Control.MOUSE_FILTER_STOP
	shade = ColorRect.new()
	shade.color = Color(0.002, 0.01, 0.02, 0.8)
	add_child(shade)
	card = Panel.new()
	card.size = Vector2(1100, 670)
	game.glass.style_panel(card, Color("#071e29"), Color("#377e7b"))
	add_child(card)
	_label(card, "OCEAN JOURNAL", Vector2(28, 20), 28, Color("#e8fff3"))
	_label(card, "Meet the food web. Read the story of your world.", Vector2(30, 62), 16, Color("#9ccac9"))
	_button(card, "Return to ocean", Vector2(874, 26), Vector2(196, 42), close)
	_button(card, "Life & food web", Vector2(28, 98), Vector2(200, 36), func(): show_page(false))
	_button(card, "Population history", Vector2(238, 98), Vector2(200, 36), func(): show_page(true))
	_label(card, "Paused while you explore · Esc to return", Vector2(694, 107), 14, Color("#9ccac9"))
	life_page = Control.new()
	life_page.position = Vector2(28, 150)
	card.add_child(life_page)
	for i in range(Guide.KINDS.size()):
		var kind: String = Guide.KINDS[i]
		var profile: Dictionary = Guide.PROFILES[kind]
		var tile := _button(life_page, "", Vector2(i * 210, 0), Vector2(204, 142), _select.bind(kind))
		tile.toggle_mode = true
		species_buttons[kind] = tile
		var icon := Control.new()
		icon.position = Vector2(101, 43)
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		icon.draw.connect(_draw_icon.bind(icon, kind))
		tile.add_child(icon)
		_label(tile, profile.name, Vector2(10, 84), 16, Color(profile.color))
		var count := _label(tile, "", Vector2(10, 110), 13, Color("#b0cecb"))
		species_labels[kind] = count
	_label(life_page, "Mats feed drifters + grazers. Hunters eat both. Decay returns nutrients to the foundation.", Vector2(4, 159), 16, Color("#b9e4d7"))
	details = _rich(life_page, Vector2(4, 204), Vector2(658, 288), 17)
	observations = _rich(life_page, Vector2(712, 204), Vector2(332, 288), 16)
	history_page = Control.new()
	history_page.position = Vector2(28, 150)
	card.add_child(history_page)
	var names := ["Mats", "Drifters", "Grazers", "Hunters"]
	for i in range(Plot.KEYS.size()):
		var toggle := _button(history_page, names[i], Vector2(i * 104, 0), Vector2(98, 34), func(): pass)
		toggle.toggle_mode = true
		toggle.button_pressed = true
		toggle.add_theme_color_override("font_color", Plot.COLORS[i])
		toggle.toggled.connect(_toggle_series.bind(Plot.KEYS[i]))
	var scaling := _button(history_page, "Relative scale", Vector2(452, 0), Vector2(196, 34), func(): pass)
	scaling.toggle_mode = true
	scaling.toggled.connect(func(value: bool):
		relative = value
		_update_scale_caption()
		chart.queue_redraw()
	)
	scale_caption = _label(history_page, "", Vector2(4, 44), 14, Color("#a2c8c7"))
	chart = Control.new()
	chart.position = Vector2(0, 76)
	chart.size = Vector2(700, 300)
	chart.mouse_filter = Control.MOUSE_FILTER_STOP
	chart.draw.connect(func(): plot.draw_graph(chart, game.sim.history, game.sim.events, game.sim.tick, true, relative, enabled, hover_index))
	chart.gui_input.connect(_chart_input)
	chart.mouse_exited.connect(func():
		hover_index = -1
		_update_readout()
		chart.queue_redraw()
	)
	history_page.add_child(chart)
	readout = _rich(history_page, Vector2(4, 390), Vector2(696, 96), 16)
	_label(history_page, "WORLD CHRONICLE", Vector2(732, 4), 18, Color("#edd28d"))
	event_list = _rich(history_page, Vector2(732, 44), Vector2(312, 438), 15)
	_update_scale_caption()
	visible = false

func layout(extent: Vector2) -> void:
	size = extent
	shade.size = extent
	card.position = (extent - card.size) * 0.5

func open(history := false) -> void:
	if game.life_lab.compact():
		game.life_lab.open_journal(history)
		return
	if visible or not game.started:
		return
	was_running = game.running
	game.running = false
	game.play_button.text = "Play"
	game.paint_down = false
	game.panning = false
	game.help_open = false
	game.pulse_open = false
	game.help_panel.visible = false
	game.pulse_panel.visible = false
	game.placement_panel.visible = false
	Guide.observe(game.sim, game.journal_seen)
	visible = true
	layout(game.get_viewport_rect().size)
	show_page(history)

func close() -> void:
	if not visible:
		return
	visible = false
	game.running = was_running
	game.play_button.text = "Pause" if was_running else "Play"

func show_page(history: bool) -> void:
	life_page.visible = not history
	history_page.visible = history
	_refresh()

func _refresh() -> void:
	var stats: Dictionary = game.sim.stats()
	for kind in Guide.KINDS:
		var count := int(stats[Guide.PROFILES[kind].stat])
		var seen: bool = game.journal_seen.has(kind)
		species_labels[kind].text = "%d %s · %s" % [count, "cells" if kind in ["microbes", "fungus"] else "alive", "observed" if seen else "not yet observed"]
	_select(selected_kind)
	var chronicle := "[color=#9ccac9]Gold marks show events within the chart's time window.[/color]\n\n"
	for i in range(game.sim.events.size() - 1, maxi(-1, game.sim.events.size() - 25), -1):
		var entry: Dictionary = game.sim.events[i]
		chronicle += "[color=#edd28d]Day %d[/color]  %s\n\n" % [entry.day, _event_title(entry)]
	event_list.text = chronicle
	hover_index = -1
	_update_readout()
	chart.queue_redraw()

func _select(kind: String) -> void:
	selected_kind = kind
	for key in species_buttons:
		species_buttons[key].button_pressed = key == kind
	var profile: Dictionary = Guide.PROFILES[kind]
	details.text = "[color=%s][b]%s[/b][/color]\n%s\n\n[b]Consumes[/b]  %s\n[b]Supports[/b]  %s\n\n[color=#8fe5bd][b]CARE NOTE[/b][/color]\n%s" % [profile.color, profile.role, profile.story, profile.food, profile.feeds, profile.care]
	var record: Dictionary = game.journal_seen.get(kind, {})
	var note := "Not observed in this world yet. The guide explains its ecological role."
	if not record.is_empty():
		note = "First recorded on day %d." % record.day
		if record.lineage != "":
			note += "\nFirst recorded lineage: %s\nGeneration %d" % [record.lineage, record.generation]
	var discovery_text := "No evolutionary discoveries yet. Let healthy populations reproduce."
	if not game.discoveries.is_empty():
		discovery_text = "\n".join(game.discoveries)
	observations.text = "[color=#edd28d][b]FIELD RECORD[/b][/color]\n%s\n\n[color=#edd28d][b]EVOLUTIONARY DISCOVERIES[/b][/color]\n%s" % [note, discovery_text]

func _draw_icon(icon: Control, kind: String) -> void:
	icon.draw_circle(Vector2.ZERO, 31, Color(0.04, 0.18, 0.22, 0.95))
	icon.draw_set_transform(Vector2.ZERO, 0, Vector2(2.0, 2.0))
	var sample := {"size": 0.9, "armor": 0.6, "aggression": 0.8, "generation": 1, "microbes": 0.8, "fungus": 0.8, "sediment": 0.5}
	match kind:
		"microbes": game.renderer.draw_microbe_mat(icon, Vector2(-7, -7), sample, 0, false)
		"fungus": game.renderer.draw_fungal_bloom(icon, Vector2(-7, -7), sample)
		"amoeboid": game.renderer.draw_amoeboid(icon, Vector2.ZERO, sample, 0, true)
		"grazer": game.renderer.draw_grazer(icon, Vector2.ZERO, sample, Vector2.RIGHT)
		"predator": game.renderer.draw_predator(icon, Vector2.ZERO, sample, Vector2.RIGHT)
	icon.draw_set_transform(Vector2.ZERO)

func _toggle_series(on: bool, key: String) -> void:
	if on and not key in enabled:
		enabled.append(key)
	elif not on:
		enabled.erase(key)
	chart.queue_redraw()

func _update_scale_caption() -> void:
	scale_caption.text = "Relative: each line uses its own peak. Compare trends, not abundance." if relative else "Shared count scale · mats count occupied cells; animals count individuals."

func _chart_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion or (event is InputEventMouseButton and event.pressed) or event is InputEventScreenTouch:
		hover_index = plot.index_at(event.position, chart.size, game.sim.history.size())
		_update_readout()
		chart.queue_redraw()

func _update_readout() -> void:
	if hover_index < 0:
		readout.text = "[color=#a2c8c7]Hover or tap the chart to read exact counts. Gold marks locate interventions and milestones; nearby events are context, not proof of a single cause.[/color]"
		return
	var item: Dictionary = game.sim.history[hover_index]
	var tick := plot.sample_tick(game.sim.history, hover_index, game.sim.tick)
	readout.text = "[b]Day %.2f[/b]  Mats %d cells · Drifters %d · Grazers %d · Hunters %d" % [1.0 + tick / 180.0, item.microbes, item.amoeboids, item.grazers, item.predators]
	var nearby := 0
	for entry in game.sim.events:
		if abs(int(entry.get("tick", (entry.day - 1) * 180)) - tick) <= 30:
			readout.text += "\n[color=#edd28d]%s[/color]" % _event_title(entry)
			nearby += 1
			if nearby == 2:
				break

func _label(parent: Control, text: String, pos: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(label)
	return label

func _rich(parent: Control, pos: Vector2, extent: Vector2, font_size: int) -> RichTextLabel:
	var label := RichTextLabel.new()
	label.position = pos
	label.size = extent
	label.bbcode_enabled = true
	label.add_theme_font_size_override("normal_font_size", font_size)
	label.add_theme_font_size_override("bold_font_size", font_size)
	parent.add_child(label)
	return label

func _button(parent: Control, text: String, pos: Vector2, extent: Vector2, action: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.position = pos
	button.size = extent
	button.focus_mode = Control.FOCUS_NONE
	game.glass.style_button(button)
	button.pressed.connect(action)
	parent.add_child(button)
	return button

func _event_title(entry: Dictionary) -> String:
	var title := str(entry.type).trim_prefix("Tool: ")
	return title.split(" — ")[0] if title.begins_with("Crisis:") else title


func set_reading_scale(value: float) -> void:
	var scale_value := clampf(value, 1.0, 1.4)
	for entry in [[details, 17], [observations, 16], [event_list, 15], [readout, 16]]:
		var label: RichTextLabel = entry[0]
		var font_size := roundi(float(entry[1]) * scale_value)
		label.add_theme_font_size_override("normal_font_size", font_size)
		label.add_theme_font_size_override("bold_font_size", font_size)
		label.scroll_active = true
