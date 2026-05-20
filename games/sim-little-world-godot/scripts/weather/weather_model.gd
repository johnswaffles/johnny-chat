extends RefCounted

const SEASONS := ["Hydrothermal Spring", "Greenhouse Summer", "Storm Monsoon", "Ashen Winter"]


func season_name(index: int) -> String:
	return SEASONS[clampi(index, 0, SEASONS.size() - 1)]


func roll_weather(season: int, rng: RandomNumberGenerator) -> String:
	var choices: Array[String] = ["clear", "marine haze", "warm rain", "clear"]
	if season == 1:
		choices = ["clear", "heat pulse", "marine haze", "warm rain"]
	elif season == 2:
		choices = ["storm rain", "warm rain", "marine haze", "clear"]
	elif season == 3:
		choices = ["ash cloud", "marine haze", "clear"]
	return choices[rng.randi_range(0, choices.size() - 1)]


func weather_description(weather: String, climate_heat: float) -> String:
	var heat := "stable"
	if climate_heat > 0.62:
		heat = "hot"
	elif climate_heat < 0.35:
		heat = "cool"
	return "%s - climate %s" % [weather, heat]
