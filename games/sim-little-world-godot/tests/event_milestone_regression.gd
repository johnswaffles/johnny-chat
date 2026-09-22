extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	for label in game.sim.DISASTERS:
		game.sim.catalyst = 100.0
		var before: float = game.sim.catalyst
		var state: int = game.sim.rng.state
		game.running = true
		game._trigger_event(label)
		assert(not game.running and game.pending_event == label)
		assert(game.sim.catalyst == before and game.sim.rng.state == state, "Preview mutated world")
		assert(game.event_dialog.dialog_text.contains("RECOVERY PLAN"))
		game._cancel_event()
		game.event_dialog.hide()
		assert(game.running and game.sim.catalyst == before, "Cancel changed cost or pause state")
	game.running = false
	game._trigger_event("Monsoon")
	game._confirm_event()
	game.event_dialog.hide()
	assert(not game.running and game.sim.catalyst == 88.0, "Confirm did not preserve paused state or cost")
	assert(game.sim.events[-1].type.begins_with("Recovery:"), "Aftercare missing from chronicle")
	game._confirm_event()
	assert(game.sim.catalyst == 88.0, "Duplicate confirmation charged twice")
	game.sim.catalyst = 0.0
	game._trigger_event("Impact Event")
	assert(game.pending_event.is_empty(), "Unaffordable event opened")
	var count: int = game.sim.events.size()
	game._check_era_milestone()
	assert(game.sim.events.size() == count, "Initial era incorrectly announced")
	game.sim.tick = 12000
	game._check_era_milestone()
	assert(game.sim.events[-1].type.contains("Archean Ocean"), "Era crossing missing")
	count = game.sim.events.size()
	game._check_era_milestone()
	assert(game.sim.events.size() == count, "Era announced twice")
	game._reset_world(false)
	count = game.sim.events.size()
	game._check_era_milestone()
	assert(game.sim.events.size() == count, "Reset announced stale era")
	print("EVENT_MILESTONE_REGRESSION_PASS")
	quit()
