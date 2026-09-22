extends SceneTree

const Save = preload("res://scripts/persistence/world_save.gd")
const Camera = preload("res://scripts/rendering/ocean_camera.gd")
const TEST_PATH := "/private/tmp/genesis-regression-world.save"

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var camera := Camera.new()
	for frame in [Rect2(246, 140, 924, 560), Rect2(246, 140, 924, 1038), Rect2(16, 140, 1888, 560)]:
		camera.frame = frame
		camera.fit()
		var anchor: Vector2 = frame.get_center() + Vector2(70, -50)
		var before := camera.to_world(anchor)
		camera.set_zoom(2.5, anchor)
		assert(camera.to_world(anchor).distance_to(before) < 0.001, "Zoom must stay anchored to cursor")
		for logical in [Vector2(450, 260), Vector2(710, 420), Vector2(980, 570)]:
			assert(camera.to_world(camera.to_screen(logical)).distance_to(logical) < 0.001, "Zoomed pointer drift")
		camera.pan(Vector2(100000, -100000))
		assert(Camera.BOUNDS.grow(0.001).encloses(Rect2(camera.center - Camera.BOUNDS.size / (2 * camera.zoom), Camera.BOUNDS.size / camera.zoom)), "Pan escaped world bounds")
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game.save_path = TEST_PATH
	game._start_game()
	game.sim.new_world("camera-save-regression")
	game.mission_stage = 2
	game.score = 720
	game.discoveries.assign(["First breath"])
	game.achievements = {"Caretaker": true}
	game.camera.set_zoom(2.0, game.camera.frame.get_center())
	for step in range(40):
		game.sim.step(0.05)
	var snapshot := Save.capture(game)
	assert(Save.validate(snapshot), "Valid checkpoint rejected")
	assert(Save.write(snapshot, TEST_PATH), "Checkpoint write failed")
	var saved := Save.read(TEST_PATH)
	assert(saved.data == snapshot, "Disk round trip changed state")
	var restored = load("res://scenes/main.tscn").instantiate()
	assert(Save.restore(restored, saved.data), "Restore rejected valid checkpoint")
	assert(restored.score == 720 and restored.discoveries == game.discoveries and restored.achievements == game.achievements, "Mission progress lost")
	assert(restored.camera.zoom == 2.0, "Camera not restored")
	for step in range(40):
		game.sim.step(0.05)
		restored.sim.step(0.05)
	assert(Save.capture(game).simulation == Save.capture(restored).simulation, "Restored simulation diverged, including RNG")
	var invalid := snapshot.duplicate(true)
	invalid.simulation.cells.pop_back()
	var live_before := Save.capture(game)
	assert(not Save.restore(game, invalid), "Malformed save accepted")
	assert(Save.capture(game).simulation == live_before.simulation, "Rejected restore mutated world")
	invalid = snapshot.duplicate(true)
	invalid.simulation.organisms[0].erase("energy")
	assert(not Save.validate(invalid), "Incomplete organism accepted")
	invalid = snapshot.duplicate(true)
	invalid.version = 999
	assert(not Save.validate(invalid), "Unknown schema accepted")
	assert(Save.write(Save.capture(game), TEST_PATH), "Second checkpoint failed")
	var broken := FileAccess.open(TEST_PATH, FileAccess.WRITE)
	broken.store_string("interrupted save")
	broken.close()
	var recovered := Save.read(TEST_PATH)
	assert(recovered.recovered and recovered.data == snapshot, "Previous checkpoint not recovered")
	assert(not Save.write(snapshot, "/private/tmp/nonexistent-genesis-directory/world.save"), "Unwritable path should fail")
	# Follow the actual creature, not its inspector snapshot.
	game.inspect_target = game.sim.organisms[0]
	game._follow_inspected()
	assert(is_same(game.follow_target, game.inspect_target), "Following copied a creature")
	game.follow_target.dead = true
	game._update_camera(0.1)
	assert(game.follow_target.is_empty(), "Follow did not end on death")
	game.focus_button.button_pressed = true
	game._toggle_focus()
	assert(game.camera.frame.position.x == 16 and not game.tool_buttons[0].visible, "Focus mode did not hide panels")
	game.focus_button.button_pressed = false
	game._toggle_focus()
	assert(game.tool_buttons[0].visible, "Focus mode did not restore panels")
	game._resume_saved_world()
	# Explicit resume is validated independently from file discovery.
	game.saved_checkpoint = snapshot
	game._resume_saved_world()
	assert(game.started and not game.running and game.sim.tick == snapshot.simulation.tick, "Resume must restore and pause")
	for suffix in ["", ".bak", ".tmp"]:
		if FileAccess.file_exists(TEST_PATH + suffix):
			DirAccess.remove_absolute(TEST_PATH + suffix)
	restored.free()
	print("CAMERA_SAVE_CHECKS_PASSED: cursor zoom, resize mapping, bounds, focus controls, follow lifecycle, exact save/restore and RNG continuation, corrupt-save recovery, failure preservation, paused resume")
	quit()
