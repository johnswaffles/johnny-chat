extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var scene = load("res://scenes/main.tscn").instantiate()
	root.add_child(scene)
	await process_frame
	# World input must round-trip at every supported layout scale.
	for extent in [Vector2(1440, 810), Vector2(1440, 1288), Vector2(1920, 810)]:
		root.content_scale_size = Vector2i(extent)
		root.size = Vector2i(extent)
		await process_frame
		scene._layout_view()
		for logical in [Vector2(246, 140), Vector2(710, 420), Vector2(1160, 690)]:
			var physical: Vector2 = scene.world_origin + logical * scene.world_scale
			assert(scene._world_pointer(physical).distance_to(logical) < 0.01, "World input drift")
		assert(absf(scene.graph.position.y - scene._world_bottom() - 10) < 0.1, "Graph detached from world")
	scene._start_game()
	var point := Vector2(600, 350)
	var physical: Vector2 = scene.world_origin + point * scene.world_scale
	scene.inspect_button.button_pressed = true
	scene._toggle_inspect_mode()
	var catalyst_before: float = scene.sim.catalyst
	scene._use_selected_tool(physical)
	assert(scene.inspector_overlay.visible, "Inspect button did not open inspector")
	assert(scene.sim.catalyst == catalyst_before, "Inspection consumed resources")
	assert(not scene.running, "Inspector should pause")
	scene._close_inspector()
	assert(scene.running, "Inspector should restore running state")
	scene._select_tool(0)
	assert(not scene.inspect_mode, "Tool selection did not leave inspect mode")
	for tick in range(1200):
		scene.sim.step(0.05)
	assert(scene.sim.organisms.size() <= scene.sim.MAX_ORGANISMS, "Population cap exceeded")
	scene._toggle_motion()
	assert(scene.sim.reduced_motion, "Reduced motion did not propagate")
	print("PRESENTATION_CHECKS_PASSED: resize mapping, graph placement, inspection, pause/resume, tool switching, 1200 simulation steps, reduced motion")
	quit()
