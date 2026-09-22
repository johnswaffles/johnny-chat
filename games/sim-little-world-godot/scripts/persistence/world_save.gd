extends RefCounted

const Simulation = preload("res://scripts/simulation/planet_simulation.gd")
const VERSION := 1
const SAVE_PATH := "user://genesis-world-v1.save"
const MAX_BYTES := 4 * 1024 * 1024
const SIM_FIELDS := ["seed_text", "tick", "day", "year", "season", "weather", "weather_timer", "climate_heat", "oxygen", "co2", "selected_tool", "catalyst", "catalyst_max", "tool_uses", "hotspot_cell", "hotspot_active"]
const APP_FIELDS := ["mission_stage", "score", "combo", "combo_timer", "last_combo_tool", "field_study_index", "field_study_progress", "field_studies_completed", "discoveries", "achievements", "current_crisis", "last_crisis_notice_tick", "speed_index", "reduced_motion"]
const CELL_NUMBERS := ["depth", "microbes", "nutrients", "water", "decay", "fungus", "sediment", "temperature"]
const CREATURE_NUMBERS := ["energy", "age", "cooldown", "speed", "sensory", "fertility", "metabolism", "armor", "aggression", "camouflage", "oxygen_tolerance", "size"]

static func capture(game: Node) -> Dictionary:
	var state := {}
	for key in SIM_FIELDS:
		state[key] = game.sim.get(key)
	state.cells = game.sim.cells.duplicate(true)
	state.organisms = game.sim.organisms.duplicate(true)
	state.history = game.sim.history.duplicate(true)
	state.events = game.sim.events.duplicate(true)
	state.rng_seed = game.sim.rng.seed
	state.rng_state = game.sim.rng.state
	var progress := {}
	for key in APP_FIELDS:
		progress[key] = game.get(key)
	return {"version": VERSION, "saved_at": Time.get_datetime_string_from_system(), "simulation": state, "progress": progress.duplicate(true), "journal_seen": game.journal_seen.duplicate(true), "camera_zoom": game.camera.zoom, "camera_center": game.camera.center}

static func validate(data: Variant) -> bool:
	if not data is Dictionary or data.get("version") != VERSION or not data.get("saved_at") is String:
		return false
	if not data.get("simulation") is Dictionary or not data.get("progress") is Dictionary:
		return false
	var state: Dictionary = data.simulation
	var progress: Dictionary = data.progress
	var defaults := Simulation.new()
	for key in SIM_FIELDS:
		if not state.has(key) or typeof(state[key]) != typeof(defaults.get(key)):
			return false
		if state[key] is float and not is_finite(state[key]):
			return false
	if state.tick < 0 or state.day < 1 or state.year < 1 or state.season < 0 or state.season > 3 or state.selected_tool < 0 or state.selected_tool > 7:
		return false
	if not state.get("rng_seed") is int or not state.get("rng_state") is int:
		return false
	if not state.get("cells") is Array or state.cells.size() != Simulation.GRID_W * Simulation.GRID_H:
		return false
	for cell in state.cells:
		if not cell is Dictionary or not cell.get("type") in ["deep_ocean", "shelf", "shallow", "tidal", "basalt", "volcanic"] or not cell.get("vent") is bool:
			return false
		if not _numbers_valid(cell, CELL_NUMBERS):
			return false
	if not state.get("organisms") is Array or state.organisms.size() > Simulation.MAX_ORGANISMS:
		return false
	for organism in state.organisms:
		if not organism is Dictionary or not organism.get("kind") in ["amoeboid", "grazer", "predator"]:
			return false
		if not _numbers_valid(organism, CREATURE_NUMBERS) or not organism.get("dead") is bool or not organism.get("lineage") is String or not organism.get("generation") is int:
			return false
		for optional in ["feeding_flash", "birth_flash"]:
			if organism.has(optional) and not _numbers_valid(organism, [optional]):
				return false
		if organism.has("behavior") and not organism.behavior is String:
			return false
		for key in ["pos", "prev_pos", "vel", "prev_vel"]:
			if not organism.get(key) is Vector2 or not organism[key].is_finite():
				return false
	if not state.get("history") is Array or state.history.size() > Simulation.HISTORY_MAX or not state.get("events") is Array:
		return false
	for item in state.history:
		if not item is Dictionary or not _numbers_valid(item, ["microbes", "amoeboids", "grazers", "predators"]):
			return false
	for event in state.events:
		if not event is Dictionary or not event.get("type") is String or not event.get("day") is int:
			return false
	if state.tool_uses.size() != 8:
		return false
	for count in state.tool_uses:
		if not count is int or count < 0:
			return false
	for key in APP_FIELDS:
		if not progress.has(key):
			return false
	for key in ["mission_stage", "score", "combo", "last_combo_tool", "field_study_index", "field_study_progress", "field_studies_completed", "last_crisis_notice_tick", "speed_index"]:
		if not progress[key] is int:
			return false
	if not _numbers_valid(progress, ["combo_timer"]) or not progress.reduced_motion is bool or not progress.current_crisis is String:
		return false
	if progress.mission_stage < 0 or progress.mission_stage > 5 or progress.speed_index < 0 or progress.speed_index > 3 or progress.field_study_index < -1 or progress.field_study_index > 5:
		return false
	if not progress.discoveries is Array or not progress.achievements is Dictionary:
		return false
	for discovery in progress.discoveries:
		if not discovery is String:
			return false
	if not data.get("camera_center") is Vector2 or not data.camera_center.is_finite() or not _numbers_valid(data, ["camera_zoom"]):
		return false
	var journal: Variant = data.get("journal_seen", {})
	if not journal is Dictionary:
		return false
	for kind in journal:
		var record: Variant = journal[kind]
		if not kind in ["microbes", "amoeboid", "grazer", "predator", "fungus"] or not record is Dictionary:
			return false
		if not record.get("day") is int or not record.get("generation") is int or not record.get("lineage") is String:
			return false
	return data.camera_zoom >= 1.0 and data.camera_zoom <= 4.0

static func _numbers_valid(data: Dictionary, keys: Array) -> bool:
	for key in keys:
		if not data.get(key) is float and not data.get(key) is int:
			return false
		if not is_finite(float(data[key])):
			return false
	return true

static func restore(game: Node, data: Dictionary) -> bool:
	# Validate the entire checkpoint before touching the current world.
	if not validate(data):
		return false
	var state: Dictionary = data.simulation
	for key in SIM_FIELDS:
		if key == "tool_uses":
			game.sim.tool_uses.assign(state.tool_uses)
		else:
			game.sim.set(key, state[key])
	game.sim.cells.assign(state.cells.duplicate(true))
	game.sim.organisms.assign(state.organisms.duplicate(true))
	game.sim.history.assign(state.history.duplicate(true))
	game.sim.events.assign(state.events.duplicate(true))
	game.sim.rng.seed = state.rng_seed
	game.sim.rng.state = state.rng_state
	game.sim.action_effects.clear()
	game.sim.hover_cell = Vector2i(-1, -1)
	game.sim.render_alpha = 1.0
	game.sim._rebuild_spatial()
	var progress: Dictionary = data.progress.duplicate(true)
	for key in APP_FIELDS:
		if key == "discoveries":
			game.discoveries.assign(progress.discoveries)
		else:
			game.set(key, progress[key])
	game.journal_seen = data.get("journal_seen", {}).duplicate(true)
	game.sim.reduced_motion = game.reduced_motion
	game.camera.zoom = data.camera_zoom
	game.camera.center = data.camera_center
	game.camera.constrain()
	return true

static func write(data: Dictionary, path := SAVE_PATH) -> bool:
	if not validate(data):
		return false
	var temporary := path + ".tmp"
	var file := FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		return false
	var bytes := var_to_bytes(data)
	file.store_line("LITTLE_WORLD_V1")
	file.store_line(_checksum(bytes))
	file.store_buffer(bytes)
	file.flush()
	var success := file.get_error() == OK
	file.close()
	if not success or _read_file(temporary).is_empty():
		return false
	# Only a validated previous checkpoint can replace the backup.
	if not _read_file(path).is_empty():
		if FileAccess.file_exists(path + ".bak") and DirAccess.remove_absolute(path + ".bak") != OK:
			return false
		if DirAccess.rename_absolute(path, path + ".bak") != OK:
			return false
	elif FileAccess.file_exists(path) and DirAccess.remove_absolute(path) != OK:
		return false
	return DirAccess.rename_absolute(temporary, path) == OK

static func read(path := SAVE_PATH) -> Dictionary:
	var data := _read_file(path)
	if not data.is_empty():
		return {"data": data, "recovered": false}
	data = _read_file(path + ".bak")
	if not data.is_empty():
		return {"data": data, "recovered": true}
	return {}

static func _read_file(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > MAX_BYTES:
		return {}
	if file.get_line() != "LITTLE_WORLD_V1":
		return {}
	var checksum := file.get_line()
	var bytes := file.get_buffer(file.get_length() - file.get_position())
	if _checksum(bytes) != checksum:
		return {}
	var decoded: Variant = bytes_to_var(bytes)
	return decoded if validate(decoded) else {}

static func _checksum(bytes: PackedByteArray) -> String:
	var context := HashingContext.new()
	context.start(HashingContext.HASH_SHA256)
	context.update(bytes)
	return context.finish().hex_encode()
