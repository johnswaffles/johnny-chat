extends Node3D

const STARTING_MONEY := 4200
const INCOME_TICK_SECONDS := 1.0
const SAVE_PATH := "user://cozy_town_tycoon_save.json"

const BUILDING_ORDER := ["house", "grocery", "restaurant", "bank", "fire_department", "corner_store"]
const BUILDINGS := {
	"house": {
		"name": "House",
		"cost": 650,
		"income": 22,
		"upgrade": [0, 420, 760, 1180],
		"color": "f4e3cf",
		"roof": "c96b5f",
		"accent": "e1b672",
		"layout": "yard",
	},
	"grocery": {
		"name": "Grocery Store",
		"cost": 1350,
		"income": 58,
		"upgrade": [0, 840, 1320, 1900],
		"color": "f2e8d8",
		"roof": "6faf5f",
		"accent": "76d263",
		"layout": "parking",
	},
	"restaurant": {
		"name": "Restaurant",
		"cost": 1200,
		"income": 50,
		"upgrade": [0, 760, 1240, 1800],
		"color": "f7d9bf",
		"roof": "c96b5f",
		"accent": "ffc064",
		"layout": "patio",
	},
	"bank": {
		"name": "Bank",
		"cost": 1650,
		"income": 72,
		"upgrade": [0, 980, 1520, 2300],
		"color": "dfe8ef",
		"roof": "557da1",
		"accent": "f1c85f",
		"layout": "parking",
	},
	"fire_department": {
		"name": "Fire Department",
		"cost": 1900,
		"income": 42,
		"upgrade": [0, 880, 1420, 2140],
		"color": "c94f45",
		"roof": "34383d",
		"accent": "f1d072",
		"layout": "apron",
	},
	"corner_store": {
		"name": "Corner Store",
		"cost": 980,
		"income": 38,
		"upgrade": [0, 620, 980, 1480],
		"color": "f2e8d8",
		"roof": "557da1",
		"accent": "86b4f4",
		"layout": "compact",
	},
}

var money := float(STARTING_MONEY)
var selected_building := "house"
var selected_lot_id := -1
var income_timer := 0.0
var camera_focus := Vector3.ZERO
var camera_zoom := 17.0
var camera_yaw := deg_to_rad(42.0)
var is_dragging_camera := false
var last_mouse_position := Vector2.ZERO

var lots := []
var materials := {}
var camera: Camera3D
var world_root: Node3D
var lot_root: Node3D
var prop_root: Node3D
var money_label: Label
var income_label: Label
var selected_label: Label
var upgrade_button: Button
var build_buttons := {}


func _ready() -> void:
	_build_materials()
	_create_world()
	_create_lighting()
	_create_camera()
	_create_ui()
	_load_game()
	_update_camera()
	_update_ui()


func _process(delta: float) -> void:
	_handle_keyboard_camera(delta)
	income_timer += delta
	if income_timer >= INCOME_TICK_SECONDS:
		income_timer -= INCOME_TICK_SECONDS
		var earned := _income_per_second()
		if earned > 0.0:
			money += earned
			_update_ui()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mouse_event := event as InputEventMouseButton
		if mouse_event.button_index == MOUSE_BUTTON_WHEEL_UP and mouse_event.pressed:
			camera_zoom = maxf(9.0, camera_zoom - 1.2)
			_update_camera()
		elif mouse_event.button_index == MOUSE_BUTTON_WHEEL_DOWN and mouse_event.pressed:
			camera_zoom = minf(30.0, camera_zoom + 1.2)
			_update_camera()
		elif mouse_event.button_index == MOUSE_BUTTON_RIGHT:
			is_dragging_camera = mouse_event.pressed
			last_mouse_position = mouse_event.position
	if event is InputEventMouseMotion and is_dragging_camera:
		var motion := event as InputEventMouseMotion
		var delta := motion.position - last_mouse_position
		last_mouse_position = motion.position
		var right := Vector3(cos(camera_yaw), 0.0, -sin(camera_yaw))
		var forward := Vector3(sin(camera_yaw), 0.0, cos(camera_yaw))
		camera_focus += (-right * delta.x + forward * delta.y) * camera_zoom * 0.0018
		_update_camera()


func _build_materials() -> void:
	materials["grass"] = _mat("8fcb7b")
	materials["grass_dark"] = _mat("76b66d")
	materials["road"] = _mat("3d4245")
	materials["road_soft"] = _mat("4c5258")
	materials["sidewalk"] = _mat("dedbd2")
	materials["curb"] = _mat("f3efe2")
	materials["line"] = _mat("f7df76")
	materials["white"] = _mat("fff7e8")
	materials["shadow"] = _mat("1c1b17", 0.96, 0.18)
	materials["parking"] = _mat("5b6064")
	materials["driveway"] = _mat("c9c2ad")
	materials["tree"] = _mat("4f9b47")
	materials["tree_light"] = _mat("79bd63")
	materials["trunk"] = _mat("805a3c")
	materials["water"] = _mat("84cde3", 0.42, 1.0)
	materials["glass"] = _mat("bfe6ff", 0.38, 0.78)
	materials["dark"] = _mat("34383d")
	materials["warm_light"] = _mat("ffe7a8", 0.22, 1.0, "ffe7a8", 0.35)


func _mat(hex: String, roughness: float = 0.86, alpha: float = 1.0, emission_hex: String = "", emission_energy: float = 0.0) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(hex)
	mat.albedo_color.a = alpha
	mat.roughness = roughness
	mat.metallic = 0.0
	mat.metallic_specular = 0.08
	if alpha < 1.0:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emission_hex != "":
		mat.emission_enabled = true
		mat.emission = Color(emission_hex)
		mat.emission_energy_multiplier = emission_energy
	return mat


func _create_world() -> void:
	world_root = Node3D.new()
	world_root.name = "TownWorld"
	add_child(world_root)
	lot_root = Node3D.new()
	lot_root.name = "Lots"
	world_root.add_child(lot_root)
	prop_root = Node3D.new()
	prop_root.name = "TownProps"
	world_root.add_child(prop_root)

	_box(world_root, Vector3(0, -0.04, 0), Vector3(42, 0.08, 28), materials["grass"])
	for x in range(-18, 19, 6):
		for z in [-11, 11]:
			_add_tree(prop_root, Vector3(x + randf_range(-0.7, 0.7), 0, z + randf_range(-0.6, 0.6)), randi() % 3)

	_create_main_road()
	_create_lots()


func _create_main_road() -> void:
	_box(world_root, Vector3(0, 0.02, 0), Vector3(40, 0.08, 3.2), materials["road"])
	_box(world_root, Vector3(0, 0.08, -2.18), Vector3(40, 0.08, 0.9), materials["sidewalk"])
	_box(world_root, Vector3(0, 0.08, 2.18), Vector3(40, 0.08, 0.9), materials["sidewalk"])
	_box(world_root, Vector3(0, 0.13, -1.66), Vector3(40, 0.08, 0.12), materials["curb"])
	_box(world_root, Vector3(0, 0.13, 1.66), Vector3(40, 0.08, 0.12), materials["curb"])
	for x in range(-18, 19, 4):
		_box(world_root, Vector3(x, 0.095, 0), Vector3(1.35, 0.025, 0.09), materials["line"])
	for x in [-14, -6, 2, 10, 18]:
		_add_streetlight(prop_root, Vector3(x, 0, -2.75))
		_add_streetlight(prop_root, Vector3(x + 2, 0, 2.75))
	for x in [-16, -8, 0, 8, 16]:
		_add_bench(prop_root, Vector3(x, 0, -3.0), 0.0)
		_add_planter(prop_root, Vector3(x + 1.6, 0, 3.0))


func _create_lots() -> void:
	var id := 0
	for z in [-6.8, 6.8]:
		for x in [-15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0]:
			var frontage := "south" if z < 0 else "north"
			_create_empty_lot(id, Vector3(x, 0, z), frontage)
			id += 1


func _create_empty_lot(id: int, position: Vector3, frontage: String) -> void:
	var lot := Node3D.new()
	lot.name = "PropertyLot_%02d" % id
	lot.position = position
	lot_root.add_child(lot)

	var layout_root := Node3D.new()
	layout_root.name = "LotLayout"
	lot.add_child(layout_root)
	var anchor := Node3D.new()
	anchor.name = "BuildingAnchor"
	lot.add_child(anchor)
	var area := Area3D.new()
	area.name = "ClickArea"
	lot.add_child(area)
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(4.4, 0.3, 4.8)
	shape.shape = box_shape
	shape.position = Vector3(0, 0.25, 0)
	area.add_child(shape)
	area.input_event.connect(_on_lot_input_event.bind(id))

	_box(layout_root, Vector3(0, 0.03, 0), Vector3(4.45, 0.06, 4.85), materials["grass_dark"])
	_box(layout_root, Vector3(0, 0.08, 0), Vector3(3.45, 0.05, 0.32), materials["sidewalk"])
	_box(layout_root, Vector3(0, 0.13, 1.58 if frontage == "south" else -1.58), Vector3(1.8, 0.04, 0.48), materials["driveway"])
	_add_dotted_outline(layout_root)
	var sign := _label3d(layout_root, "EMPTY LOT", Vector3(0, 0.22, 0), 0.42, Color("2f5b36"))
	sign.rotation_degrees.x = -60.0

	lots.append({
		"id": id,
		"node": lot,
		"layout": layout_root,
		"anchor": anchor,
		"frontage": frontage,
		"building": "",
		"tier": 0,
		"unlocked": true,
	})


func _on_lot_input_event(_camera: Node, event: InputEvent, _position: Vector3, _normal: Vector3, _shape_idx: int, lot_id: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		selected_lot_id = lot_id
		var lot := _lot(lot_id)
		if lot.building == "":
			_place_building(lot_id, selected_building)
		_update_ui()


func _place_building(lot_id: int, building_key: String) -> void:
	var lot := _lot(lot_id)
	if lot.building != "":
		return
	var data: Dictionary = BUILDINGS[building_key]
	var cost: int = data.cost
	if money < cost:
		_flash_selected("Need $%d for %s." % [cost, data.name])
		return
	money -= cost
	lot.building = building_key
	lot.tier = 1
	_clear_children(lot.layout)
	_create_lot_layout(lot.layout, building_key, lot.frontage)
	_rebuild_building_visual(lot)
	_save_game()


func _upgrade_selected() -> void:
	if selected_lot_id < 0:
		return
	var lot := _lot(selected_lot_id)
	if lot.building == "":
		return
	if lot.tier >= 4:
		return
	var data: Dictionary = BUILDINGS[lot.building]
	var cost: int = data.upgrade[lot.tier]
	if money < cost:
		_flash_selected("Need $%d to upgrade." % cost)
		return
	money -= cost
	lot.tier += 1
	_rebuild_building_visual(lot)
	_save_game()
	_update_ui()


func _create_lot_layout(parent: Node3D, building_key: String, frontage: String) -> void:
	var data: Dictionary = BUILDINGS[building_key]
	var layout_type: String = data.layout
	_box(parent, Vector3(0, 0.035, 0), Vector3(4.55, 0.07, 4.95), materials["grass_dark"])
	var front_z := 1.72 if frontage == "south" else -1.72
	var rear_z := -1.1 if frontage == "south" else 1.1
	_box(parent, Vector3(0, 0.09, front_z), Vector3(4.4, 0.06, 0.7), materials["sidewalk"])
	_box(parent, Vector3(0, 0.15, front_z * 0.86), Vector3(1.45, 0.04, 0.42), materials["driveway"])
	match layout_type:
		"yard":
			_box(parent, Vector3(0, 0.11, front_z * 0.34), Vector3(1.2, 0.035, 1.45), _mat("d7c5a5"))
			_add_fence(parent, Vector3(0, 0, rear_z), frontage)
			_add_mailbox(parent, Vector3(-1.6, 0, front_z * 0.84))
			for x in [-1.55, 1.55]:
				_add_bush(parent, Vector3(x, 0, -0.2 if frontage == "south" else 0.2))
		"parking", "compact":
			var width := 3.55 if layout_type == "parking" else 2.95
			_add_parking_lot(parent, Vector3(0, 0, front_z * 0.42), Vector2(width, 1.45), 4 if layout_type == "parking" else 3)
			for x in [-1.85, 1.85]:
				_add_planter(parent, Vector3(x, 0, rear_z))
		"patio":
			_add_parking_lot(parent, Vector3(0.65, 0, front_z * 0.48), Vector2(2.65, 1.25), 3)
			_box(parent, Vector3(-1.35, 0.12, front_z * 0.35), Vector3(1.18, 0.05, 1.05), _mat("c9a878"))
			for i in range(3):
				_add_table(parent, Vector3(-1.7 + i * 0.35, 0, front_z * 0.35 + 0.18 * (i % 2)))
		"apron":
			_box(parent, Vector3(0, 0.12, front_z * 0.3), Vector3(3.65, 0.06, 1.55), _mat("c9c7b2"))
			for x in [-1.6, -0.8, 0.8, 1.6]:
				_add_bollard(parent, Vector3(x, 0, front_z * 0.82))


func _rebuild_building_visual(lot: Dictionary) -> void:
	var anchor: Node3D = lot.anchor
	_clear_children(anchor)
	var visual := Node3D.new()
	visual.name = "BuildingVisual_Tier_%d" % lot.tier
	anchor.add_child(visual)
	var front_multiplier := -1.0 if lot.frontage == "south" else 1.0
	visual.position = Vector3(0, 0, front_multiplier * 0.78)
	if lot.frontage == "north":
		visual.rotation.y = PI
	_create_building_visual(visual, lot.building, lot.tier)


func _create_building_visual(parent: Node3D, key: String, tier: int) -> void:
	var data: Dictionary = BUILDINGS[key]
	var wall := _mat(data.color)
	var roof := _mat(data.roof)
	var accent := _mat(data.accent)
	var width := 1.55 + tier * 0.34
	var depth := 1.35 + tier * 0.24
	var height := 0.68 + tier * 0.2
	if key == "house":
		width = 1.35 + tier * 0.28
		depth = 1.16 + tier * 0.22
		height = 0.62 + tier * 0.18
	_box(parent, Vector3(0, 0.08, 0), Vector3(width + 0.25, 0.08, depth + 0.2), materials["shadow"])
	_box(parent, Vector3(0, height * 0.5, 0), Vector3(width, height, depth), wall)
	_box(parent, Vector3(0, height + 0.16, 0), Vector3(width + 0.28, 0.32, depth + 0.28), roof)
	_box(parent, Vector3(0, height + 0.36, -depth * 0.18), Vector3(width * 0.84, 0.12, depth * 0.34), roof)
	_add_windows(parent, width, depth, height, tier)
	_box(parent, Vector3(0, 0.34, -depth * 0.52 - 0.02), Vector3(0.38, 0.56, 0.055), accent)
	match key:
		"house":
			_box(parent, Vector3(-width * 0.36, height + 0.48, depth * 0.25), Vector3(0.16, 0.52, 0.16), _mat("805a3c"))
			if tier >= 2:
				_box(parent, Vector3(0, 0.34, -depth * 0.75), Vector3(1.05, 0.12, 0.42), _mat("d8b177"))
			if tier >= 3:
				_box(parent, Vector3(width * 0.65, 0.42, 0.02), Vector3(0.65, 0.84, depth * 0.75), wall)
				_box(parent, Vector3(width * 0.65, 0.92, 0.02), Vector3(0.78, 0.22, depth * 0.86), roof)
			if tier >= 4:
				_box(parent, Vector3(0, height + 0.82, 0), Vector3(width * 0.72, 0.56, depth * 0.66), wall)
				_box(parent, Vector3(0, height + 1.18, 0), Vector3(width * 0.88, 0.28, depth * 0.78), roof)
		"grocery":
			_add_sign(parent, "GROCERY", Vector3(0, height + 0.48, -depth * 0.57), data.accent)
			_box(parent, Vector3(0, 0.44, -depth * 0.55), Vector3(width * 0.74, 0.46, 0.06), materials["glass"])
			if tier >= 2:
				_add_awning(parent, width, depth, data.accent)
			if tier >= 3:
				_box(parent, Vector3(width * 0.62, 0.42, 0.12), Vector3(0.72, 0.84, depth * 0.82), wall)
			if tier >= 4:
				_box(parent, Vector3(0, height + 0.78, 0), Vector3(width * 0.78, 0.54, depth * 0.72), wall)
		"restaurant":
			_add_sign(parent, "CAFE", Vector3(0, height + 0.44, -depth * 0.57), data.accent)
			_add_awning(parent, width, depth, data.accent)
			if tier >= 2:
				_box(parent, Vector3(-width * 0.58, 0.38, 0.05), Vector3(0.66, 0.76, depth * 0.75), wall)
			if tier >= 3:
				_box(parent, Vector3(width * 0.58, 0.38, 0.1), Vector3(0.64, 0.76, depth * 0.72), wall)
			if tier >= 4:
				_box(parent, Vector3(0, height + 0.72, 0), Vector3(width * 0.82, 0.52, depth * 0.68), wall)
				_add_string_lights(parent, width, depth)
		"bank":
			_add_sign(parent, "BANK", Vector3(0, height + 0.5, -depth * 0.57), data.accent)
			for x in [-width * 0.32, 0, width * 0.32]:
				_cylinder(parent, Vector3(x, 0.48, -depth * 0.62), 0.07, 0.92, materials["white"])
			if tier >= 2:
				_box(parent, Vector3(0, 0.18, -depth * 0.78), Vector3(width * 0.9, 0.08, 0.42), _mat("d3cbb7"))
			if tier >= 3:
				_box(parent, Vector3(-width * 0.62, 0.42, 0.06), Vector3(0.62, 0.84, depth * 0.7), wall)
			if tier >= 4:
				_box(parent, Vector3(0, height + 0.84, 0), Vector3(width * 0.82, 0.58, depth * 0.76), wall)
		"fire_department":
			_add_sign(parent, "FIRE", Vector3(0, height + 0.48, -depth * 0.57), data.accent)
			for x in [-width * 0.24, width * 0.24]:
				_box(parent, Vector3(x, 0.45, -depth * 0.58), Vector3(width * 0.28, 0.66, 0.07), _mat("40464b"))
				_box(parent, Vector3(x, 0.45, -depth * 0.63), Vector3(width * 0.22, 0.06, 0.075), materials["line"])
			if tier >= 2:
				_box(parent, Vector3(width * 0.62, 0.65, 0.0), Vector3(0.62, 1.3, depth * 0.74), wall)
			if tier >= 3:
				_box(parent, Vector3(-width * 0.55, 1.0, 0.0), Vector3(0.42, 2.0, 0.42), wall)
			if tier >= 4:
				_box(parent, Vector3(0, height + 0.72, 0.0), Vector3(width * 0.78, 0.5, depth * 0.68), wall)
		"corner_store":
			_add_sign(parent, "MART", Vector3(0, height + 0.48, -depth * 0.57), data.accent)
			_box(parent, Vector3(-width * 0.3, 0.42, -depth * 0.55), Vector3(width * 0.34, 0.5, 0.06), materials["glass"])
			_box(parent, Vector3(width * 0.2, 0.36, -depth * 0.58), Vector3(0.34, 0.44, 0.055), accent)
			if tier >= 2:
				_add_awning(parent, width, depth, data.accent)
			if tier >= 3:
				_box(parent, Vector3(width * 0.62, 0.36, 0.0), Vector3(0.52, 0.72, depth * 0.68), wall)
			if tier >= 4:
				_box(parent, Vector3(-width * 0.52, height + 0.68, 0), Vector3(0.48, 0.64, depth * 0.48), wall)


func _add_windows(parent: Node3D, width: float, depth: float, height: float, tier: int) -> void:
	for x in [-width * 0.28, width * 0.28]:
		_box(parent, Vector3(x, height * 0.57, -depth * 0.53), Vector3(0.3, 0.28, 0.052), materials["glass"])
	if tier >= 3:
		for x in [-width * 0.43, width * 0.43]:
			_box(parent, Vector3(x, height * 0.62, depth * 0.52), Vector3(0.26, 0.24, 0.052), materials["glass"])


func _create_lighting() -> void:
	var world_environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("dcefbf")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.92, 0.86, 0.72)
	env.ambient_light_energy = 0.72
	env.glow_enabled = true
	env.glow_intensity = 0.08
	env.glow_bloom = 0.012
	env.adjustment_enabled = true
	env.adjustment_brightness = 1.04
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 1.08
	world_environment.environment = env
	add_child(world_environment)

	var sun := DirectionalLight3D.new()
	sun.name = "WarmSun"
	sun.light_color = Color(1.0, 0.84, 0.58)
	sun.light_energy = 1.38
	sun.rotation_degrees = Vector3(-46, 36, 0)
	sun.shadow_enabled = true
	sun.shadow_blur = 2.2
	add_child(sun)

	var fill := DirectionalLight3D.new()
	fill.name = "SoftBlueFill"
	fill.light_color = Color(0.64, 0.74, 1.0)
	fill.light_energy = 0.18
	fill.rotation_degrees = Vector3(-22, -126, 0)
	add_child(fill)


func _create_camera() -> void:
	camera = Camera3D.new()
	camera.name = "IsometricCamera"
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.1
	camera.far = 500.0
	add_child(camera)


func _update_camera() -> void:
	camera_focus.x = clampf(camera_focus.x, -18.0, 18.0)
	camera_focus.z = clampf(camera_focus.z, -11.0, 11.0)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = camera_zoom
	var offset := Vector3(camera_zoom * 0.76, camera_zoom * 0.62, camera_zoom * 0.76).rotated(Vector3.UP, camera_yaw)
	camera.position = camera_focus + offset
	camera.look_at(camera_focus + Vector3(0, 0.9, 0), Vector3.UP)


func _handle_keyboard_camera(delta: float) -> void:
	var input := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		input.x -= 1
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		input.x += 1
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		input.y -= 1
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		input.y += 1
	if input.length() > 0:
		var right := Vector3(cos(camera_yaw), 0.0, -sin(camera_yaw))
		var forward := Vector3(sin(camera_yaw), 0.0, cos(camera_yaw))
		camera_focus += (right * input.x + forward * input.y) * delta * camera_zoom * 0.72
		_update_camera()


func _create_ui() -> void:
	var layer := CanvasLayer.new()
	layer.name = "GameUI"
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(root)

	var top_panel := PanelContainer.new()
	top_panel.position = Vector2(18, 18)
	top_panel.custom_minimum_size = Vector2(390, 88)
	root.add_child(top_panel)
	var top_box := VBoxContainer.new()
	top_panel.add_child(top_box)
	money_label = Label.new()
	money_label.add_theme_font_size_override("font_size", 28)
	top_box.add_child(money_label)
	income_label = Label.new()
	income_label.add_theme_font_size_override("font_size", 16)
	top_box.add_child(income_label)

	var build_panel := PanelContainer.new()
	build_panel.position = Vector2(18, 124)
	build_panel.custom_minimum_size = Vector2(260, 370)
	root.add_child(build_panel)
	var build_box := VBoxContainer.new()
	build_box.add_theme_constant_override("separation", 8)
	build_panel.add_child(build_box)
	var build_title := Label.new()
	build_title.text = "Build Menu"
	build_title.add_theme_font_size_override("font_size", 22)
	build_box.add_child(build_title)
	for key in BUILDING_ORDER:
		var data: Dictionary = BUILDINGS[key]
		var button := Button.new()
		button.text = "%s  $%d" % [data.name, data.cost]
		button.toggle_mode = true
		button.pressed.connect(_select_building.bind(key))
		build_box.add_child(button)
		build_buttons[key] = button

	var selected_panel := PanelContainer.new()
	selected_panel.anchor_left = 1.0
	selected_panel.anchor_right = 1.0
	selected_panel.offset_left = -370
	selected_panel.offset_right = -18
	selected_panel.offset_top = 18
	selected_panel.offset_bottom = 188
	root.add_child(selected_panel)
	var selected_box := VBoxContainer.new()
	selected_box.add_theme_constant_override("separation", 8)
	selected_panel.add_child(selected_box)
	selected_label = Label.new()
	selected_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	selected_label.add_theme_font_size_override("font_size", 17)
	selected_box.add_child(selected_label)
	upgrade_button = Button.new()
	upgrade_button.text = "Upgrade"
	upgrade_button.pressed.connect(_upgrade_selected)
	selected_box.add_child(upgrade_button)
	var save_button := Button.new()
	save_button.text = "Save"
	save_button.pressed.connect(_save_game)
	selected_box.add_child(save_button)
	var reset_button := Button.new()
	reset_button.text = "Reset Test Save"
	reset_button.pressed.connect(_reset_game)
	selected_box.add_child(reset_button)


func _select_building(key: String) -> void:
	selected_building = key
	for button_key in build_buttons.keys():
		build_buttons[button_key].button_pressed = button_key == key
	_update_ui()


func _update_ui() -> void:
	if not money_label:
		return
	money_label.text = "$%d" % int(money)
	income_label.text = "Income: $%d/sec" % int(_income_per_second())
	for key in build_buttons.keys():
		var data: Dictionary = BUILDINGS[key]
		var button: Button = build_buttons[key]
		button.button_pressed = key == selected_building
		button.disabled = money < int(data.cost)
	if selected_lot_id < 0:
		selected_label.text = "Choose a building, then click an empty lot."
		upgrade_button.disabled = true
		return
	var lot := _lot(selected_lot_id)
	if lot.building == "":
		selected_label.text = "Empty lot selected.\nCurrent build: %s" % BUILDINGS[selected_building].name
		upgrade_button.disabled = true
		return
	var data: Dictionary = BUILDINGS[lot.building]
	var next_cost := 0
	if lot.tier < 4:
		next_cost = data.upgrade[lot.tier]
	selected_label.text = "%s\nTier %d / 4\nIncome: $%d/sec\n%s" % [
		data.name,
		lot.tier,
		int(_building_income(lot.building, lot.tier)),
		"Upgrade: $%d" % next_cost if lot.tier < 4 else "Fully upgraded",
	]
	upgrade_button.disabled = lot.tier >= 4 or money < next_cost


func _flash_selected(text: String) -> void:
	if selected_label:
		selected_label.text = text


func _income_per_second() -> float:
	var total := 0.0
	for lot in lots:
		if lot.building != "":
			total += _building_income(lot.building, lot.tier)
	return total


func _building_income(key: String, tier: int) -> float:
	var data: Dictionary = BUILDINGS[key]
	return float(data.income) * (1.0 + float(tier - 1) * 0.7)


func _lot(id: int) -> Dictionary:
	return lots[id]


func _save_game() -> void:
	var save_lots := []
	for lot in lots:
		save_lots.append({"building": lot.building, "tier": lot.tier})
	var payload := {"money": money, "lots": save_lots}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(payload))


func _load_game() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		_select_building("house")
		return
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		_select_building("house")
		return
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		_select_building("house")
		return
	money = float(parsed.get("money", STARTING_MONEY))
	var saved_lots: Array = parsed.get("lots", [])
	for i in range(mini(saved_lots.size(), lots.size())):
		var saved: Dictionary = saved_lots[i]
		var building := String(saved.get("building", ""))
		if building != "" and BUILDINGS.has(building):
			var lot := _lot(i)
			lot.building = building
			lot.tier = clampi(int(saved.get("tier", 1)), 1, 4)
			_clear_children(lot.layout)
			_create_lot_layout(lot.layout, building, lot.frontage)
			_rebuild_building_visual(lot)
	_select_building("house")


func _reset_game() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
	get_tree().reload_current_scene()


func _clear_children(node: Node) -> void:
	for child in node.get_children():
		child.queue_free()


func _box(parent: Node, position: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	instance.material_override = mat
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(instance)
	return instance


func _cylinder(parent: Node, position: Vector3, radius: float, height: float, mat: Material) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 10
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	instance.material_override = mat
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(instance)
	return instance


func _sphere(parent: Node, position: Vector3, radius: float, mat: Material, scale_y: float = 1.0) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2
	mesh.radial_segments = 10
	mesh.rings = 5
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	instance.scale.y = scale_y
	instance.material_override = mat
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(instance)
	return instance


func _label3d(parent: Node, text: String, position: Vector3, size: float, color: Color) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.position = position
	label.font_size = 48
	label.pixel_size = 0.008 * size
	label.modulate = color
	label.outline_size = 5
	label.outline_modulate = Color(1, 0.95, 0.84, 0.9)
	parent.add_child(label)
	return label


func _add_sign(parent: Node3D, text: String, position: Vector3, accent_hex: String) -> void:
	_box(parent, position + Vector3(0, 0, 0.015), Vector3(1.05, 0.34, 0.055), _mat(accent_hex))
	var label := _label3d(parent, text, position + Vector3(0, 0.01, -0.02), 0.36, Color("26372c"))
	label.rotation_degrees.x = 0


func _add_awning(parent: Node3D, width: float, depth: float, accent_hex: String) -> void:
	_box(parent, Vector3(0, 0.82, -depth * 0.68), Vector3(width * 0.88, 0.16, 0.34), _mat(accent_hex))


func _add_string_lights(parent: Node3D, width: float, depth: float) -> void:
	for i in range(5):
		var x := lerpf(-width * 0.36, width * 0.36, float(i) / 4.0)
		_sphere(parent, Vector3(x, 0.98, -depth * 0.78), 0.045, materials["warm_light"], 0.8)


func _add_tree(parent: Node, position: Vector3, variant: int = 0) -> Node3D:
	var root := Node3D.new()
	root.position = position
	parent.add_child(root)
	_cylinder(root, Vector3(0, 0.32, 0), 0.09, 0.64, materials["trunk"])
	match variant:
		0:
			_sphere(root, Vector3(0, 0.88, 0), 0.44, materials["tree"], 1.18)
			_sphere(root, Vector3(-0.18, 0.78, 0.04), 0.28, materials["tree_light"], 1.0)
		1:
			_sphere(root, Vector3(0, 0.82, 0), 0.34, materials["tree"], 1.55)
			_sphere(root, Vector3(0, 1.12, 0), 0.25, materials["tree_light"], 1.25)
		_:
			_sphere(root, Vector3(-0.14, 0.82, 0.02), 0.36, materials["tree"], 1.0)
			_sphere(root, Vector3(0.18, 0.9, -0.04), 0.32, materials["tree_light"], 1.1)
	return root


func _add_bush(parent: Node, position: Vector3) -> void:
	for x in [-0.14, 0.0, 0.14]:
		_sphere(parent, position + Vector3(x, 0.16, 0), 0.16, materials["tree_light"], 0.7)


func _add_planter(parent: Node, position: Vector3) -> void:
	_box(parent, position + Vector3(0, 0.1, 0), Vector3(0.46, 0.2, 0.28), _mat("b8875d"))
	_add_bush(parent, position + Vector3(0, 0.15, 0))


func _add_bench(parent: Node, position: Vector3, rotation_y: float) -> void:
	var root := Node3D.new()
	root.position = position
	root.rotation.y = rotation_y
	parent.add_child(root)
	_box(root, Vector3(0, 0.18, 0), Vector3(0.58, 0.08, 0.18), _mat("a57649"))
	_box(root, Vector3(0, 0.34, -0.08), Vector3(0.58, 0.22, 0.055), _mat("a57649"))
	for x in [-0.2, 0.2]:
		_box(root, Vector3(x, 0.08, 0.04), Vector3(0.045, 0.16, 0.045), materials["dark"])


func _add_streetlight(parent: Node, position: Vector3) -> void:
	_cylinder(parent, position + Vector3(0, 0.58, 0), 0.035, 1.16, materials["dark"])
	_box(parent, position + Vector3(0, 1.16, 0), Vector3(0.24, 0.06, 0.24), materials["dark"])
	_sphere(parent, position + Vector3(0, 1.08, 0), 0.08, materials["warm_light"], 0.8)


func _add_parking_lot(parent: Node, position: Vector3, size: Vector2, spaces: int) -> void:
	_box(parent, position + Vector3(0, 0.05, 0), Vector3(size.x + 0.16, 0.05, size.y + 0.16), materials["curb"])
	_box(parent, position + Vector3(0, 0.09, 0), Vector3(size.x, 0.05, size.y), materials["parking"])
	for i in range(spaces + 1):
		var x := lerpf(-size.x * 0.42, size.x * 0.42, float(i) / float(maxi(1, spaces)))
		_box(parent, position + Vector3(x, 0.13, 0), Vector3(0.035, 0.014, size.y * 0.66), materials["white"])


func _add_table(parent: Node, position: Vector3) -> void:
	_cylinder(parent, position + Vector3(0, 0.18, 0), 0.12, 0.06, _mat("f2dfb8"))
	_cylinder(parent, position + Vector3(0, 0.1, 0), 0.025, 0.2, materials["dark"])


func _add_bollard(parent: Node, position: Vector3) -> void:
	_cylinder(parent, position + Vector3(0, 0.19, 0), 0.055, 0.38, _mat("f1d072"))


func _add_mailbox(parent: Node, position: Vector3) -> void:
	_cylinder(parent, position + Vector3(0, 0.28, 0), 0.025, 0.4, materials["dark"])
	_box(parent, position + Vector3(0.06, 0.52, 0), Vector3(0.28, 0.16, 0.18), _mat("557da1"))


func _add_fence(parent: Node, position: Vector3, frontage: String) -> void:
	var z := position.z
	for x in [-1.8, -1.2, -0.6, 0.6, 1.2, 1.8]:
		_box(parent, Vector3(x, 0.28, z), Vector3(0.055, 0.56, 0.055), materials["white"])
	_box(parent, Vector3(0, 0.42, z), Vector3(4.0, 0.055, 0.055), materials["white"])
	_box(parent, Vector3(0, 0.25, z), Vector3(4.0, 0.055, 0.055), materials["white"])


func _add_dotted_outline(parent: Node) -> void:
	for x in [-2.0, 2.0]:
		for z in [-1.8, -0.9, 0.0, 0.9, 1.8]:
			_box(parent, Vector3(x, 0.14, z), Vector3(0.08, 0.025, 0.34), materials["white"])
	for z in [-2.2, 2.2]:
		for x in [-1.5, -0.75, 0.0, 0.75, 1.5]:
			_box(parent, Vector3(x, 0.14, z), Vector3(0.34, 0.025, 0.08), materials["white"])
