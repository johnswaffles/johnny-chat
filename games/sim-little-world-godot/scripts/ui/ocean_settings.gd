extends AcceptDialog

var game: Node
var was_running := false
var ambience: AudioStreamPlayer
var effects: AudioStreamPlayer
var motion: CheckButton
var music: CheckButton
var ambience_toggle: CheckButton
var effects_toggle: CheckButton
var clear_toggle: CheckButton
var ambience_enabled := false
var effects_enabled := false
var text_scale := 1.0
var clear_water := false

func setup(owner_game: Node) -> void:
	game = owner_game
	title = "Ocean settings"
	ok_button_text = "Return to ocean"
	get_ok_button().custom_minimum_size.y = 48
	game.glass.style_button(get_ok_button())
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color("#0c2029")
	panel.set_content_margin_all(20)
	var skin := Theme.new()
	skin.set_stylebox("panel", "AcceptDialog", panel)
	var border: StyleBoxFlat = panel.duplicate()
	border.border_color = Color("#529b9d")
	border.set_border_width_all(1)
	border.expand_margin_top = 32
	skin.set_stylebox("embedded_border", "Window", border)
	theme = skin
	var rows := VBoxContainer.new()
	rows.custom_minimum_size = Vector2(570, 430)
	rows.add_theme_constant_override("separation", 10)
	add_child(rows)
	music = _check(rows, "Music", func(on: bool):
		if game.music_enabled != on:
			game._toggle_music()
	)
	_slider(rows, "Music volume", 0.18, func(value: float): game.music_player.volume_linear = value)
	ambience = AudioStreamPlayer.new()
	ambience.stream = _wave_stream()
	ambience.volume_linear = 0.3
	game.add_child(ambience)
	effects = AudioStreamPlayer.new()
	effects.stream = _chime_stream()
	effects.volume_linear = 0.35
	game.add_child(effects)
	ambience_toggle = _check(rows, "Ocean ambience", func(on: bool):
		ambience_enabled = on
		if on: ambience.play()
		else: ambience.stop()
	)
	_slider(rows, "Ambience volume", 0.3, func(value: float): ambience.volume_linear = value)
	effects_toggle = _check(rows, "Event and milestone sounds", func(on: bool):
		effects_enabled = on
		if on: cue()
	)
	_slider(rows, "Event volume", 0.35, func(value: float): effects.volume_linear = value)
	motion = _check(rows, "Reduced motion", func(on: bool):
		if game.reduced_motion != on: game._toggle_motion()
	)
	clear_toggle = _check(rows, "Clear water · hide decorative light", func(on: bool):
		clear_water = on
		game.haze.visible = not on
	)
	var scale_row := HBoxContainer.new()
	rows.add_child(scale_row)
	var label := Label.new()
	label.text = "Journal reading size"
	label.custom_minimum_size.x = 280
	label.add_theme_font_size_override("font_size", 20)
	scale_row.add_child(label)
	var sizes := OptionButton.new()
	for caption in ["100%", "120%", "140%"]: sizes.add_item(caption)
	sizes.custom_minimum_size = Vector2(190, 44)
	sizes.item_selected.connect(func(index: int):
		text_scale = [1.0, 1.2, 1.4][index]
		game.journal.set_reading_scale(text_scale)
	)
	scale_row.add_child(sizes)
	var note := Label.new()
	note.text = "Sound and reading preferences apply to this session.\nThe ocean pauses while settings are open."
	note.add_theme_font_size_override("font_size", 16)
	rows.add_child(note)
	confirmed.connect(_restore)
	canceled.connect(_restore)

func open() -> void:
	if game.life_lab.compact():
		game.life_lab.open_settings()
		return
	was_running = game.running
	game.running = false
	game.paint_down = false
	game.panning = false
	music.set_pressed_no_signal(game.music_enabled)
	music.text = "Music · " + ("On" if game.music_enabled else "Off")
	motion.set_pressed_no_signal(game.reduced_motion)
	motion.text = "Reduced motion · " + ("On" if game.reduced_motion else "Off")
	for slider in find_children("*", "HSlider", true, false):
		var caption: String = slider.get_parent().get_child(0).text
		var player: AudioStreamPlayer = game.music_player if caption == "Music volume" else (ambience if caption == "Ambience volume" else effects)
		slider.set_value_no_signal(player.volume_linear)
	popup_centered(Vector2i(620, 660))

func _restore() -> void:
	game.running = was_running
	game.play_button.text = "Pause" if game.running else "Play"

func cue() -> void:
	if effects_enabled: effects.play()

func _check(parent: Node, caption: String, callback: Callable) -> CheckButton:
	var button := CheckButton.new()
	button.text = caption + " · Off"
	button.custom_minimum_size.y = 44
	button.add_theme_font_size_override("font_size", 20)
	button.toggled.connect(func(on: bool):
		button.text = caption + (" · On" if on else " · Off")
		callback.call(on)
	)
	parent.add_child(button)
	return button

func _slider(parent: Node, caption: String, value: float, callback: Callable) -> void:
	var row := HBoxContainer.new()
	parent.add_child(row)
	var label := Label.new()
	label.text = caption
	label.custom_minimum_size.x = 280
	label.add_theme_font_size_override("font_size", 18)
	row.add_child(label)
	var slider := HSlider.new()
	slider.min_value = 0.0
	slider.max_value = 1.0
	slider.step = 0.05
	slider.value = value
	slider.custom_minimum_size = Vector2(240, 36)
	slider.tooltip_text = caption + " · arrow keys adjust · zero mutes"
	slider.value_changed.connect(callback)
	row.add_child(slider)

static func _wave_stream() -> AudioStreamWAV:
	# Seeded locally: decorative sound must never consume the biology RNG.
	var rng := RandomNumberGenerator.new()
	rng.seed = 7051
	var rate := 22050
	var count := rate * 8
	var pcm := PackedByteArray()
	pcm.resize(count * 2)
	var low := 0.0
	for i in range(count):
		var phase := float(i) / float(count)
		low = low * 0.96 + rng.randf_range(-1.0, 1.0) * 0.04
		# Silence at both ends makes the eight-second loop seam click-free.
		var swell := pow(sin(PI * phase), 2.0)
		pcm.encode_s16(i * 2, int(low * swell * 17000.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.data = pcm
	stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
	stream.loop_end = count
	return stream

static func _chime_stream() -> AudioStreamWAV:
	var rate := 22050
	var count := int(rate * 0.65)
	var pcm := PackedByteArray()
	pcm.resize(count * 2)
	for i in range(count):
		var t := float(i) / rate
		var envelope := minf(t * 50.0, 1.0) * pow(1.0 - float(i) / count, 3.0)
		var tone := sin(TAU * 440.0 * t) * 0.65 + sin(TAU * 660.0 * t) * 0.35
		pcm.encode_s16(i * 2, int(tone * envelope * 9500.0))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.data = pcm
	return stream
