extends RefCounted

const KINDS := ["microbes", "amoeboid", "grazer", "predator", "fungus"]
const PROFILES := {
	"microbes": {"name": "Cyano mats", "stat": "microbes", "color": "#55f08a", "role": "THE FOUNDATION", "food": "Sunlight and dissolved nutrients", "feeds": "Drifters and grazers", "story": "These photosynthetic colonies form the food-web foundation and gradually release oxygen. Their count is occupied habitat cells, not individual bacteria.", "care": "Seed shallow water, then add nutrients near depleted colonies. Spread food across several regions."},
	"amoeboid": {"name": "Amoeboid drifters", "stat": "amoeboids", "color": "#67eaff", "role": "FIRST CONSUMERS", "food": "Microbial mats and fungal snacks", "feeds": "Predatory swimmers", "story": "Drifters seek nearby food and flee detected hunters. Well-fed adults split into descendants with small inherited trait changes.", "care": "Watch the microbial foundation before adding more drifters. Many consumers can exhaust a small food patch."},
	"grazer": {"name": "Tidal grazers", "stat": "grazers", "color": "#c5e66f", "role": "GRAZERS & SCAVENGERS", "food": "Microbial mats and decaying matter", "feeds": "Predatory swimmers", "story": "Grazers seek colonies, loosely gather near other grazers, and flee hunters when their camouflage cannot hide them. Armor helps resist attacks.", "care": "Place small groups beside established colonies. Restore food before adding more animals."},
	"predator": {"name": "Predatory swimmers", "stat": "predators", "color": "#ff7148", "role": "POPULATION CONTROL", "food": "Drifters and grazers", "feeds": "Decomposers after death", "story": "Hunters pursue prey. Attack success depends on aggression, size and speed against the prey's armor, speed and camouflage.", "care": "Introduce hunters only after a strong consumer population exists. Too many hunters can remove their own food supply."},
	"fungus": {"name": "Fungal blooms", "stat": "fungal", "color": "#dc9aef", "role": "THE RECYCLERS", "food": "Decaying organic matter", "feeds": "Drifters; recycled nutrients support mats", "story": "Decomposition returns nutrients to the habitat. Purple blooms are part of the recycling layer, not another animal population.", "care": "A varied ecosystem needs both growth and recycling. Inspect habitat to compare food, nutrients and temperature."},
}

static func observe(sim, records: Dictionary, stats: Dictionary = {}) -> void:
	if records.size() == KINDS.size():
		return
	if stats.is_empty():
		stats = sim.stats()
	for kind in KINDS:
		if records.has(kind) or int(stats[PROFILES[kind].stat]) <= 0:
			continue
		records[kind] = {"day": sim.day, "generation": 0, "lineage": ""}
		for organism in sim.organisms:
			if organism.kind == kind:
				records[kind].generation = organism.generation
				records[kind].lineage = organism.lineage
				break

static func behavior(organism: Dictionary) -> String:
	if float(organism.get("feeding_flash", 0.0)) > 0.0:
		return "Feeding"
	if float(organism.get("birth_flash", 0.0)) > 0.0:
		return "Recently reproduced"
	if float(organism.get("energy", 100.0)) < 25.0:
		return "Low energy · needs food"
	return str(organism.get("behavior", "Exploring"))
