extends SceneTree
const Save = preload("res://scripts/persistence/world_save.gd")
func _initialize() -> void: call_deferred("_run")
func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	# A controlled mature biosphere tests transitions, not organic difficulty.
	game.sim.new_world("campaign-soak-20260922")
	for cell in game.sim.cells:
		if cell.type not in ["volcanic", "basalt"]: cell.microbes = 0.9
	for i in range(24): game.sim.spawn("amoeboid", Vector2(380 + i, 250))
	for i in range(12): game.sim.spawn("grazer", Vector2(400 + i, 270))
	for i in range(4): game.sim.spawn("predator", Vector2(420 + i, 290))
	game.sim.tool_uses.assign([3, 3, 2, 3, 0, 0, 0, 0])
	game.sim.oxygen = 0.04
	game.sim.organisms[0].generation = 4
	for stage in range(5):
		game.running = true
		game._check_mission()
		assert(game.mission_stage == stage + 1, "Mission transition failed")
		assert(not game.running, "Mission did not pause for briefing")
	assert(game.inspector_victory and game.inspector_overlay.visible)
	game._close_inspector()
	assert(game.running and not game.inspector_victory, "Endless continuation failed")
	var started_at := Time.get_ticks_usec()
	var max_population := 0
	for i in range(6000):
		game.sim.step(0.05)
		max_population = maxi(max_population, game.sim.organisms.size())
		assert(game.sim.organisms.size() <= game.sim.MAX_ORGANISMS)
		if i % 300 == 0:
			for organism in game.sim.organisms:
				assert(is_finite(organism.energy) and organism.pos.is_finite())
			await process_frame
	var elapsed := float(Time.get_ticks_usec() - started_at) / 1000000.0
	assert(game.sim.history.size() <= game.sim.HISTORY_MAX)
	assert(Save.validate(Save.capture(game)), "Mature endless checkpoint invalid")
	print("CAMPAIGN_SOAK_PASS: five fixture transitions, endless continuation, 6000 steps, peak population %d, %.2fs headless wall time" % [max_population, elapsed])
	quit()
