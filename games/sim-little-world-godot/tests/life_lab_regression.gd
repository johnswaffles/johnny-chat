extends SceneTree
func _initialize() -> void: call_deferred("_run")
func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	game.life_lab.open()
	assert(not game.running and game.life_lab.visible)
	var locked := 0
	for child in game.life_lab.rows.get_children():
		if child is Button and child.disabled: locked += 1
	assert(locked == 4, "Tool unlock restrictions lost")
	game.life_lab.close()
	assert(game.running)
	game.running = false
	game.life_lab.open()
	game.life_lab.close()
	assert(not game.running)
	game.life_lab.open()
	game._reset_world(true)
	assert(not game.life_lab.visible, "New world left stale lab open")
	game.running = true
	game.life_lab.open_journal(false)
	assert(not game.running and game.life_lab.visible)
	game.life_lab.open_journal(true)
	game.life_lab.close()
	assert(game.running, "Journal page change lost running state")
	game.life_lab.open_settings()
	game.life_lab.close()
	assert(game.running, "Mobile settings lost running state")
	game._trigger_event("Monsoon")
	game.event_dialog.hide()
	game.life_lab.open_event()
	game.life_lab.close()
	assert(game.pending_event.is_empty() and game.running, "Mobile cancel lost running state")
	print("LIFE_LAB_REGRESSION_PASS")
	quit()
