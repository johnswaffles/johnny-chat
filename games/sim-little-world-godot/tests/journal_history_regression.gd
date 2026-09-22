extends SceneTree

const Guide = preload("res://scripts/ui/species_guide.gd")
const Plot = preload("res://scripts/graphs/population_graph.gd")
const Save = preload("res://scripts/persistence/world_save.gd")

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	await process_frame
	game.set_process(false)
	game._start_game()
	Guide.observe(game.sim, game.journal_seen)
	assert(game.journal_seen.has("microbes") and game.journal_seen.has("amoeboid") and game.journal_seen.has("grazer"), "Starting species not recorded")
	assert(not game.journal_seen.has("predator"), "Unseen predator incorrectly recorded")
	var records: Dictionary = game.journal_seen.duplicate(true)
	game.journal.open()
	assert(game.journal.visible and not game.running, "Journal did not pause world")
	game.journal._select("predator")
	assert(game.journal.observations.text.contains("Not observed"), "Unknown species shown as observed")
	game.journal.close()
	assert(game.running, "Journal did not restore running state")
	game.running = false
	game.journal.open(true)
	game.journal.close()
	assert(not game.running, "Journal unpaused a paused world")
	var saved := Save.capture(game)
	assert(Save.validate(saved), "Journal checkpoint invalid")
	game.journal_seen = {}
	assert(Save.restore(game, saved) and game.journal_seen == records, "Journal record not restored")
	var legacy := saved.duplicate(true)
	legacy.erase("journal_seen")
	assert(Save.restore(game, legacy), "Older save rejected")
	assert(game.journal_seen.is_empty(), "Old save did not initialize journal safely")
	Guide.observe(game.sim, game.journal_seen)
	assert(game.journal_seen.has("amoeboid"), "Old world did not populate observations")
	game.saved_checkpoint = saved.duplicate(true)
	game.saved_checkpoint.progress.current_crisis = "Overcrowding — add predators or trigger a Viral Bloom"
	game._resume_saved_world()
	assert(not game.current_crisis.contains("add predators"), "Legacy crisis text was not refreshed")
	var invalid := saved.duplicate(true)
	invalid.journal_seen.amoeboid.day = "bad"
	assert(not Save.validate(invalid), "Invalid record accepted")
	var stats: Dictionary = game.sim.stats()
	stats.population = 118
	stats.microbes = 400
	for stage in range(2):
		game.mission_stage = stage
		game.current_crisis = game._detect_crisis(stats)
		assert(not game.current_crisis.contains("add predators"), "Locked predator recommended")
		var tip: Dictionary = game._coach_tip(stats)
		if tip.get("action_kind") == "tool":
			assert(game.TOOL_UNLOCK_STAGE[int(tip.action_value)] <= stage, "Coach selected locked tool")
		assert(not str(tip.get("key", "")).begins_with("endless"), "Early mission lost its objective")
	game.mission_stage = 2
	game.current_crisis = "Overcrowding"
	assert(game._crisis_coach_tip(stats).action_value == "3", "Unlocked hunter guidance missing")
	var plot := Plot.new()
	var history: Array[Dictionary] = [{"microbes": 100, "amoeboids": 2, "grazers": 1, "predators": 0}, {"microbes": 200, "amoeboids": 3, "grazers": 2, "predators": 1}]
	assert(plot.series_max(history, Plot.KEYS) == 200, "Shared axis incorrect")
	assert(plot.series_max(history, ["amoeboids"], false) == 3, "Relative axis is not species peak")
	assert(plot.sample_tick(history, 0, 95) == 60 and plot.sample_tick(history, 1, 95) == 90, "Legacy sample timing incorrect")
	history[0].tick = 30
	assert(plot.sample_tick(history, 0, 95) == 30, "Explicit timestamp ignored")
	assert(plot.index_at(Vector2(-1, 20), Vector2(700, 300), 2) == -1, "Outside chart selectable")
	assert(plot.index_at(Vector2(60, 20), Vector2(700, 300), 0) == -1, "Empty chart selectable")
	game.journal._toggle_series(false, "microbes")
	assert(not "microbes" in game.journal.enabled, "Species filter failed")
	# Behavior feedback must reflect a real feeding action, not random decoration.
	var creature: Dictionary = game.sim.organisms[0]
	var cell: Dictionary = game.sim.cell_at_world(creature.pos)
	cell.microbes = 1.0
	game.sim._update_amoeboid(creature, 0.001)
	assert(float(creature.get("feeding_flash", 0)) > 0 and Guide.behavior(creature) == "Feeding", "Feeding not reflected in inspector")
	assert(Guide.behavior({"energy": 10}) == "Low energy · needs food", "Low-energy feedback missing")
	game.mission_stage = 3
	stats.oxygen = 0.0
	stats.oxygen_balance = -0.0001
	stats.microbes = 700
	stats.population = 120
	assert(game._coach_tip(stats).key == "m3-oxygen-demand", "Oxygen deficit advice did not override crowding")
	stats.oxygen_balance = 0.0001
	assert(game._coach_tip(stats).key != "m3-oxygen-demand", "Positive oxygen balance received deficit advice")
	print("JOURNAL_HISTORY_CHECKS_PASSED: observations, unknown species, pause preservation, save compatibility, record validation, mission-aware coach, shared/relative axes, historical timing, chart filters, real feeding feedback")
	quit()
