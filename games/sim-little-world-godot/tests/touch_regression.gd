extends SceneTree

func _initialize() -> void: call_deferred("_run")

func _tap(index: int, pos: Vector2, pressed: bool) -> InputEventScreenTouch:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = pos
	event.pressed = pressed
	return event

func _drag(index: int, pos: Vector2) -> InputEventScreenDrag:
	var event := InputEventScreenDrag.new()
	event.index = index
	event.position = pos
	return event

func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	var point: Vector2 = game.camera.frame.get_center()
	for y in range(8, 32):
		for x in range(12, 54):
			var world: Vector2 = game.sim.WORLD_OFFSET + Vector2(x * 14 + 7, y * 14 + 7)
			var preview: Dictionary = game.sim.preview_at_screen(world)
			if preview.get("valid", false):
				point = game.camera.to_screen(world)
				break
	game.sim.catalyst = 100.0
	game.touch.handle(game, _tap(0, point, true))
	assert(game.sim.catalyst == 100.0, "Finger-down painted before gesture was known")
	game.touch.handle(game, _tap(0, point, false))
	assert(game.sim.catalyst == 98.0, "Tap failed or charged twice")
	var mouse := InputEventMouseButton.new()
	mouse.device = InputEvent.DEVICE_ID_EMULATION
	mouse.button_index = MOUSE_BUTTON_LEFT
	mouse.pressed = true
	mouse.position = point
	game._unhandled_input(mouse)
	assert(game.sim.catalyst == 98.0, "Emulated mouse duplicated tap")
	game._zoom_camera(2.0)
	var before: Vector2 = game.camera.center
	game.touch.handle(game, _tap(0, point, true))
	game.touch.handle(game, _drag(0, point + Vector2(80, 0)))
	game.touch.handle(game, _tap(0, point + Vector2(80, 0), false))
	assert(game.camera.center != before and game.sim.catalyst == 98.0, "Drag painted or did not pan")
	game.touch.handle(game, _tap(0, point - Vector2(50, 0), true))
	game.touch.handle(game, _tap(1, point + Vector2(50, 0), true))
	var zoom: float = game.camera.zoom
	game.touch.handle(game, _drag(1, point + Vector2(100, 0)))
	assert(game.camera.zoom > zoom, "Pinch did not zoom")
	game.touch.handle(game, _tap(1, point + Vector2(100, 0), false))
	game.touch.handle(game, _tap(0, point - Vector2(50, 0), false))
	assert(game.sim.catalyst == 98.0 and game.touch.points.is_empty(), "Pinch ended in placement")
	game.touch.handle(game, _tap(2, Vector2.ZERO, true))
	game.touch.handle(game, _drag(2, point))
	assert(game.touch.points.is_empty(), "UI-origin drag captured ocean")
	print("TOUCH_REGRESSION_PASS")
	quit()
