extends SceneTree

const Settings = preload("res://scripts/ui/ocean_settings.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	var state: int = game.sim.rng.state
	game.settings.open()
	assert(not game.running, "Settings did not pause")
	game.settings._restore()
	game.settings.hide()
	assert(game.running, "Settings lost running state")
	game.running = false
	game.settings.open()
	game.settings._restore()
	game.settings.hide()
	assert(not game.running, "Settings unpaused world")
	game.journal.set_reading_scale(1.4)
	assert(game.journal.details.get_theme_font_size("normal_font_size") == 24)
	assert(game.journal.details.scroll_active and game.journal.event_list.scroll_active)
	assert(game.sim.rng.state == state, "Presentation consumed biology RNG")
	assert(not game.settings.effects_enabled and not game.settings.ambience_enabled)
	for stream in [Settings._wave_stream(), Settings._chime_stream()]:
		assert(stream.mix_rate == 22050 and stream.data.size() > 20000)
		assert(abs(stream.data.decode_s16(0)) < 100)
		assert(abs(stream.data.decode_s16(stream.data.size() - 2)) < 100)
		var peak := 0
		for i in range(0, stream.data.size(), 2):
			peak = maxi(peak, abs(stream.data.decode_s16(i)))
		assert(peak > 100 and peak < 16000, "Silent or clipping audio")
	print("SETTINGS_REGRESSION_PASS")
	quit()
