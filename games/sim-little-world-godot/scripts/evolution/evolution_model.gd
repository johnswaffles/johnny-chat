extends RefCounted

const ERAS := [
	{"limit": 3600.0, "era": "Hadean Shoreline", "epoch": "Prebiotic Tide Pools"},
	{"limit": 2500.0, "era": "Archean Ocean", "epoch": "Microbial Mat Age"},
	{"limit": 800.0, "era": "Proterozoic Sea", "epoch": "Great Oxygenation"},
	{"limit": 541.0, "era": "Ediacaran Coast", "epoch": "Soft-Bodied Bloom"},
	{"limit": -9999.0, "era": "Cambrian Bloom", "epoch": "Predator-Prey Explosion"},
]


func mutate(value: float, rng: RandomNumberGenerator, spread: float = 0.06, min_value: float = 0.08, max_value: float = 2.8) -> float:
	var drift := rng.randf_range(-spread, spread)
	if rng.randf() < 0.055:
		drift += rng.randf_range(-spread * 2.6, spread * 2.6)
	return clamp(value + drift, min_value, max_value)


func era_for_age(age_mya: float) -> Dictionary:
	for era_data in ERAS:
		if age_mya >= era_data.limit:
			return era_data
	return ERAS[-1]


func biodiversity_score(stats: Dictionary) -> float:
	var living := float(stats.amoeboids + stats.grazers + stats.predators)
	var layers := 0.0
	if stats.microbes > 120:
		layers += 22.0
	if stats.amoeboids > 20:
		layers += 24.0
	if stats.grazers > 8:
		layers += 24.0
	if stats.predators > 2:
		layers += 20.0
	if stats.fungal > 35:
		layers += 10.0
	return clamp(layers + min(22.0, living * 0.08), 0.0, 100.0)
